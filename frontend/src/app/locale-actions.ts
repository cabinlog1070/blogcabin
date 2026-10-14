"use server";
// 화면 언어 바꾸기. 로그인 전 방문자도 쓰므로 requireUser()를 걸지 않는다:
// 쿠키는 누구나 바꿀 수 있고, 로그인했으면 그 회원의 users.locale에도 기억한다 (다른 기기에서도 같은 언어)
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { getSession } from "@/server/dal";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession();
  if (session) await db.update(users).set({ locale }).where(eq(users.id, session.user.id));
  revalidatePath("/", "layout");
}
