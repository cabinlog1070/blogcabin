"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { blogs, categories, profiles } from "@/db/schema";
import { DEFAULT_CATEGORY, msg } from "@/lib/i18n";
import { parseId } from "@/lib/ids";
import { ADMIN_NICKNAME, nicknameSchema } from "@/lib/nickname";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { getT } from "@/server/i18n";

export type FormState = { error?: string; ok?: number };

const infoSchema = z.object({
  nickname: nicknameSchema,
  title: z.string().trim().min(1, msg("블로그 이름을 적어 주세요")).max(12, msg("블로그 이름은 12자까지예요")),
  description: z.string().trim().max(160, msg("소개는 160자까지예요")),
  // 상태 메시지 (TOWN-12): 비우면 NULL
  statusMessage: z.string().trim().max(30, msg("상태 메시지는 30자까지예요")).transform((v) => v || null),
});

export async function updateBlogInfo(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const t = await getT();
  const parsed = infoSchema.safeParse({
    nickname: formData.get("nickname") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    statusMessage: formData.get("statusMessage") ?? "",
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0].message) };
  const { nickname, statusMessage, ...info } = parsed.data;
  // 관리자 닉네임은 관리자만 쓴다 (AUTH-08)
  if (nickname === ADMIN_NICKNAME && viewer.user.role !== "admin") return { error: t("이 닉네임은 쓸 수 없어요") };
  try {
    await db.transaction(async (tx) => {
      await tx.update(profiles).set({ nickname, statusMessage }).where(eq(profiles.userId, viewer.userId));
      await tx.update(blogs).set(info).where(eq(blogs.ownerId, viewer.userId));
    });
  } catch (err) {
    if (uniqueViolation(err)?.includes("nickname")) return { error: t("이미 있는 닉네임이에요") };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

const nameSchema = z.string().trim().min(1, msg("카테고리 이름을 적어 주세요")).max(20, msg("카테고리 이름은 20자까지예요"));

export async function addCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const t = await getT();
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: t(name.error.issues[0].message) };
  try {
    await db.insert(categories).values({
      blogId: viewer.profile.blogId,
      name: name.data,
      position: sql`(SELECT COALESCE(MAX(${categories.position}), -1) + 1 FROM ${categories} WHERE ${categories.blogId} = ${viewer.profile.blogId})`,
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) return { error: t("이미 있는 카테고리예요") };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function renameCategory(categoryId: number, name: string): Promise<FormState> {
  const viewer = await requireMember();
  const t = await getT();
  if (parseId(categoryId) === null) return { error: t("잘못된 요청이에요") };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: t(parsed.error.issues[0].message) };
  // 일본어 화면에서 기본 카테고리를 보이는 이름("日常") 그대로 저장하면 기본 이름("일상")으로 둔다 (categoryLabel)
  const newName = parsed.data === t(DEFAULT_CATEGORY) ? DEFAULT_CATEGORY : parsed.data;
  try {
    await db
      .update(categories)
      .set({ name: newName })
      .where(and(eq(categories.id, categoryId), eq(categories.blogId, viewer.profile.blogId)));
  } catch (err) {
    if (uniqueViolation(err) !== null) return { error: t("이미 있는 카테고리예요") };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 글은 남기고 카테고리만 지운다 (posts.category_id → NULL) */
export async function deleteCategory(categoryId: number) {
  const viewer = await requireMember();
  if (parseId(categoryId) === null) return;
  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
}

/** 바로 위/아래 카테고리와 순서를 바꾼다 */
export async function moveCategory(categoryId: number, direction: -1 | 1) {
  const viewer = await requireMember();
  if (parseId(categoryId) === null || (direction !== -1 && direction !== 1)) return;
  await db.transaction(async (tx) => {
    const list = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.blogId, viewer.profile.blogId))
      .orderBy(asc(categories.position), asc(categories.id));
    const i = list.findIndex((c) => c.id === categoryId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // 순서를 0, 1, 2 ... 로 다시 매긴다
    for (const [position, c] of list.entries()) {
      await tx.update(categories).set({ position }).where(eq(categories.id, c.id));
    }
  });
  revalidatePath("/", "layout");
}
