"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { comments, notifications, pointLedger, posts, profiles, users } from "@/db/schema";
import { ADMIN_MAX_COINS, expForLevel, levelFromExp, MAX_LEVEL } from "@/lib/game";
import { msg } from "@/lib/i18n";
import { parseId } from "@/lib/ids";
import { requireAdmin } from "@/server/dal";
import { getT } from "@/server/i18n";
import { getWallet, lockUser } from "@/server/points";
import { deleteMember } from "@/server/withdraw";

/** 관리자: 어느 블로그의 글이든 삭제 */
export async function adminDeletePost(postId: number) {
  await requireAdmin();
  if (parseId(postId) === null) return;
  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

/** 관리자: 누구의 댓글이든 삭제 (회원이 지울 때와 같은 규칙, 답글이 남으면 "삭제된 댓글" 자리로 남는다) */
export async function adminDeleteComment(commentId: number) {
  await requireAdmin();
  if (parseId(commentId) === null) return;
  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  revalidatePath("/", "layout");
}

export type WithdrawMemberState = { error?: string };

/**
 * 관리자 강제 탈퇴: 회원이 스스로 탈퇴할 때와 똑같이 지운다 (deleteMember, AUTH-06).
 * 세션도 함께 지워져서 그 회원은 바로 로그아웃된다. 관리자 계정과 나 자신은 강제 탈퇴할 수 없다.
 */
export async function adminWithdrawMember(_: WithdrawMemberState, formData: FormData): Promise<WithdrawMemberState> {
  const admin = await requireAdmin();
  const t = await getT();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: t("회원을 찾지 못했어요") };
  if (userId === admin.userId) return { error: t("내 계정은 여기서 탈퇴할 수 없어요") };
  const [target] = await db
    .select({ role: users.role, username: users.username, nickname: profiles.nickname })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!target) return { error: t("이미 탈퇴한 회원이에요") };
  if (target.role === "admin") return { error: t("관리자 계정은 강제 탈퇴할 수 없어요") };

  await deleteMember(userId);
  revalidatePath("/", "layout");
  redirect(`/admin/members?withdrawn=${encodeURIComponent(target.nickname ?? target.username ?? t("회원"))}`);
}

export type GrantState = { error?: string; ok?: string };

const grantSchema = z.object({
  userId: z.string().min(1, msg("회원을 골라 주세요")),
  coins: z.coerce.number().int().min(0, msg("코인은 0 이상")).max(10_000_000, msg("코인은 한 번에 1,000만까지")),
  exp: z.coerce.number().int().min(0, msg("경험치는 0 이상")).max(10_000_000, msg("경험치는 한 번에 1,000만까지")),
  maxCoins: z.boolean(),
  maxExp: z.boolean(),
});

/**
 * 관리자 지급: 회원에게 코인·경험치를 준다 (원장 사유 admin_grant, ref_id = 준 관리자).
 * [코인 최대]는 잔액을 ADMIN_MAX_COINS까지, [경험치 최대]는 최고 레벨(Lv.99)이 되는 경험치까지 채운다.
 * 레벨이 오르면 마지막 레벨의 레벨업 알림 하나만 남긴다 (한 번에 여러 레벨이 올라도 알림함이 넘치지 않게)
 */
export async function adminGrant(_: GrantState, formData: FormData): Promise<GrantState> {
  const admin = await requireAdmin();
  const t = await getT();
  const parsed = grantSchema.safeParse({
    userId: formData.get("userId") ?? "",
    coins: formData.get("coins") || 0,
    exp: formData.get("exp") || 0,
    maxCoins: formData.get("maxCoins") === "on",
    maxExp: formData.get("maxExp") === "on",
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? msg("입력값을 확인해 주세요")) };
  const input = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [member] = await tx.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, input.userId));
    if (!member) return { error: t("주민을 찾지 못했어요") };
    await lockUser(tx, input.userId);
    const before = await getWallet(input.userId, tx);
    const coinDelta = input.maxCoins ? Math.max(0, ADMIN_MAX_COINS - before.coins) : input.coins;
    const expDelta = input.maxExp ? Math.max(0, expForLevel(MAX_LEVEL) - before.exp) : input.exp;
    if (coinDelta === 0 && expDelta === 0) return { error: t("줄 코인·경험치가 없어요 (이미 최대일 수 있어요)") };

    await tx.insert(pointLedger).values({ userId: input.userId, reason: "admin_grant", coinDelta, expDelta, refId: admin.userId });
    const after = levelFromExp(before.exp + expDelta);
    if (after > before.level) {
      await tx.insert(notifications).values({ userId: input.userId, kind: "level_up", level: after }).onConflictDoNothing();
    }
    const parts = [coinDelta ? `🪙 ${coinDelta.toLocaleString()}` : "", expDelta ? t("경험치 {n}", { n: expDelta.toLocaleString() }) : ""].filter(Boolean);
    return {
      ok: t("{nickname}님에게 {rewards}을 줬어요 (Lv.{level}, 🪙 {coins})", {
        nickname: member.nickname,
        rewards: parts.join(", "),
        level: after,
        coins: (before.coins + coinDelta).toLocaleString(),
      }),
    };
  });

  revalidatePath("/", "layout");
  return result;
}
