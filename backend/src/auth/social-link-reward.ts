import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { pointLedger, profiles, socialLinkRewards } from "../db/schema";
import { SOCIAL_LINK_REWARD_COINS, SOCIAL_PROVIDERS } from "./social-providers";

/** 소셜 계정 번호를 남기지 않고 같은 계정인지만 알 수 있는 값 (사이트 비밀키로 만든 HMAC-SHA256 hex) */
export function socialAccountHash(providerId: string, accountId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET이 없어요");
  return createHmac("sha256", secret).update(`${providerId}:${accountId}`).digest("hex");
}

/**
 * 소셜 로그인 연동 보상: 주민(프로필 있는 회원)이 카카오·네이버·구글을 연동하면 🪙 100 (경험치 없음).
 * - 한 회원은 같은 소셜로 한 번만 (기록이 있으면 주지 않음)
 * - 같은 소셜 계정(ref_id = "kakao:회원번호")은 사이트 전체에서 한 번만. 탈퇴하면 원장이 회원과 함께 지워지므로
 *   준 기록은 users를 가리키지 않는 social_link_rewards에 남겨 두고 그것으로 막는다 (탈퇴 후 다시 붙여도 0)
 * 로그인(Better Auth)의 연동 훅과 화면의 아이디 만들기·합치기에서 부른다. 반환: 실제로 줬으면 true
 */
export async function grantSocialLinkReward(userId: string, providerId: string, accountId: string): Promise<boolean> {
  if (!(SOCIAL_PROVIDERS as readonly string[]).includes(providerId)) return false;
  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId));
    if (!profile) return false; // 아직 주민 등록 전 (소셜 버튼으로 처음 가입하는 중)
    // 같은 회원의 보상·구매가 동시에 처리되지 않게 회원 단위로 잠근다 (화면의 lockUser와 같은 잠금)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [already] = await tx
      .select({ id: pointLedger.id })
      .from(pointLedger)
      .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, "social_link"), sql`${pointLedger.refId} LIKE ${`${providerId}:%`}`));
    if (already) return false;
    // 이 소셜 계정으로 받은 적이 있으면(받은 회원이 탈퇴했어도) 주지 않는다. 동시에 들어와도 기본 키가 한 번만 통과시킨다
    const claimed = await tx
      .insert(socialLinkRewards)
      .values({ providerId, accountHash: socialAccountHash(providerId, accountId) })
      .onConflictDoNothing()
      .returning({ providerId: socialLinkRewards.providerId });
    if (!claimed.length) return false;
    const inserted = await tx
      .insert(pointLedger)
      .values({ userId, reason: "social_link", coinDelta: SOCIAL_LINK_REWARD_COINS, refId: `${providerId}:${accountId}` })
      .onConflictDoNothing()
      .returning({ id: pointLedger.id });
    return inserted.length > 0;
  });
}
