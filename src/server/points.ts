import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, pointLedger, profiles } from "@/db/schema";
import { INVITE_REWARD_COINS } from "@/lib/invite";
import { levelProgress, REWARD_RULES, type RewardReason } from "@/lib/game";
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
