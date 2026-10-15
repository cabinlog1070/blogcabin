// 내 블로그 관리 (BLOG-03 기본 정보, BLOG-04 카테고리): /api/v1/my-blog/…
// 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)으로 돌려주고, 화면이 보는 사람의 언어로 바꾼다
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getMemberBlog } from "../blog/member";
import { ADMIN_BLOG_TITLE, ADMIN_NICKNAME, nicknameError } from "../blog/profile-rules";
import { hasEmoji, STATUS_MESSAGE_MAX } from "../blog/status-message";
import { db } from "../db";
import { blogs, categories, profiles } from "../db/schema";
import { BAD_REQUEST, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { uniqueViolation } from "../lib/db-errors";
import { parseId } from "../lib/ids";

const msg = <S extends string>(text: S): S => text;
const fail = (error: string) => ({ ok: false as const, error });
const text = (raw: unknown) => (typeof raw === "string" ? raw.trim() : "");

/** 카테고리 이름: 1~20자. 틀리면 이유(한국어 문장) */
function categoryNameError(name: string) {
  if (!name) return msg("카테고리 이름을 적어 주세요");
  if (name.length > 20) return msg("카테고리 이름은 20자까지예요");
  return null;
}

export const myBlogRoutes = new Hono<GuardEnv>()
  .use(requireViewer("member"))
  /** 기본 정보 저장: { nickname, title, description, statusMessage } */
  .put("/info", async (c) => {
    const { userId } = c.get("viewer");
    const me = await getMemberBlog(userId);
    if (!me) return c.json(fail(BAD_REQUEST), 400);
    const isAdmin = me.role === "admin";
    const body = await readJson(c);
    const nickname = text(body.nickname);
    // 관리자 블로그 이름은 고정이라 보낸 값을 받지 않는다 (예전에 바꿔 둔 이름도 저장할 때 원래 이름으로 돌린다)
    const title = isAdmin ? ADMIN_BLOG_TITLE : text(body.title);
    const description = text(body.description);
    // 상태 메시지 (TOWN-12): 비우면 NULL. 이모티콘은 광장 말풍선에서 깨져서 받지 않는다
    const statusMessage = text(body.statusMessage);

    const error =
      nicknameError(nickname) ??
      (!title ? msg("블로그 이름을 적어 주세요") : null) ??
      (!isAdmin && title.length > 12 ? msg("블로그 이름은 12자까지예요") : null) ??
      (description.length > 160 ? msg("소개는 160자까지예요") : null) ??
      (statusMessage.length > STATUS_MESSAGE_MAX ? msg("상태 메시지는 30자까지예요") : null) ??
      (hasEmoji(statusMessage) ? msg("상태 메시지에는 이모티콘을 쓸 수 없어요") : null) ??
      // 관리자 닉네임은 관리자만 쓴다 (AUTH-08)
      (nickname === ADMIN_NICKNAME && !isAdmin ? msg("이 닉네임은 쓸 수 없어요") : null);
    if (error) return c.json(fail(error), 400);

    try {
      await db.transaction(async (tx) => {
        await tx.update(profiles).set({ nickname, statusMessage: statusMessage || null }).where(eq(profiles.userId, userId));
        await tx.update(blogs).set({ title, description }).where(eq(blogs.ownerId, userId));
      });
    } catch (err) {
      if (uniqueViolation(err)?.includes("nickname")) return c.json(fail(msg("이미 있는 닉네임이에요")), 409);
      throw err;
    }
    return c.json({ ok: true });
  })
  /** 카테고리 추가: { name }. 맨 아래에 붙는다 */
  .post("/categories", async (c) => {
    const { userId } = c.get("viewer");
    const me = await getMemberBlog(userId);
    if (!me) return c.json(fail(BAD_REQUEST), 400);
    const name = text((await readJson(c)).name);
    const error = categoryNameError(name);
    if (error) return c.json(fail(error), 400);
    try {
      await db.insert(categories).values({
        blogId: me.blogId,
        name,
        position: sql`(SELECT COALESCE(MAX(${categories.position}), -1) + 1 FROM ${categories} WHERE ${categories.blogId} = ${me.blogId})`,
      });
    } catch (err) {
      if (uniqueViolation(err) !== null) return c.json(fail(msg("이미 있는 카테고리예요")), 409);
      throw err;
    }
    return c.json({ ok: true });
  })
  /** 카테고리 이름 바꾸기: { name } (일본어 화면의 기본 이름 "日常"은 화면이 "일상"으로 바꿔 보낸다) */
  .put("/categories/:id", async (c) => {
    const { userId } = c.get("viewer");
    const categoryId = parseId(c.req.param("id"));
    const me = await getMemberBlog(userId);
    if (categoryId === null || !me) return c.json(fail(BAD_REQUEST), 400);
    const name = text((await readJson(c)).name);
    const error = categoryNameError(name);
    if (error) return c.json(fail(error), 400);
    try {
      await db
        .update(categories)
        .set({ name })
        .where(and(eq(categories.id, categoryId), eq(categories.blogId, me.blogId)));
    } catch (err) {
      if (uniqueViolation(err) !== null) return c.json(fail(msg("이미 있는 카테고리예요")), 409);
      throw err;
    }
    return c.json({ ok: true });
  })
  /** 카테고리 지우기: 글은 남기고 카테고리만 지운다 (posts.category_id → NULL) */
  .delete("/categories/:id", async (c) => {
    const { userId } = c.get("viewer");
    const categoryId = parseId(c.req.param("id"));
    const me = await getMemberBlog(userId);
    if (categoryId === null || !me) return c.json(fail(BAD_REQUEST), 400);
    await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.blogId, me.blogId)));
    return c.json({ ok: true });
  })
  /** 바로 위(-1)/아래(1) 카테고리와 순서를 바꾼다: { direction } */
  .post("/categories/:id/move", async (c) => {
    const { userId } = c.get("viewer");
    const categoryId = parseId(c.req.param("id"));
    const direction = (await readJson(c)).direction;
    const me = await getMemberBlog(userId);
    if (categoryId === null || !me || (direction !== -1 && direction !== 1)) return c.json(fail(BAD_REQUEST), 400);
    await db.transaction(async (tx) => {
      const list = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.blogId, me.blogId))
        .orderBy(asc(categories.position), asc(categories.id));
      const i = list.findIndex((x) => x.id === categoryId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // 순서를 0, 1, 2 ... 로 다시 매긴다
      for (const [position, x] of list.entries()) {
        await tx.update(categories).set({ position }).where(eq(categories.id, x.id));
      }
    });
    return c.json({ ok: true });
  });
