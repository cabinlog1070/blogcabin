import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, items, pointLedger } from "@/db/schema";
import { grantSocialLinkReward } from "@backend/auth/social-link-reward";

// 원장 계산·보상 지급·회원 잠금은 서버 코드(출석 API 등)와 같은 것을 쓴다
export { getWallet, grantReward, lockUser, startOfTodayKST, type RewardResult, type Tx } from "@backend/game/points";

// 친구 초대 보상은 서버(글쓰기 API)와 같은 코드를 쓴다
export { grantInviteReward } from "@backend/game/invite";

export const LEDGER_PAGE_SIZE = 20;

/** 경험치·코인 내역 (GAME-07): 최신순, 구매는 아이템 이름을 붙인다 */
export async function listLedger(userId: string, page: number) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  const rows = await db
    .select({
      id: pointLedger.id,
      reason: pointLedger.reason,
      expDelta: pointLedger.expDelta,
      coinDelta: pointLedger.coinDelta,
      createdAt: pointLedger.createdAt,
      itemName: items.name,
    })
    .from(pointLedger)
    .leftJoin(items, and(eq(pointLedger.reason, "purchase"), sql`${items.id}::text = ${pointLedger.refId}`))
    .where(eq(pointLedger.userId, userId))
    .orderBy(desc(pointLedger.createdAt), desc(pointLedger.id))
    .limit(LEDGER_PAGE_SIZE)
    .offset((page - 1) * LEDGER_PAGE_SIZE);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)) };
}

// 소셜 연동 보상은 로그인(서버의 Better Auth)도 부르므로 서버 쪽 코드를 같이 쓴다
export { grantSocialLinkReward, socialAccountHash } from "@backend/auth/social-link-reward";

/**
 * 이 회원에 붙은 소셜 계정(google·kakao·naver)마다 grantSocialLinkReward를 부른다.
 * 소셜로 처음 가입한 회원이 주민 등록을 마칠 때, 아이디를 만들거나 기존 아이디에 합칠 때 쓴다. 반환: 실제로 받은 소셜 목록
 */
export async function grantSocialLinkRewardsFor(userId: string): Promise<string[]> {
  const rows = await db
    .select({ providerId: accounts.providerId, accountId: accounts.accountId })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const granted: string[] = [];
  for (const r of rows) if (await grantSocialLinkReward(userId, r.providerId, r.accountId)) granted.push(r.providerId);
  return granted;
}

/** 이 회원이 연동 보상을 받은 소셜 목록 (프로필 메뉴의 +🪙100 표시용) */
export async function rewardedSocialProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ refId: pointLedger.refId })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, "social_link")));
  return rows.map((r) => (r.refId ?? "").split(":")[0]).filter(Boolean);
}
