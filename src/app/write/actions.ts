"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { attachments, categories, posts, postTags, tags } from "@/db/schema";
import { POST_REWARD_MIN_LENGTH } from "@/lib/game";
import { msg } from "@/lib/i18n";
import { parseId } from "@/lib/ids";
import { MAX_PIN_HOURS, parseKstInput, SCHEDULE_MAX_DAYS } from "@/lib/schedule";
import { requireMember } from "@/server/dal";
import { growForPost } from "@/server/farm";
import { getT } from "@/server/i18n";
import { grantInviteReward, grantReward, lockUser } from "@/server/points";
import { attachmentKeysIn, htmlToText, sanitizePostHtml, type KnownAttachments } from "@/server/sanitize";

const schema = z.object({
  postId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1, msg("제목을 적어 주세요")).max(100, msg("제목은 100자까지예요")),
  contentHtml: z.string().max(200_000, msg("글이 너무 길어요")),
  categoryId: z.coerce.number().int().positive().optional(),
  tags: z.string().max(300, msg("태그는 모두 합쳐 300자까지예요")),
  visibility: z.enum(["public", "private"]),
  publishMode: z.enum(["now", "schedule"]),
  publishAt: z.string().max(20),
  pinHours: z.coerce.number().int().min(0).max(MAX_PIN_HOURS),
});

// 오류가 나면 입력값을 돌려준다. React 19는 폼 액션 뒤 입력칸을 처음 값으로 되돌리므로 (POST-01, #16)
export type SavePostState = {
  error?: string;
  values?: { title: string; categoryId: string; tags: string };
};

function parseTags(raw: string) {
  const names = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 20);
  return [...new Set(names)].slice(0, 10);
}

