// 지금 요청의 화면 언어: 회원이 고른 언어(users.locale) → 브라우저 쿠키 → 한국어
import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, makeT, type Locale } from "@/lib/i18n";
import { getSession } from "@/server/dal";

export const getLocale = cache(async (): Promise<Locale> => {
  const session = await getSession();
  if (session) {
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, session.user.id));
    if (isLocale(row?.locale)) return row.locale;
  }
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
});

/** 서버 컴포넌트·Server Action용 번역 함수 */
export async function getT() {
  return makeT(await getLocale());
}
