// 출석 체크 (GAME-04): POST /api/v1/attendance
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { attendances } from "../db/schema";
import { grantReward, lockUser } from "../game/points";
import { ATTENDANCE_STREAK_BONUS_EVERY, previousDay, REWARD_RULES, todayKST } from "../game/rules";
import { requireViewer, type GuardEnv } from "../http/guard";

export type AttendResult =
  | { status: "done"; streak: number; coins: number; exp: number; bonus: boolean }
  | { status: "already" };

export const attendance = new Hono<GuardEnv>().post("/", requireViewer("member"), async (c) => {
  const { userId } = c.get("viewer");
  const today = todayKST();

  const result = await db.transaction(async (tx): Promise<AttendResult> => {
    await lockUser(tx, userId);

    // (user_id, date)가 기본 키라서 같은 날 두 번 넣으면 아무것도 들어가지 않는다
    const [last] = await tx
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), lt(attendances.date, today)))
      .orderBy(desc(attendances.date))
      .limit(1);
    const streak = last && last.date === previousDay(today) ? last.streak + 1 : 1;

    const inserted = await tx
      .insert(attendances)
      .values({ userId, date: today, streak })
      .onConflictDoNothing()
      .returning({ streak: attendances.streak });
    if (!inserted.length) return { status: "already" };

    await grantReward(tx, userId, "attendance", today);
    const bonus = streak % ATTENDANCE_STREAK_BONUS_EVERY === 0;
    if (bonus) await grantReward(tx, userId, "attendance_streak", today);

    return {
      status: "done",
      streak,
      bonus,
      exp: REWARD_RULES.attendance.exp,
      coins: REWARD_RULES.attendance.coins + (bonus ? REWARD_RULES.attendance_streak.coins : 0),
    };
  });
  return c.json(result);
});