export async function savePost(_prev: SavePostState, formData: FormData): Promise<SavePostState> {
  const viewer = await requireMember();
  const t = await getT();
  const values = {
    title: String(formData.get("title") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    tags: String(formData.get("tags") ?? ""),
  };
  const parsed = schema.safeParse({
    postId: formData.get("postId") || undefined,
    title: formData.get("title") ?? "",
    contentHtml: formData.get("contentHtml") ?? "",
    categoryId: formData.get("categoryId") || undefined,
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") ?? "public",
    publishMode: formData.get("publishMode") ?? "now",
    publishAt: formData.get("publishAt") ?? "",
    pinHours: formData.get("pinHours") || 0,
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0].message), values };
  const input = parsed.data;
  const isAdmin = viewer.user.role === "admin";
  // 광장 게시판 게시 시간은 관리자 글만. 회원 글은 늘 0 (걸리지 않음)
  const pinHours = isAdmin ? input.pinHours : 0;

  // 예약 발행 (POST-11): 올라갈 시각을 created_at에 적는다. null이면 지금
  let publishAt: Date | null = null;
  if (input.publishMode === "schedule") {
    publishAt = parseKstInput(input.publishAt);
    if (!publishAt) return { error: t("예약할 날짜와 시간을 골라 주세요"), values };
    if (publishAt.getTime() <= Date.now()) return { error: t("예약 시간은 지금보다 뒤로 정해 주세요"), values };
    if (publishAt.getTime() > Date.now() + SCHEDULE_MAX_DAYS * 86_400_000) {
      return { error: t("예약은 {n}일 안으로만 할 수 있어요", { n: SCHEDULE_MAX_DAYS }), values };
    }
  }
  // 글·카테고리 ID가 DB integer 범위 밖이면 쿼리 오류(500)가 나므로 먼저 막는다 (#21)
  if ((input.postId && parseId(input.postId) === null) || (input.categoryId && parseId(input.categoryId) === null)) {
    return { error: t("잘못된 요청이에요"), values };
  }

  // 본문의 사진·파일은 실제로 올라간 첨부만 남기고, 파일 카드 이름·크기는 DB 값으로 맞춘다 (POST-07, POST-09)
  const keys = attachmentKeysIn(input.contentHtml);
  const known: KnownAttachments = new Map(
    (keys.length
      ? await db
          .select({ key: attachments.key, kind: attachments.kind, name: attachments.name, size: attachments.size })
          .from(attachments)
          .where(inArray(attachments.key, keys))
      : []
    ).map((a) => [a.key, { kind: a.kind as "image" | "file", name: a.name, size: a.size }]),
  );
  const contentHtml = sanitizePostHtml(input.contentHtml, known);
  const contentText = htmlToText(contentHtml);
  if (!contentText) return { error: t("본문을 적어 주세요"), values };

  const blogId = viewer.profile.blogId;
  const tagNames = parseTags(input.tags);

  // 새 글의 보상 결과: 받았으면 reward, 못 받았으면 그 이유 하나 (글 화면 안내에 쓴다)
  let rewardResult: "reward" | "private" | "short" | "limit" = "reward";
  const postId = await db.transaction(async (tx) => {
    await lockUser(tx, viewer.userId);

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
    if (input.postId) {
      // 수정: 내 블로그의 글인지 확인
      const [current] = await tx
        .select({ scheduled: sql<boolean>`${posts.createdAt} > now()` })
        .from(posts)
        .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)));
      if (!current) throw new Error("NOT_FOUND");
      // 아직 안 올라간 예약 글만 시각을 바꾸거나 지금 올릴 수 있다. 이미 올라간 글의 시각은 그대로
      const createdAt = current.scheduled ? (publishAt ?? sql`now()`) : undefined;
      const [updated] = await tx
        .update(posts)
        .set({ title: input.title, contentHtml, contentText, categoryId, visibility: input.visibility, createdAt, ...(isAdmin ? { pinHours } : {}) })
        .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)))
        .returning({ id: posts.id });
      if (!updated) throw new Error("NOT_FOUND");
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
          ...(publishAt ? { createdAt: publishAt } : {}),
        })
        .returning({ id: posts.id });
      id = created.id;

      // 새 공개 글이 충분히 길면 보상 (하루 상한은 grantReward가 확인). 예약 글도 예약한 날 저장할 때 준다
      if (input.visibility === "private") rewardResult = "private";
      else if (contentText.length < POST_REWARD_MIN_LENGTH) rewardResult = "short";
      else {
        const rewarded = (await grantReward(tx, viewer.userId, "post", id)).granted;
        rewardResult = rewarded ? "reward" : "limit";
        // 글쓰기 보상을 받으면 농장에서 키우는 동물도 함께 자란다 (TOWN-09)
        if (rewarded) await growForPost(tx, viewer.userId);
        // 초대받아 가입한 회원의 첫 보상 조건 글이면 나와 초대한 사람에게 초대 보상 (GAME-09, 하루 상한과 상관없음)
        await grantInviteReward(tx, viewer.userId);
      }
    }

    // 태그: 없는 태그는 만들고, 글과의 연결을 새로 맞춘다
    if (tagNames.length) {
      await tx.insert(tags).values(tagNames.map((name) => ({ name }))).onConflictDoNothing();
    }
    const tagRows = tagNames.length
      ? await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, tagNames))
      : [];
    const tagIds = tagRows.map((row) => row.id);
    await tx
      .delete(postTags)
      .where(and(eq(postTags.postId, id), tagIds.length ? notInArray(postTags.tagId, tagIds) : undefined));
    if (tagIds.length) {
      await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId }))).onConflictDoNothing();
    }
    return id;
  });

  revalidatePath("/", "layout");
  const query = input.postId ? "" : `?new=${rewardResult}`;
  redirect(`/@${viewer.profile.blogSlug}/${postId}${query}`);
}

export async function deletePost(postId: number) {
  const viewer = await requireMember();
  if (parseId(postId) === null) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
  redirect(`/@${viewer.profile.blogSlug}`);
}
