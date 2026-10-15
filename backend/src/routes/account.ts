// 회원 탈퇴 (AUTH-06): POST /api/v1/account/withdraw { password }
// 재확인: 아이디 회원은 비밀번호를 다시 입력하고, 소셜 회원은 화면의 확인 창만 (spec 001 FR-031).
// 유예 기간 없이 바로 지우고, 로그인 쿠키도 지운다. 화면은 끝나면 첫 화면(/?withdrawn=1)으로 간다.
// 아이디·비밀번호가 없는 소셜 회원(/account-setup 화면)도 탈퇴할 수 있어야 해서 로그인만 확인한다
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { deleteMember } from "../account/delete-member";
import { db } from "../db";
import { accounts } from "../db/schema";
import { readJson, requireViewer, type GuardEnv } from "../http/guard";

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;
const NEED_PASSWORD = msg("비밀번호를 적어 주세요");
const WRONG_PASSWORD = msg("비밀번호가 맞지 않아요");

export const accountRoutes = new Hono<GuardEnv>().post("/withdraw", requireViewer("signedIn"), async (c) => {
  const { userId } = c.get("viewer");

  const [credential] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
  if (credential?.password) {
    const { password } = await readJson(c);
    if (typeof password !== "string" || !password) return c.json({ error: NEED_PASSWORD }, 400);
    if (!(await verifyPassword({ hash: credential.password, password }))) return c.json({ error: WRONG_PASSWORD }, 400);
  }

  await deleteMember(userId);

  // 세션 행은 회원과 함께 지워졌다. 브라우저의 로그인 쿠키도 지운다
  for (const name of Object.keys(getCookie(c))) {
    if (name.includes("better-auth.")) deleteCookie(c, name, { path: "/", secure: name.startsWith("__Secure-") });
  }
  return c.json({ ok: true });
});
