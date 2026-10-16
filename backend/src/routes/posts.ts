// 글쓰기 (POST-01 새 글, POST-03 고치기, POST-04 지우기, POST-11 예약 발행): /api/v1/posts/…
// 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)으로 돌려주고, 화면이 보는 사람의 언어로 바꾼다
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getMemberBlog } from "../blog/member";
import { attachmentKeysIn, htmlToText, sanitizePostHtml, type KnownAttachments } from "../blog/sanitize";
import { findMentionedBlogs, linkMentions, mentionsInHtml, mentionTargets } from "../blog/mentions";
import { MAX_PIN_HOURS, parseKstInput, SCHEDULE_MAX_DAYS } from "../blog/schedule";
import { db } from "../db";
import { attachments, categories, posts, postTags, tags } from "../db/schema";
import { growForPost } from "../farm/growth";
import { grantInviteReward } from "../game/invite";
import { grantReward, lockUser } from "../game/points";
import { POST_REWARD_MIN_LENGTH } from "../game/rules";
import { BAD_REQUEST, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";
import { notifyMentions } from "../notifications";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
const fail = (error: string, vars?: Vars) => ({ ok: false as const, error, vars });

/** 새 글의 보상 결과: 받았으면 reward, 못 받았으면 그 이유 하나 (글 화면 안내 ?new=…에 쓴다) */
export type PostReward = "reward" | "private" | "short" | "limit";
export type SavePostResult = { ok: true; postId: number; blogSlug: string; reward?: PostReward };

type PostInput = {
  title: string;
  contentHtml: string;
  categoryId: number | null;
  tags: string;
  visibility: "public" | "private";
  publishAt: Date | null;
  pinHours: number;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** 글쓰기 화면이 보낸 값 확인. 틀리면 이유(한국어 문장과 값) */
function readPost(body: Record<string, unknown>): PostInput | ReturnType<typeof fail> {
  const title = str(body.title).trim();
  if (!title) return fail(msg("제목을 적어 주세요"));
  if (title.length > 100) return fail(msg("제목은 100자까지예요"));
  const contentHtml = str(body.contentHtml);
  if (contentHtml.length > 200_000) return fail(msg("글이 너무 길어요"));
  // 글·카테고리 ID가 DB integer 범위 밖이면 쿼리 오류(500)가 나므로 먼저 막는다 (#21)
  const rawCategory = body.categoryId;
  const categoryId = rawCategory === undefined || rawCategory === null || rawCategory === "" ? null : parseId(rawCategory);
  if (rawCategory && categoryId === null) return fail(BAD_REQUEST);
  const tagText = str(body.tags);
  if (tagText.length > 300) return fail(msg("태그는 모두 합쳐 300자까지예요"));
  const visibility = body.visibility ?? "public";
  const publishMode = body.publishMode ?? "now";
  const pinHours = body.pinHours === undefined || body.pinHours === "" ? 0 : Number(body.pinHours);
  if (
    (visibility !== "public" && visibility !== "private") ||
    (publishMode !== "now" && publishMode !== "schedule") ||
    !Number.isInteger(pinHours) ||
    pinHours < 0 ||
    pinHours > MAX_PIN_HOURS
  ) {
    return fail(BAD_REQUEST);
  }

  // 예약 발행 (POST-11): 올라갈 시각을 created_at에 적는다. null이면 지금
  let publishAt: Date | null = null;
  if (publishMode === "schedule") {
    publishAt = parseKstInput(str(body.publishAt).slice(0, 20));
    if (!publishAt) return fail(msg("예약할 날짜와 시간을 골라 주세요"));
    if (publishAt.getTime() <= Date.now()) return fail(msg("예약 시간은 지금보다 뒤로 정해 주세요"));
    if (publishAt.getTime() > Date.now() + SCHEDULE_MAX_DAYS * 86_400_000) {
      return fail(msg("예약은 {n}일 안으로만 할 수 있어요"), { n: SCHEDULE_MAX_DAYS });
    }
  }
  return { title, contentHtml, categoryId, tags: tagText, visibility, publishAt, pinHours };
}

function parseTags(raw: string) {
  const names = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 20);
  return [...new Set(names)].slice(0, 10);
}

/** 본문의 사진·파일은 실제로 올라간 첨부만 남기고, 파일 카드 이름·크기는 DB 값으로 맞춘다 (POST-07, POST-09) */
async function cleanContent(html: string) {
  const keys = attachmentKeysIn(html);
  const known: KnownAttachments = new Map(
    (keys.length
      ? await db
          .select({ key: attachments.key, kind: attachments.kind, name: attachments.name, size: attachments.size })
          .from(attachments)
          .where(inArray(attachments.key, keys))
      : []
    ).map((a) => [a.key, { kind: a.kind as "image" | "file", name: a.name, size: a.size }]),
  );
  // @주소 언급은 있는 블로그만 링크로 바꾸고, 그 주인들을 알림 받을 후보로 돌려준다
  const sanitized = sanitizePostHtml(html, known);
  const mentioned = await findMentionedBlogs(mentionsInHtml(sanitized));
  const contentHtml = linkMentions(sanitized, new Set(mentioned.keys()));
  return { contentHtml, contentText: htmlToText(contentHtml), mentionedUsers: [...mentioned.values()] };
}

/** 새 글 저장 또는 내 글 고치기 (postId). 없거나 내 글이 아니면 null */
async function savePost(userId: string, postId: number | null, body: Record<string, unknown>) {
  const me = await getMemberBlog(userId);
  if (!me) return fail(BAD_REQUEST);
  const input = readPost(body);
  if ("ok" in input) return input;
  const isAdmin = me.role === "admin";
  // 광장 게시판 게시 시간은 관리자 글만. 회원 글은 늘 0 (걸리지 않음)
  const pinHours = isAdmin ? input.pinHours : 0;

  const { contentHtml, contentText, mentionedUsers } = await cleanContent(input.contentHtml);
  if (!contentText) return fail(msg("본문을 적어 주세요"));

  const blogId = me.blogId;
  const tagNames = parseTags(input.tags);
  let reward: PostReward | undefined;

  const id = await db.transaction(async (tx) => {
    await lockUser(tx, userId);

    // 카테고리는 내 블로그 것만 (다른 블로그의 카테고리 ID를 보내도 무시)
    let categoryId: number | null = null;
    if (input.categoryId) {
      const [cat] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.blogId, blogId)));
      categoryId = cat?.id ?? null;
    }

    let id: number;
    let published = !input.publishAt; // 언급 알림은 지금 올라가 있는 글만
    if (postId) {
      // 수정: 내 블로그의 글인지 확인
      const [current] = await tx
        .select({ scheduled: sql<boolean>`${posts.createdAt} > now()` })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
      if (!current) return null;
      // 아직 안 올라간 예약 글만 시각을 바꾸거나 지금 올릴 수 있다. 이미 올라간 글의 시각은 그대로
      const createdAt = current.scheduled ? (input.publishAt ?? sql`now()`) : undefined;
      if (!current.scheduled) published = true;
      const [updated] = await tx
        .update(posts)
        .set({ title: input.title, contentHtml, contentText, categoryId, visibility: input.visibility, createdAt, ...(isAdmin ? { pinHours } : {}) })
        .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)))
        .returning({ id: posts.id });
      if (!updated) return null;
      id = updated.id;
    } else {
      const [created] = await tx
        .insert(posts)
        .values({
          blogId,
          title: input.title,
          contentHtml,
          contentText,
          categoryId,
          visibility: input.visibility,
          pinHours,
          ...(input.publishAt ? { createdAt: input.publishAt } : {}),
        })
        .returning({ id: posts.id });
      id = created.id;

      // 새 공개 글이 충분히 길면 보상 (하루 상한은 grantReward가 확인). 예약 글도 예약한 날 저장할 때 준다
      if (input.visibility === "private") reward = "private";
      else if (contentText.length < POST_REWARD_MIN_LENGTH) reward = "short";
      else {
        const rewarded = (await grantReward(tx, userId, "post", id)).granted;
        reward = rewarded ? "reward" : "limit";
        // 글쓰기 보상을 받으면 농장에서 키우는 동물도 함께 자란다 (TOWN-09)
        if (rewarded) await growForPost(tx, userId);
        // 초대받아 가입한 회원의 첫 보상 조건 글이면 나와 초대한 사람에게 초대 보상 (GAME-09, 하루 상한과 상관없음)
        await grantInviteReward(tx, userId);
      }
    }

    // 본문에서 @주소로 언급한 회원에게 알림 (고쳐 저장하면 새로 언급한 사람에게만)
    const mentionUsers = await mentionTargets({ visibility: input.visibility, ownerId: userId, published }, mentionedUsers);
    await notifyMentions(tx, { userIds: mentionUsers, actorId: userId, postId: id });

    // 태그: 없는 태그는 만들고, 글과의 연결을 새로 맞춘다
    if (tagNames.length) {
      await tx.insert(tags).values(tagNames.map((name) => ({ name }))).onConflictDoNothing();
    }
    const tagRows = tagNames.length
      ? await tx.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.name, tagNames))
      : [];
    const tagIds = tagRows.map((row) => row.id);
    await tx
      .delete(postTags)
      .where(and(eq(postTags.postId, id), tagIds.length ? notInArray(postTags.tagId, tagIds) : undefined));
    if (tagIds.length) {
      // 적은 순서를 position에 적는다 (이미 있던 연결도 순서를 새로 맞춘다)
      await tx
        .insert(postTags)
        .values(tagRows.map((row) => ({ postId: id, tagId: row.id, position: tagNames.indexOf(row.name) })))
        .onConflictDoUpdate({ target: [postTags.postId, postTags.tagId], set: { position: sql`excluded.position` } });
    }
    return id;
  });

  if (id === null) return null;
  const result: SavePostResult = { ok: true, postId: id, blogSlug: me.blogSlug, reward };
  return result;
}

