import type { Locale } from "@/lib/i18n";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const jaDateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const jaDateTimeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 날짜 (2026. 10. 12. / 일본어 화면은 2026/10/12) */
export const formatDate = (d: Date, locale: Locale = "ko") => (locale === "ja" ? jaDateFmt : dateFmt).format(d);
export const formatDateTime = (d: Date, locale: Locale = "ko") => (locale === "ja" ? jaDateTimeFmt : dateTimeFmt).format(d);
