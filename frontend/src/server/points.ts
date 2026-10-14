import "server-only";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, items, pointLedger, profiles } from "@/db/schema";
import { INVITE_REWARD_COINS } from "@/lib/invite";
import { grantSocialLinkReward } from "@backend/auth/social-link-reward";
import { lockUser, type Tx } from "@backend/game/points";

// 원장 계산·보상 지급·회원 잠금은 서버 코드(출석 API 등)와 같은 것을 쓴다
export { getWallet, grantReward, lockUser, startOfTodayKST, type RewardResult, type Tx } from "@backend/game/points";

/**
 * 친구 초대 보상 (GAME-09): 초대받아 가입한 친구가 보상 조건(새 글·공개·본문 100자 이상)을 채운 첫 글을 저장할 때
 * 친구와 초대한 사람에게 🪙 50씩(경험치 없음) 한 번 준다. 하루 상한·전체 횟수 제한은 없다.
 * - 한 번만: profiles.invite_rewarded_at을 NULL → 지금으로 바꾸는 UPDATE가 성공한 요청만 지급한다 (동시에 글 여러 개를 저장해도 1번)
 * - 친구가 탈퇴하면 글을 쓸 수 없으니 지급되지 않고, 초대한 사람이 탈퇴했으면(invited_by가 비워짐) 둘 다 받지 않는다
 * 반드시 친구(friendId)를 lockUser로 잠근 트랜잭션 안에서 부른다. 초대한 사람도 여기서 잠근다 (잠금 순서: 친구 → 초대한 사람)
 */
export async function grantInviteReward(tx: Tx, friendId: string): Promise<boolean> {
  const [row] = await tx
    .update(profiles)
    .set({ inviteRewardedAt: new Date() })
    .where(and(eq(profiles.userId, friendId), isNotNull(profiles.invitedBy), isNull(profiles.inviteRewardedAt)))
    .returning({ inviterId: profiles.invitedBy });
  if (!row?.inviterId) return false;
  await lockUser(tx, row.inviterId);
  await tx.insert(pointLedger).values([
    { userId: friendId, reason: "invited", coinDelta: INVITE_REWARD_COINS, refId: row.inviterId },
    { userId: row.inviterId, reason: "invite", coinDelta: INVITE_REWARD_COINS, refId: friendId },
  ]);
  return true;
}

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