export const postRoutes = new Hono<GuardEnv>()
  .use(requireViewer("member"))
  /** 새 글: { title, contentHtml, categoryId?, tags, visibility, publishMode, publishAt, pinHours } */
  .post("/", async (c) => {
    const result = await savePost(c.get("viewer").userId, null, await readJson(c));
    if (!result) return c.json(fail(BAD_REQUEST), 400);
    return c.json(result, result.ok ? 200 : 400);
  })
  /** 내 글 고치기: 새 글과 같은 값 */
  .put("/:id", async (c) => {
    const postId = parseId(c.req.param("id"));
    if (postId === null) return c.json(fail(BAD_REQUEST), 400);
    const result = await savePost(c.get("viewer").userId, postId, await readJson(c));
    if (!result) return c.json(fail(msg("글을 찾을 수 없어요")), 404);
    return c.json(result, result.ok ? 200 : 400);
  })
  /** 내 글 지우기 (댓글·공감도 함께 지워진다). 끝나면 화면이 내 블로그 홈으로 간다 */
  .delete("/:id", async (c) => {
    const postId = parseId(c.req.param("id"));
    const me = await getMemberBlog(c.get("viewer").userId);
    if (postId === null || !me) return c.json(fail(BAD_REQUEST), 400);
    await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, me.blogId)));
    return c.json({ ok: true, blogSlug: me.blogSlug });
  });
