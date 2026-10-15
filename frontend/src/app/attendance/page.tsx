import Link from "next/link";
import { Icon } from "@/components/icon";
import type { IconName } from "@/lib/art/icons";
import { formatDate } from "@/lib/format";
import { ATTENDANCE_STREAK_BONUS_EVERY, currentStreak, REWARD_RULES } from "@/lib/game";
import { msg } from "@/lib/i18n";
import { requireMember } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { presentQuests, questProgress } from "@/server/quests";
import { readApi } from "@/server/read-api";
import { AttendButton } from "./attend-button";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("출석 체크") };
}

/** 퀘스트 아이콘 (src/server/quests.ts의 key → 그린 아이콘). 없는 key는 그 퀘스트의 이모지를 그대로 쓴다 */
const QUEST_ICON: Record<string, IconName> = { attend: "calendar", post: "write", like: "heart", comment: "comment", pet: "pet" };

const WEEKDAYS = [msg("일"), msg("월"), msg("화"), msg("수"), msg("목"), msg("금"), msg("토")];

export default async function AttendancePage() {
  await requireMember();
  const t = await getT();
  const locale = await getLocale();
  // 이번 달 출석(달력), 가장 최근 출석(연속 일수, GAME-04), 오늘의 퀘스트 횟수. 오늘 날짜도 서버 기준
  const { today, month: rows, last, questCounts } = await readApi.attendance();
  const quests = presentQuests(t, questCounts);
  const attendedDates = new Set(rows.map((r) => r.date));
  const attendedToday = attendedDates.has(today);

  // 이번 달 달력
  const [y, m] = today.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const streak = currentStreak(last, today);
  const streakText = streak
    ? t("현재 연속 {n}일", { n: streak })
    : last
      ? t("연속 출석이 끊겼어요 (마지막 출석 {date})", { date: formatDate(new Date(`${last.date}T00:00:00+09:00`), locale) })
      : t("아직 출석 기록이 없어요");
  const progress = questProgress(quests);

  return (
    <div className="mx-auto max-w-2xl break-keep px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="calendar" size={34} className="-mt-1" /> {t("출석 체크")}
      </h1>
      <p className="mt-1 text-ink-soft">
        {t("하루 한 번")} <Icon name="exp" size={18} /> {REWARD_RULES.attendance.exp} · <Icon name="coin" size={18} /> {REWARD_RULES.attendance.coins},{" "}
        {t("{n}일 연속마다", { n: ATTENDANCE_STREAK_BONUS_EVERY })} <Icon name="coin" size={18} /> {t("{coins} 보너스", { coins: REWARD_RULES.attendance_streak.coins })}
      </p>

      <section id="attend" className="card mt-6 flex min-h-48 scroll-mt-20 flex-col items-center justify-center p-8">
        <AttendButton attended={attendedToday} />
      </section>

      {/* 오늘의 퀘스트: 오늘(한국 시간) 한 활동을 기록에서 계산해 보여 준다. 보상은 없다 */}
      <section className="card mt-6 p-6" aria-labelledby="quests-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="quests-title" className="font-display text-xl">
            <Icon name="guestbook" size={26} className="-mt-1" /> {t("오늘의 퀘스트")}
          </h2>
          <p className="text-sm font-bold text-leaf-dark">
            {t("{done} / {total} 완료", { done: progress.done, total: progress.total })}
          </p>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-label={t("오늘의 퀘스트 진행도")}
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
                {QUEST_ICON[q.key] ? (
                  <Icon name={QUEST_ICON[q.key]} size={30} />
                ) : (
                  <span aria-hidden className="text-2xl">
                    {q.emoji}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{q.label}</span>
                  <span className="block text-sm text-ink-soft">{q.hint}</span>
                </span>
                {q.done ? (
                  <span className="shrink-0 rounded-full bg-leaf px-2.5 py-0.5 text-sm font-bold text-white">✓ {t("완료")}</span>
                ) : q.goal > 1 ? (
                  // 여러 번 해야 하는 퀘스트는 지금까지 센 횟수를 보여 준다
                  <span className="shrink-0 text-sm font-bold text-ink-soft">
                    {q.count} / {q.goal}
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-bold text-ink-soft">{t("아직이에요")}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-sm text-ink-soft">
          {progress.done === progress.total ? (
            <>
              <Icon name="achievement" size={18} /> {t("오늘의 퀘스트를 모두 끝냈어요! 내일 또 만나요")}
            </>
          ) : (
            t("퀘스트는 매일 밤 12시(한국 시간)에 새로 시작해요")
          )}
        </p>
      </section>

      <section className="card mt-6 p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="shrink-0 font-display text-xl">
            {t("{y}년 {m}월", { y, m })}
          </h2>
          <p className="text-sm text-ink-soft">
            {t("이번 달 {n}일 출석 · {streak}", { n: rows.length, streak: streakText })}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1 font-bold text-ink-soft">
              {t(d)}
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
                title={done ? t("출석") : undefined}
              >
                {done ? <Icon name="exp" size={32} title={t("출석")} className="size-6 sm:size-8" /> : d}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
