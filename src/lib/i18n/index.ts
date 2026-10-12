// 화면 언어 (한국어·일본어). 사이트가 쓰는 글(메뉴·버튼·안내·알림)만 바꾸고,
// 회원이 쓴 글·댓글·이름은 쓴 그대로 둔다.
//
// 쓰는 법: 코드에는 한국어 문장을 그대로 쓰고 t()로 감싼다. t("글쓰기"), t("{n}개", { n: 3 })
// 일본어는 src/lib/i18n/ja/ 사전에서 같은 한국어 문장을 찾아 바꾼다. 사전에 없으면 한국어가 그대로 나온다.
// 사전에 빠진 문장은 `npm run test:i18n`이 찾아 준다.
import { ja } from "./ja";

export const LOCALES = ["ko", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
/** 로그인하지 않은 방문자의 언어를 기억하는 쿠키 */
export const LOCALE_COOKIE = "lang";

/** 언어 고르기 메뉴에 보이는 이름 (각 언어로 적는다) */
export const LOCALE_LABELS: Record<Locale, string> = { ko: "한국어", ja: "日本語" };
/** <html lang>과 날짜 형식에 쓰는 이름 */
export const LOCALE_TAGS: Record<Locale, string> = { ko: "ko-KR", ja: "ja-JP" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export type TVars = Record<string, string | number>;
export type T = (text: string, vars?: TVars) => string;

/** 한국어 문장을 locale 언어로 바꾸고 {이름} 자리에 vars 값을 넣는다 */
export function translate(locale: Locale, text: string, vars?: TVars): string {
  const s = locale === "ja" ? (ja[text] ?? text) : text;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function makeT(locale: Locale): T {
  return (text, vars) => translate(locale, text, vars);
}

/**
 * 나중에 t()로 바꿀 문장을 데이터에 적을 때 감싼다 (값은 그대로).
 * 예: const LABELS = { kakao: msg("카카오") } … 화면에서 t(LABELS.kakao).
 * test:i18n이 msg()와 t() 안의 문장을 모아 일본어 사전에 있는지 확인한다.
 */
export const msg = <S extends string>(text: S): S => text;
