// API 주소마다 거는 확인: 같은 사이트에서 온 요청인지(CSRF), 누가 보냈는지(로그인 세션)
// 화면의 requireSignedIn / requireMember (frontend/src/server/dal.ts)와 같은 규칙이다
import { and, eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { accounts, profiles, users } from "../db/schema";

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;
export const BAD_REQUEST = msg("잘못된 요청이에요");
export const LOGIN_NEEDED = msg("로그인이 필요해요");
export const NOT_FOUND = msg("찾을 수 없어요");

/** 다른 사이트에서 몰래 보낸 요청이 아닌지. 프록시 뒤라면 x-forwarded-host, 아니면 host와 Origin을 비교한다 */
export function isSameOrigin(headers: Headers) {
  const expected = headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host");
  try {
    const origin = headers.get("origin");
    const originHost = origin && origin !== "null" ? new URL(origin).host : null;
    return Boolean(originHost && expected && originHost === expected);
  } catch {
    return false;
  }
}

export type Viewer = { userId: string; hasProfile: boolean; isAdmin: boolean };
export type GuardEnv = { Variables: { viewer: Viewer } };

type Level = "signedIn" | "user" | "member" | "admin";

/**
 * 로그인한 사람만 통과시키는 미들웨어. 통과하면 c.get("viewer")로 회원을 읽는다.
 * - signedIn: 로그인만 (탈퇴·아이디 만들기처럼 아이디 만들기 전 소셜 회원도 쓰는 곳)
 * - user: 아이디·비밀번호가 있는 회원 (주민 등록 전이어도 된다: 주민 등록)
 * - member: 아이디·비밀번호가 있고 주민 등록(온보딩)까지 마친 회원. 아니면 화면이 갈 곳(redirect)을 함께 돌려준다
 * - admin: member이면서 관리자 (users.role = 'admin'). 아니면 화면의 관리자 페이지처럼 없는 주소(404)로 답한다
 * 읽기(GET)가 아닌 요청은 같은 사이트에서 온 것만 받는다.
 */
export function requireViewer(level: Level): MiddlewareHandler<GuardEnv> {
  return async (c, next) => {
    const headers = c.req.raw.headers;
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && !isSameOrigin(headers)) return c.json({ error: BAD_REQUEST }, 403);

    const session = await auth.api.getSession({ headers });
    if (!session) return c.json({ error: LOGIN_NEEDED, redirect: "/" }, 401);
    const userId = session.user.id;

    const [[profile], [credential], [user]] = await Promise.all([
      db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId)),
      db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
        .limit(1),
      db.select({ role: users.role }).from(users).where(eq(users.id, userId)),
    ]);
    if (level !== "signedIn" && !credential) return c.json({ error: LOGIN_NEEDED, redirect: "/account-setup" }, 403);
    if ((level === "member" || level === "admin") && !profile) return c.json({ error: LOGIN_NEEDED, redirect: "/onboarding" }, 403);
    const isAdmin = user?.role === "admin";
    if (level === "admin" && !isAdmin) return c.json({ error: NOT_FOUND }, 404);
    c.set("viewer", { userId, hasProfile: Boolean(profile), isAdmin });
    await next();
  };
}

/**
 * 로그인하지 않은 방문자도 보는 읽기 주소: 주민 등록까지 마친 회원이면 그 회원, 아니면 null (막지 않는다).
 * 아이디 만들기·주민 등록 전 회원은 방문자처럼 본다 (화면이 먼저 그 화면으로 보낸다)
 */
export async function memberOrNull(c: Context): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  const userId = session.user.id;
  const [[profile], [user]] = await Promise.all([
    db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId)),
    db.select({ role: users.role }).from(users).where(eq(users.id, userId)),
  ]);
  return profile ? { userId, hasProfile: true, isAdmin: user?.role === "admin" } : null;
}

/** 본문 JSON을 읽는다. 잘못된 JSON이면 빈 객체 */
export async function readJson(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
