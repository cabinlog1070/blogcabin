// 화면 언어 목록과 언어 쿠키. 번역 사전은 화면(frontend/src/lib/i18n)에 있고, 서버는 언어 이름만 안다
export const LOCALES = ["ko", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
/** 로그인하지 않은 방문자의 언어를 기억하는 쿠키 */
export const LOCALE_COOKIE = "lang";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
