import { and, desc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { attendances } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { ATTENDANCE_STREAK_BONUS_EVERY, currentStreak, REWARD_RULES, todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getDailyQuests, questProgress } from "@/server/quests";
import { AttendButton } from "./attend-button";

export const metadata = { title: "출석 체크" };

export default async function AttendancePage() {
  const viewer = await requireMember();
  const today = todayKST();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [rows, [last], quests] = await Promise.all([
    // 달력용: 이번 달 출석
    db
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(and(eq(attendances.userId, viewer.userId), gte(attendances.date, monthStart)))
      .orderBy(desc(attendances.date)),
    // 연속 일수용: 달과 상관없이 가장 최근 출석 1건 (GAME-04)
    db
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(eq(attendances.userId, viewer.userId))
      .orderBy(desc(attendances.date))
      .limit(1),
    getDailyQuests(viewer.userId, today),
  ]);
  const attendedDates = new Set(rows.map((r) => r.date));
  const attendedToday = attendedDates.has(today);

  // 이번 달 달력
  const [y, m] = today.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const streak = currentStreak(last, today);
  const streakText = streak
    ? `현재 연속 ${streak}일`
    : last
      ? `연속 출석이 끊겼어요 (마지막 출석 ${formatDate(new Date(`${last.date}T00:00:00+09:00`))})`
      : "아직 출석 기록이 없어요";
  const progress = questProgress(quests);

  return (
    <div className="mx-auto max-w-2xl break-keep px-4 py-8">
      <h1 className="font-display text-3xl">📮 출석 체크</h1>
      <p className="mt-1 text-ink-soft">
        하루 한 번 ✨ {REWARD_RULES.attendance.exp} · 🪙 {REWARD_RULES.attendance.coins}, {ATTENDANCE_STREAK_BONUS_EVERY}일 연속마다 🪙{" "}
        {REWARD_RULES.attendance_streak.coins} 보너스
      </p>

      <section id="attend" className="card mt-6 flex min-h-48 scroll-mt-20 flex-col items-center justify-center p-8">
        <AttendButton attended={attendedToday} />
      </section>

      {/* 오늘의 퀘스트: 오늘(한국 시간) 한 활동을 기록에서 계산해 보여 준다. 보상은 없다 */}
      <section className="card mt-6 p-6" aria-labelledby="quests-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="quests-title" className="font-display text-xl">
            📜 오늘의 퀘스트
          </h2>
          <p className="text-sm font-bold text-leaf-dark">
            {progress.done} / {progress.total} 완료
          </p>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-label="오늘의 퀘스트 진행도"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
        <ul className="mt-4 grid gap-2">
          {quests.map((q) => (
            <li key={q.key}>
              <Link
                // 출석은 바로 위 버튼으로 하므로 이 화면 안에서 움직인다
                href={q.key === "attend" ? "#attend" : q.href}
                className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${
                  q.done ? "border-leaf bg-moss" : "border-line bg-cream hover:border-sun"
                }`}
              >
                <span aria-hidden className="text-2xl">
                  {q.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{q.label}</span>
                  <span className="block text-sm text-ink-soft">{q.hint}</span>
                </span>
                {q.done ? (
                  <span className="shrink-0 rounded-full bg-leaf px-2.5 py-0.5 text-sm font-bold text-white">✓ 완료</span>
                ) : (
                  <span className="shrink-0 text-sm font-bold text-ink-soft">아직이에요</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-sm text-ink-soft">
          {progress.done === progress.total ? "🎉 오늘의 퀘스트를 모두 끝냈어요! 내일 또 만나요" : "퀘스트는 매일 밤 12시(한국 시간)에 새로 시작해요"}
        </p>
      </section>

      <section className="card mt-6 p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="shrink-0 font-display text-xl">
            {y}년 {m}월
          </h2>
          <p className="text-sm text-ink-soft">
            이번 달 {rows.length}일 출석 · {streakText}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <span key={d} className="py-1 font-bold text-ink-soft">
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const key = `${today.slice(0, 7)}-${String(d).padStart(2, "0")}`;
            const done = attendedDates.has(key);
            return (
              <span
                key={key}
                className={`grid aspect-square place-items-center rounded-xl border-2 ${
                  done ? "border-leaf bg-moss font-bold" : key === today ? "border-sun" : "border-transparent bg-cream"
                }`}
                title={done ? "출석" : undefined}
              >
                {done ? "🌟" : d}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
