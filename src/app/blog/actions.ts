"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { blogs, comments, follows, pointLedger, postLikes, posts } from "@/db/schema";
import { MAX_FAVORITES } from "@/lib/game";
import { MAX_DB_INT, parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { hasLikeNotification, notifySocial } from "@/server/notifications";
import { grantReward, lockUser } from "@/server/points";
import { addBlogVisit, addPostView, currentViewerKey, getBlogVisitStats } from "@/server/visits";

/** 글과 그 글의 블로그 주인 (공개 글이거나 내 글일 때만) */
async function findVisiblePost(postId: number, viewerId: string) {
  const [row] = await db
    .select({ id: posts.id, visibility: posts.visibility, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!row) return null;
  if (row.visibility === "private" && row.ownerId !== viewerId) return null;
  return row;
}

// ===== 공감 =====
export async function toggleLike(postId: number) {
  const viewer = await requireMember();
  if (parseId(postId) === null) return;
  const post = await findVisiblePost(postId, viewer.userId);
  if (!post) return;

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewer.userId)))
      .returning({ postId: postLikes.postId });
    if (removed.length) return; // 공감 취소

    await tx.insert(postLikes).values({ postId, userId: viewer.userId });

    // 글 주인에게 보상. 내 글이 아니고, 이 사람에게서 이 글로 받은 적이 없을 때만 (취소 후 재공감 방지)
    if (post.ownerId === viewer.userId) return;
    await lockUser(tx, post.ownerId);
    const refId = `${postId}:${viewer.userId}`;
    const [already] = await tx
      .select({ id: pointLedger.id })
      .from(pointLedger)
      .where(and(eq(pointLedger.userId, post.ownerId), eq(pointLedger.reason, "like_received"), eq(pointLedger.refId, refId)));
    if (!already) await grantReward(tx, post.ownerId, "like_received", refId);
    // 글 주인에게 공감 알림 (GAME-08). 취소했다가 다시 공감해도 한 번만
    if (!(await hasLikeNotification(tx, post.ownerId, viewer.userId, postId))) {
      await notifySocial(tx, { userId: post.ownerId, actorId: viewer.userId, kind: "like", postId });
    }
  });
  revalidatePath("/", "layout");
}

// ===== 댓글 =====
const commentSchema = z.object({
  postId: z.coerce.number().int().positive().max(MAX_DB_INT, "잘못된 요청이에요"),
  parentId: z.coerce.number().int().positive().max(MAX_DB_INT, "잘못된 요청이에요").optional(),
  content: z.string().trim().min(1, "댓글을 적어 주세요").max(1000, "댓글은 1000자까지예요"),
});

