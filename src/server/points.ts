import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, items, pointLedger, profiles, socialLinkRewards } from "@/db/schema";
import { INVITE_REWARD_COINS } from "@/lib/invite";
import { levelProgress, REWARD_RULES, SOCIAL_LINK_REWARD_COINS, SOCIAL_PROVIDERS, type RewardReason } from "@/lib/game";
import { recordLevelUps } from "@/server/notifications";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** 한국 시간 기준 오늘 0시 (timestamptz) */
export const startOfTodayKST = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')`;

/**
 * 같은 회원의 보상·구매가 동시에 처리되지 않도록 트랜잭션 동안 회원 단위로 잠근다.
 * (버튼을 연달아 눌러도 하루 상한이나 잔액 확인이 어긋나지 않게)
 */
export async function lockUser(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
}

/** 원장 합계로 계산한 코인·경험치·레벨 */
export async function getWallet(userId: string, executor: Executor = db) {
  const [row] = await executor
    .select({
      coins: sql<number>`COALESCE(SUM(${pointLedger.coinDelta}), 0)::int`,
      exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int`,
    })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return { coins: row.coins, exp: row.exp, ...levelProgress(row.exp) };
}

export type RewardResult = { granted: false } | { granted: true; exp: number; coins: number };

/**
 * 활동 보상 지급. 오늘 같은 사유로 이미 상한만큼 받았으면 지급하지 않는다.
 * 반드시 lockUser를 건 트랜잭션 안에서 호출한다. 레벨이 오르면 level_up 알림도 같은 트랜잭션에서 만든다.
 */
export async function grantReward(
  tx: Tx,
  userId: string,
  reason: RewardReason,
  refId?: string | number,
): Promise<RewardResult> {
  const rule = REWARD_RULES[reason];
  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(pointLedger)
    .where(
      and(
        eq(pointLedger.userId, userId),
        eq(pointLedger.reason, reason),
        gte(pointLedger.createdAt, startOfTodayKST),
      ),
    );
  if (count >= rule.dailyLimit) return { granted: false };

  await tx.insert(pointLedger).values({
    userId,
    reason,
    expDelta: rule.exp,
    coinDelta: rule.coins,
    refId: refId === undefined ? null : String(refId),
  });
  // 레벨이 올랐으면 알림함에 레벨업 알림을 남긴다 → 다음 화면에서 팝업 (GAME-06)
  await recordLevelUps(tx, userId, rule.exp);
  return { granted: true, exp: rule.exp, coins: rule.coins };
}

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

/**
 * 소셜 로그인 연동 보상: 주민(프로필 있는 회원)이 카카오·네이버·구글을 연동하면 🪙 100 (경험치 없음).
 * - 한 회원은 같은 소셜로 한 번만 (기록이 있으면 주지 않음)
 * - 같은 소셜 계정(ref_id = "kakao:회원번호")은 사이트 전체에서 한 번만. 탈퇴하면 원장이 회원과 함께 지워지므로
 *   준 기록은 users를 가리키지 않는 social_link_rewards에 남겨 두고 그것으로 막는다 (탈퇴 후 다시 붙여도 0)
 * 반환: 실제로 줬으면 true
 */
/** 소셜 계정 번호를 남기지 않고 같은 계정인지만 알 수 있는 값 (사이트 비밀키로 만든 HMAC-SHA256 hex) */
export function socialAccountHash(providerId: string, accountId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET이 없어요");
  return createHmac("sha256", secret).update(`${providerId}:${accountId}`).digest("hex");
}

export async function grantSocialLinkReward(userId: string, providerId: string, accountId: string): Promise<boolean> {
  if (!(SOCIAL_PROVIDERS as readonly string[]).includes(providerId)) return false;
  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId));
    if (!profile) return false; // 아직 주민 등록 전 (소셜 버튼으로 처음 가입하는 중)
    await lockUser(tx, userId);
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
