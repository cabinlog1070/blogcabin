// 게임 규칙: 문서 저장소 cabinlog1070/docs의 docs/01-requirements.md 4.5, docs/02-erd.md 3.4
// DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)
import { LOCALE_TAGS, makeT, type Locale, type T } from "@/lib/i18n";

// 규칙 숫자와 계산은 서버 코드에 있고 화면도 같은 것을 쓴다
export * from "@backend/game/rules";

/** 알림 시간 표시 (GAME-08): 방금 / N분 전 / N시간 전 / 하루가 지나면 YYYY. MM. DD. (한국 시간) */
export function timeAgo(date: Date, now = new Date(), locale: Locale = "ko", t: T = makeT(locale)): string {
  const sec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (sec < 60) return t("방금");
  if (sec < 3600) return t("{n}분 전", { n: Math.floor(sec / 60) });
  if (sec < 86400) return t("{n}시간 전", { n: Math.floor(sec / 3600) });
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
