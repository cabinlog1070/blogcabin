// 코인·경험치 원장 (point_ledger). 잔액 컬럼 없이 원장 합계로 계산한다
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { pointLedger } from "../db/schema";
import { recordLevelUps } from "../notifications";
import { levelProgress, REWARD_RULES, type RewardReason } from "./rules";

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
