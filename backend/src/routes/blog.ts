// 블로그에서 하는 일: 공감, 댓글, 이웃·즐겨찾는 이웃, 방문자 수·조회수 (/api/v1/blog/…)
// 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)으로 돌려주고, 화면이 보는 사람의 언어로 바꾼다
import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { canSeePrivatePosts, findVisiblePost, isPublished } from "../blog/access";
import { getMemberBlog } from "../blog/member";
import { findMentionedBlogs, mentionsIn, mentionTargets } from "../blog/mentions";
import { addBlogVisit, addPostView, currentViewerKey, getBlogVisitStats } from "../blog/visits";
import { db } from "../db";
import { blogs, comments, follows, pointLedger, postLikes, posts } from "../db/schema";
import { grantReward, lockUser } from "../game/points";
import { MAX_FAVORITES } from "../game/rules";
import { BAD_REQUEST, isSameOrigin, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";
import { hasLikeNotification, notifyMentions, notifySocial } from "../notifications";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
const fail = (error: string, vars?: Vars) => ({ ok: false as const, error, vars });

const COMMENT_MAX = 1000;
/** 댓글 내용: 앞뒤 공백을 지우고 1~1000자. 틀리면 이유(한국어 문장) */
function readComment(raw: unknown): { content: string } | { error: string } {
  const content = typeof raw === "string" ? raw.trim() : "";
  if (!content) return { error: msg("댓글을 적어 주세요") };
  if (content.length > COMMENT_MAX) return { error: msg("댓글은 1000자까지예요") };
  return { content };
}

/** 댓글 속 @주소로 언급한 회원 가운데 그 글을 볼 수 있는 사람 */
async function commentMentions(content: string, post: Parameters<typeof mentionTargets>[0]) {
  const owners = await findMentionedBlogs(mentionsIn(content));
  return mentionTargets(post, [...owners.values()]);
}

const member = requireViewer("member");

export const blogRoutes = new Hono<GuardEnv>()
  // ===== 공감 =====
  /** 공감 / 공감 취소. 처음 공감하면 글 주인에게 보상과 알림 (취소 후 다시 공감해도 한 번만) */
  .post("/posts/:id/like", member, async (c) => {
    const { userId } = c.get("viewer");
    const postId = parseId(c.req.param("id"));
    if (postId === null) return c.json(fail(BAD_REQUEST), 400);
    const post = await findVisiblePost(postId, userId);
    if (!post) return c.json(fail(msg("글을 찾을 수 없어요")), 404);

    const liked = await db.transaction(async (tx) => {
      const removed = await tx
        .delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
        .returning({ postId: postLikes.postId });
      if (removed.length) return false; // 공감 취소

      await tx.insert(postLikes).values({ postId, userId });

      // 글 주인에게 보상. 내 글이 아니고, 이 사람에게서 이 글로 받은 적이 없을 때만 (취소 후 재공감 방지)
      if (post.ownerId === userId) return true;
      await lockUser(tx, post.ownerId);
      const refId = `${postId}:${userId}`;
      const [already] = await tx
        .select({ id: pointLedger.id })
        .from(pointLedger)
        .where(and(eq(pointLedger.userId, post.ownerId), eq(pointLedger.reason, "like_received"), eq(pointLedger.refId, refId)));
      if (!already) await grantReward(tx, post.ownerId, "like_received", refId);
      // 글 주인에게 공감 알림 (GAME-08). 취소했다가 다시 공감해도 한 번만
      if (!(await hasLikeNotification(tx, post.ownerId, userId, postId))) {
        await notifySocial(tx, { userId: post.ownerId, actorId: userId, kind: "like", postId });
      }
      return true;
    });
    return c.json({ ok: true, liked });
  })

  // ===== 댓글 =====
  /** 댓글·답글 달기: { content, parentId? }. 남의 글이면 댓글 보상, 글 주인·답글 받은 사람에게 알림 */
  .post("/posts/:id/comments", member, async (c) => {
    const { userId } = c.get("viewer");
    const postId = parseId(c.req.param("id"));
    const body = await readJson(c);
    const parentId = body.parentId === undefined || body.parentId === null || body.parentId === "" ? null : parseId(body.parentId);
    if (postId === null || (body.parentId && parentId === null)) return c.json(fail(BAD_REQUEST), 400);
    const input = readComment(body.content);
    if ("error" in input) return c.json(fail(input.error), 400);
    const { content } = input;

    const post = await findVisiblePost(postId, userId);
    if (!post) return c.json(fail(msg("글을 찾을 수 없어요")), 404);
    const mentioned = await commentMentions(content, post);

    const id = await db.transaction(async (tx) => {
      // 답글은 같은 글의 원댓글에만 (답글의 답글은 원댓글에 붙인다)
      let parent: number | null = null;
      let repliedTo: string | null = null; // 답글을 단 댓글의 작성자 (답글 알림 받는 사람)
      if (parentId) {
        const [p] = await tx
          .select({ id: comments.id, parentId: comments.parentId, authorId: comments.authorId, deletedAt: comments.deletedAt })
          .from(comments)
          .where(and(eq(comments.id, parentId), eq(comments.postId, postId)));
        parent = p ? (p.parentId ?? p.id) : null;
        repliedTo = p && !p.deletedAt ? p.authorId : null;
        // 삭제되어 화면에서 사라진 댓글(답글이 없는 원댓글, 삭제된 답글)은 없는 댓글처럼 일반 댓글로 (spec 004 FR-018)
        if (p?.deletedAt) {
          const [live] = p.parentId
            ? [undefined]
            : await tx
                .select({ id: comments.id })
                .from(comments)
                .where(and(eq(comments.parentId, p.id), isNull(comments.deletedAt)))
                .limit(1);
          if (!live) parent = null;
        }
      }
      const [created] = await tx
        .insert(comments)
        .values({ postId, authorId: userId, parentId: parent, content })
        .returning({ id: comments.id });

      // 알림 (GAME-08): 답글이면 그 댓글 작성자에게, 글 주인에게는 댓글 알림 (같은 사람이면 한 번만, 자기 자신은 빼고)
      if (repliedTo) {
        await notifySocial(tx, { userId: repliedTo, actorId: userId, kind: "reply", postId, refId: created.id });
      }
      if (post.ownerId !== repliedTo) {
        await notifySocial(tx, { userId: post.ownerId, actorId: userId, kind: "comment", postId, refId: created.id });
      }
      // @주소로 언급한 회원에게도 (댓글·답글 알림을 이미 받는 사람은 빼고)
      const others = mentioned.filter((id) => id !== post.ownerId && id !== repliedTo);
      await notifyMentions(tx, { userIds: others, actorId: userId, postId, refId: created.id });

      if (post.ownerId !== userId) {
        await lockUser(tx, userId);
        await grantReward(tx, userId, "comment", created.id);
      }
      return created.id;
    });
    return c.json({ ok: true, id });
  })
  /** 내가 쓴 댓글·답글의 내용 고치기: { content }. 작성자만 (블로그 주인·관리자는 지울 수만 있다) */
  .put("/comments/:id", member, async (c) => {
    const { userId } = c.get("viewer");
    const commentId = parseId(c.req.param("id"));
    if (commentId === null) return c.json(fail(BAD_REQUEST), 400);
    const input = readComment((await readJson(c)).content);
    if ("error" in input) return c.json(fail(input.error), 400);
    const { content } = input;

    const [row] = await db
      .select({ postId: comments.postId, authorId: comments.authorId, content: comments.content })
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
    // 비공개로 바뀌어 더는 볼 수 없는 글의 댓글도 고칠 수 없다
    const post = row && row.authorId === userId ? await findVisiblePost(row.postId, userId) : null;
    if (!row || !post) return c.json(fail(msg("댓글을 찾을 수 없어요")), 404);
    // 그대로면 "수정됨"을 붙이지 않는다 (줄바꿈 모양 \r\n·\n은 비교하지 않는다)
    const lf = (s: string) => s.replace(/\r\n/g, "\n");
    if (lf(row.content) === lf(content)) return c.json({ ok: true });

    const mentioned = (await commentMentions(content, post)).filter((id) => id !== post.ownerId);
    await db.transaction(async (tx) => {
      await tx
        .update(comments)
        .set({ content, editedAt: new Date() })
        .where(and(eq(comments.id, commentId), eq(comments.authorId, userId), isNull(comments.deletedAt)));
      // 고치면서 새로 언급한 회원에게만 알림 (이미 받은 사람에게는 다시 보내지 않는다)
      await notifyMentions(tx, { userIds: mentioned, actorId: userId, postId: row.postId, refId: commentId });
    });
    return c.json({ ok: true });
  })
  /** 댓글 지우기: 작성자, 그 글의 블로그 주인, 관리자 (spec 004 결정, SOC-01) */
  .delete("/comments/:id", member, async (c) => {
    const { userId } = c.get("viewer");
    const commentId = parseId(c.req.param("id"));
    if (commentId === null) return c.json(fail(BAD_REQUEST), 400);
    const [row] = await db
      .select({ authorId: comments.authorId, ownerId: blogs.ownerId })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
    if (!row) return c.json(fail(msg("댓글을 찾을 수 없어요")), 404);
    const allowed = row.authorId === userId || row.ownerId === userId || (await getMemberBlog(userId))?.role === "admin";
    if (!allowed) return c.json(fail(msg("댓글을 찾을 수 없어요")), 404);
    // 답글이 남아 있을 수 있어서 행은 두고 삭제 표시만 한다 (표시 규칙은 누가 지웠든 같다, spec 004 FR-008)
    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
    return c.json({ ok: true });
  })

  // ===== 이웃 =====
  /** 이웃 추가 / 이웃 끊기 (남의 블로그 헤더의 이웃 버튼) */
  .post("/neighbors/:userId/toggle", member, async (c) => {
    const { userId } = c.get("viewer");
    const followeeId = c.req.param("userId");
    if (followeeId === userId) return c.json(fail(BAD_REQUEST), 400);

    const removed = await db
      .delete(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followeeId, followeeId)))
      .returning({ id: follows.followeeId });
    if (removed.length) return c.json({ ok: true, following: false });
    // 이웃은 블로그가 있는 회원만 (없는 회원·온보딩 전 회원 ID로 조작한 요청은 무시, SOC-04 #22)
    const [target] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, followeeId));
    if (!target) return c.json(fail(BAD_REQUEST), 400);
    await db.insert(follows).values({ followerId: userId, followeeId }).onConflictDoNothing();
    return c.json({ ok: true, following: true });
  })
  /** 나를 이웃한 사람 목록의 "+ 이웃 추가": 끊지 않고 추가만 한다 (두 번 눌려도 이웃이 풀리지 않게) */
  .put("/neighbors/:userId", member, async (c) => {
    const { userId } = c.get("viewer");
    const followeeId = c.req.param("userId");
    if (followeeId === userId) return c.json(fail(BAD_REQUEST), 400);
    const [target] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, followeeId));
    if (!target) return c.json(fail(BAD_REQUEST), 400);
    await db.insert(follows).values({ followerId: userId, followeeId }).onConflictDoNothing();
    return c.json({ ok: true });
  })
  /**
   * 즐겨찾는 이웃 (TOWN-08): { favorite }. 이웃(follows 행)이 있어야 하고,
   * 켤 때는 10명을 넘지 않게 회원 잠금 안에서 센다
   */
  .put("/neighbors/:userId/favorite", member, async (c) => {
    const { userId } = c.get("viewer");
    const followeeId = c.req.param("userId");
    const favorite = (await readJson(c)).favorite;
    if (typeof favorite !== "boolean") return c.json(fail(BAD_REQUEST), 400);

    const result = await db.transaction(async (tx) => {
      // 같은 회원의 즐겨찾기 요청이 동시에 와도 10명을 넘지 않게 한 줄로 세운다
      await lockUser(tx, userId);
      const mine = and(eq(follows.followerId, userId), eq(follows.followeeId, followeeId));
      const [row] = await tx.select({ isFavorite: follows.isFavorite }).from(follows).where(mine);
      if (!row) return fail(msg("이웃으로 추가한 블로그만 즐겨찾기할 수 있어요"));
      if (row.isFavorite === favorite) return { ok: true as const, favorite };
      if (favorite) {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(follows)
          .where(and(eq(follows.followerId, userId), eq(follows.isFavorite, true)));
        if (n >= MAX_FAVORITES) return fail(msg("즐겨찾기할 이웃은 최대 {n}명이에요"), { n: MAX_FAVORITES });
      }
      await tx.update(follows).set({ isFavorite: favorite }).where(mine);
      return { ok: true as const, favorite };
    });
    return c.json(result, result.ok ? 200 : 400);
  })

  // ===== 방문자 수 (BLOG-06) · 조회수 (POST-06) =====
  // 방문자도 불러야 해서 로그인을 요구하지 않는 예외다 (요구사항 BLOG-06에 기록).
  // 화면이 브라우저에 실제로 열렸을 때만(useEffect) 부르므로 링크 미리 불러오기·스크립트를 실행하지 않는 로봇은 세지 않는다.
  // 다른 사이트에서 몰래 부르지 못하게 같은 사이트 요청만 받는다.

  /** 블로그 홈을 연 사람을 오늘 한 번 센다. 주인이면 세지 않는다. 오늘·전체 방문 수를 돌려준다 */
  .post("/blogs/:id/visit", async (c) => {
    if (!isSameOrigin(c.req.raw.headers)) return c.json(fail(BAD_REQUEST), 403);
    const blogId = parseId(c.req.param("id"));
    if (blogId === null) return c.json(fail(BAD_REQUEST), 400);
    const [blog] = await db.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.id, blogId));
    if (!blog) return c.json(fail(BAD_REQUEST), 404); // 없는 블로그로 조작한 요청은 아무것도 남기지 않는다
    const { key, memberId } = await currentViewerKey(c);
    if (memberId !== blog.ownerId) await addBlogVisit(blogId, key);
    return c.json(await getBlogVisitStats(blogId));
  })
  /** 글 상세를 연 사람을 오늘 한 번 센다 (같은 사람은 하루 1번, 작성자는 세지 않음). 조회수를 돌려준다 */
  .post("/posts/:id/view", async (c) => {
    if (!isSameOrigin(c.req.raw.headers)) return c.json(fail(BAD_REQUEST), 403);
    const postId = parseId(c.req.param("id"));
    if (postId === null) return c.json(fail(BAD_REQUEST), 400);
    const [post] = await db
      .select({ visibility: posts.visibility, viewCount: posts.viewCount, ownerId: blogs.ownerId, published: isPublished })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .where(eq(posts.id, postId));
    if (!post) return c.json(fail(msg("글을 찾을 수 없어요")), 404);
    const { key, memberId } = await currentViewerKey(c);
    // 볼 수 없는 비공개 글은 404 화면이라 세지 않는다 (주인과 서로 이웃만 본다)
    if (post.visibility === "private" && !(await canSeePrivatePosts(memberId, post.ownerId))) {
      return c.json(fail(msg("글을 찾을 수 없어요")), 404);
    }
    if (memberId === post.ownerId) return c.json({ viewCount: post.viewCount });
    // 아직 안 올라간 예약 글은 주인만 본다 (POST-11)
    if (!post.published) return c.json(fail(msg("글을 찾을 수 없어요")), 404);
    return c.json({ viewCount: await addPostView(postId, key) });
  });