export type CommentState = { error?: string; ok?: number };

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const viewer = await requireMember();
  const parsed = commentSchema.safeParse({
    postId: formData.get("postId"),
    parentId: formData.get("parentId") || undefined,
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { postId, parentId, content } = parsed.data;

  const post = await findVisiblePost(postId, viewer.userId);
  if (!post) return { error: "글을 찾을 수 없어요" };

  await db.transaction(async (tx) => {
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
      .values({ postId, authorId: viewer.userId, parentId: parent, content })
      .returning({ id: comments.id });

    // 알림 (GAME-08): 답글이면 그 댓글 작성자에게, 글 주인에게는 댓글 알림 (같은 사람이면 한 번만, 자기 자신은 빼고)
    if (repliedTo) {
      await notifySocial(tx, { userId: repliedTo, actorId: viewer.userId, kind: "reply", postId, refId: created.id });
    }
    if (post.ownerId !== repliedTo) {
      await notifySocial(tx, { userId: post.ownerId, actorId: viewer.userId, kind: "comment", postId, refId: created.id });
    }

    if (post.ownerId !== viewer.userId) {
      await lockUser(tx, viewer.userId);
      await grantReward(tx, viewer.userId, "comment", created.id);
    }
  });
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function deleteComment(commentId: number) {
  const viewer = await requireMember();
  if (parseId(commentId) === null) return;
  // 지울 수 있는 사람: 댓글 작성자, 그 글의 블로그 주인, 관리자 (spec 004 결정, SOC-01)
  const [row] = await db
    .select({ authorId: comments.authorId, ownerId: blogs.ownerId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  if (!row) return;
  const allowed = row.authorId === viewer.userId || row.ownerId === viewer.userId || viewer.user.role === "admin";
  if (!allowed) return;
  // 답글이 남아 있을 수 있어서 행은 두고 삭제 표시만 한다 (표시 규칙은 누가 지웠든 같다, spec 004 FR-008)
  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  revalidatePath("/", "layout");
}

// ===== 이웃 =====
export async function toggleFollow(followeeId: string) {
  const viewer = await requireMember();
  if (followeeId === viewer.userId) return;

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, followeeId)))
    .returning({ id: follows.followeeId });
  if (!removed.length) {
    // 이웃은 블로그가 있는 회원만 (없는 회원·온보딩 전 회원 ID로 조작한 요청은 무시, SOC-04 #22)
    const [target] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, followeeId));
    if (!target) return;
    await db.insert(follows).values({ followerId: viewer.userId, followeeId }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
}

// ===== 즐겨찾는 이웃 (TOWN-08) =====
export type FavoriteResult = { ok: boolean; favorite?: boolean; error?: string };

/** 내 이웃 목록의 ☆/⭐. 이웃(follows 행)이 있어야 하고, 켤 때는 10명을 넘지 않게 회원 잠금 안에서 센다 */
export async function setFavorite(followeeId: string, favorite: boolean): Promise<FavoriteResult> {
  const viewer = await requireMember();
  if (typeof followeeId !== "string" || typeof favorite !== "boolean") return { ok: false };

  const result = await db.transaction(async (tx): Promise<FavoriteResult> => {
    // 같은 회원의 즐겨찾기 요청이 동시에 와도 10명을 넘지 않게 한 줄로 세운다
    await lockUser(tx, viewer.userId);
    const mine = and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, followeeId));
    const [row] = await tx.select({ isFavorite: follows.isFavorite }).from(follows).where(mine);
    if (!row) return { ok: false, error: "이웃으로 추가한 블로그만 즐겨찾기할 수 있어요" };
    if (row.isFavorite === favorite) return { ok: true, favorite };
    if (favorite) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(follows)
        .where(and(eq(follows.followerId, viewer.userId), eq(follows.isFavorite, true)));
      if (n >= MAX_FAVORITES) return { ok: false, favorite: false, error: `즐겨찾기할 이웃은 최대 ${MAX_FAVORITES}명이에요` };
    }
    await tx.update(follows).set({ isFavorite: favorite }).where(mine);
    return { ok: true, favorite };
  });
  if (result.ok) revalidatePath("/", "layout"); // 광장의 집·이웃 새 글 순서가 바뀐다
  return result;
}

// ===== 방문자 수 (BLOG-06) · 조회수 (POST-06) =====
// 방문자도 불러야 해서 requireMember()로 시작하지 않는 예외다 (signUp·signIn처럼, 요구사항 BLOG-06에 기록).
// 화면이 브라우저에 실제로 열렸을 때만(useEffect) 부르므로 링크 미리 불러오기·스크립트를 실행하지 않는 로봇은 세지 않는다.

/** 블로그 홈을 연 사람을 오늘 한 번 센다. 주인이면 세지 않는다(서버에서 다시 확인). 숫자를 돌려준다 */
export async function recordBlogVisit(blogId: number): Promise<{ today: number; total: number } | null> {
  if (parseId(blogId) === null) return null;
  const [blog] = await db.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.id, blogId));
  if (!blog) return null; // 없는 블로그로 조작한 요청은 아무것도 남기지 않는다
  const { key, memberId } = await currentViewerKey();
  if (memberId !== blog.ownerId) await addBlogVisit(blogId, key);
  return getBlogVisitStats(blogId);
}

/** 글 상세를 연 사람을 오늘 한 번 센다 (같은 사람은 하루 1번, 작성자는 세지 않음). 조회수를 돌려준다 */
export async function recordPostView(postId: number): Promise<number | null> {
  if (parseId(postId) === null) return null;
  const [post] = await db
    .select({ visibility: posts.visibility, viewCount: posts.viewCount, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!post) return null;
  const { key, memberId } = await currentViewerKey();
  const isOwner = memberId === post.ownerId;
  if (post.visibility === "private" && !isOwner) return null; // 남의 비공개 글은 404 화면이라 세지 않는다
  if (isOwner) return post.viewCount;
  return addPostView(postId, key);
}
