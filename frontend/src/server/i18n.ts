// 지금 요청의 화면 언어: 회원이 고른 언어(users.locale) → 브라우저 쿠키 → 한국어
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, makeT, type Locale } from "@/lib/i18n";
import { getMe } from "@/server/dal";

export const getLocale = cache(async (): Promise<Locale> => {
  const me = await getMe();
  if (me.user && isLocale(me.locale)) return me.locale;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
});

/** 서버 컴포넌트·Server Action용 번역 함수 */
export async function getT() {
  return makeT(await getLocale());
}
