// 화면 언어 바꾸기 (NF-27): PUT /api/v1/locale { locale: "ko" | "ja" }
// 로그인 전 방문자도 쓰므로 로그인을 요구하지 않는다: 쿠키는 누구나 바꿀 수 있고,
// 로그인했으면 그 회원의 users.locale에도 기억한다 (다른 기기에서도 같은 언어)
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { auth } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { BAD_REQUEST, isSameOrigin, readJson } from "../http/guard";
import { isLocale, LOCALE_COOKIE } from "../i18n/locales";

export const localeRoutes = new Hono().put("/", async (c) => {
  const headers = c.req.raw.headers;
  if (!isSameOrigin(headers)) return c.json({ error: BAD_REQUEST }, 403);
  const { locale } = await readJson(c);
  if (!isLocale(locale)) return c.json({ error: BAD_REQUEST }, 400);

  setCookie(c, LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "Lax" });
  const session = await auth.api.getSession({ headers });
  if (session) await db.update(users).set({ locale }).where(eq(users.id, session.user.id));
  return c.json({ ok: true, locale });
});
