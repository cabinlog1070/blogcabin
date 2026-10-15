import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pointLedger } from "@/db/schema";

// 원장 계산·보상 지급·회원 잠금은 서버 코드(출석 API 등)와 같은 것을 쓴다
export { getWallet, grantReward, lockUser, startOfTodayKST, type RewardResult, type Tx } from "@backend/game/points";

// 친구 초대 보상은 서버(글쓰기 API)와 같은 코드를 쓴다
export { grantInviteReward } from "@backend/game/invite";

// 경험치·코인 내역은 서버(지갑 API)와 같은 코드를 쓴다
export { LEDGER_PAGE_SIZE, listLedger } from "@backend/game/ledger";

// 소셜 연동 보상은 로그인(서버의 Better Auth)·주민 등록·아이디 만들기 API도 부르므로 서버 쪽 코드를 같이 쓴다
export { grantSocialLinkReward, grantSocialLinkRewardsFor, socialAccountHash } from "@backend/auth/social-link-reward";

/** 이 회원이 연동 보상을 받은 소셜 목록 (프로필 메뉴의 +🪙100 표시용) */
export async function rewardedSocialProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ refId: pointLedger.refId })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, "social_link")));
  return rows.map((r) => (r.refId ?? "").split(":")[0]).filter(Boolean);
}
