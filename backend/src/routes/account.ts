// 계정: /api/v1/account/…
// 회원 탈퇴 (AUTH-06): POST /withdraw { password }
// 재확인: 아이디 회원은 비밀번호를 다시 입력하고, 소셜 회원은 화면의 확인 창만 (spec 001 FR-031).
// 유예 기간 없이 바로 지우고, 로그인 쿠키도 지운다. 화면은 끝나면 첫 화면(/?withdrawn=1)으로 간다.
// 아이디·비밀번호가 없는 소셜 회원(/account-setup 화면)도 탈퇴할 수 있어야 해서 로그인만 확인한다.
// 한 회원 = 아이디 하나 (/account-setup): 소셜로 처음 들어와 아이디·비밀번호가 없는 회원이
// POST /setup/new 로 아이디를 만들거나, POST /setup/link 로 기존 아이디에 합친다. 끝나면 화면이 redirect로 간다
import { APIError } from "better-auth/api";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { deleteMember } from "../account/delete-member";
import { MergeRefused, mergeSocialOnlyUser } from "../account/merge";
import { auth, LOGIN_LOCKED_CODE, LOGIN_LOCKED_MESSAGE } from "../auth";
import { authErrorCode, checkNewLogin, isUsernameRuleCode, USERNAME_RULE_MESSAGE } from "../auth/login-rules";
import { grantSocialLinkReward, grantSocialLinkRewardsFor } from "../auth/social-link-reward";
import { db } from "../db";
import { accounts, loginAttempts } from "../db/schema";
import { readJson, requireViewer, type GuardEnv } from "../http/guard";

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;
const NEED_PASSWORD = msg("비밀번호를 적어 주세요");
const WRONG_PASSWORD = msg("비밀번호가 맞지 않아요");

const WRONG_LOGIN = msg("아이디 또는 비밀번호가 맞지 않아요");
const fail = (error: string) => ({ ok: false as const, error });

/** 아이디·비밀번호가 이미 있는 회원인지 (/account-setup은 없는 회원만 쓴다) */
async function hasCredential(userId: string) {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  return Boolean(row);
}

/** Better Auth가 정한 로그인 쿠키를 이 응답에 그대로 싣는다 */
function forwardCookies(c: Context, headers: Headers) {
  for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
}

export const accountRoutes = new Hono<GuardEnv>()
  /**
   * [새로 시작해요] 소셜로 처음 들어온 회원이 아이디·비밀번호를 정한다 (회원가입과 같은 규칙).
   * { username, password, passwordConfirm }. 아이디를 먼저 저장하고(겹치거나 남겨 둔 아이디면 여기서 멈춘다) 비밀번호를 넣는다
   */
  .post("/setup/new", requireViewer("signedIn"), async (c) => {
    const { userId, hasProfile } = c.get("viewer");
    if (await hasCredential(userId)) return c.json({ ok: true, redirect: "/town" });
    const body = await readJson(c);
    const checked = checkNewLogin({ username: body.username, password: body.password, passwordConfirm: body.passwordConfirm });
    if ("error" in checked) return c.json(fail(checked.error), 400);
    const { username, password } = checked;
    const headers = c.req.raw.headers;

    try {
      // username 플러그인이 형식·중복을, databaseHooks.user.update.before(assertUsernameAllowed)가 남겨 둔 아이디를 막는다
      const updated = await auth.api.updateUser({ body: { username, displayUsername: username }, headers, returnHeaders: true });
      forwardCookies(c, updated.headers);
    } catch (err) {
      const code = err instanceof APIError ? authErrorCode(err) : undefined;
      if (code === "USERNAME_IS_ALREADY_TAKEN") return c.json(fail(msg("이미 있는 아이디예요")), 409);
      if (isUsernameRuleCode(code)) return c.json(fail(USERNAME_RULE_MESSAGE), 400);
      throw err;
    }
    const set = await auth.api.setPassword({ body: { newPassword: password }, headers, returnHeaders: true });
    forwardCookies(c, set.headers);
    // 회원가입처럼, 이 아이디로 쌓여 있던 로그인 실패 횟수는 지운다
    await db.delete(loginAttempts).where(eq(loginAttempts.loginKey, username));

    // 이미 주민 등록을 마친 소셜 회원(이 화면이 생기기 전 가입)은 여기서 그 소셜 몫 🪙 100. 주민 등록 전이면 등록을 마칠 때 받는다
    await grantSocialLinkRewardsFor(userId);
    return c.json({ ok: true, redirect: hasProfile ? "/town" : "/onboarding" });
  })
  /**
   * [이미 아이디가 있어요] 기존 아이디·비밀번호로 확인하고, 방금 들어온 소셜 계정을 그 회원으로 옮긴다. { username, password }
   * 확인은 auth.api.signInUsername으로 한다 → 로그인과 같은 시도 제한(5번 실패하면 5분, src/auth/index.ts loginHooks)이 걸리고,
   * 성공하면 브라우저 로그인을 기존 회원으로 바꾼다(로그인 쿠키를 응답에 싣는다)
   */
  .post("/setup/link", requireViewer("signedIn"), async (c) => {
    const { userId, hasProfile } = c.get("viewer");
    if (await hasCredential(userId)) return c.json({ ok: true, redirect: "/town" });
    const body = await readJson(c);
    const username = (typeof body.username === "string" ? body.username : "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return c.json(fail(msg("아이디와 비밀번호를 적어 주세요")), 400);
    if (hasProfile) {
      // 이미 주민 등록을 마친 회원은 집·글이 있어서 다른 아이디와 합치지 않는다
      return c.json(fail(msg("이미 주민 등록을 마쳐서 다른 아이디와 합칠 수 없어요. [새로 시작해요]에서 아이디를 만들어 주세요")), 409);
    }

    let existingId: string;
    try {
      const signedIn = await auth.api.signInUsername({ body: { username, password }, headers: c.req.raw.headers, returnHeaders: true });
      if (!signedIn.response) return c.json(fail(WRONG_LOGIN), 400);
      existingId = signedIn.response.user.id;
      forwardCookies(c, signedIn.headers);
    } catch (err) {
      if (err instanceof APIError && authErrorCode(err) === LOGIN_LOCKED_CODE) return c.json(fail(LOGIN_LOCKED_MESSAGE), 429);
      if (err instanceof APIError) return c.json(fail(WRONG_LOGIN), 400);
      throw err;
    }

    // 지금 회원 그대로면 옮길 것이 없다
    if (existingId === userId) return c.json({ ok: true, redirect: "/town" });

    let merged: Awaited<ReturnType<typeof mergeSocialOnlyUser>>;
    try {
      merged = await mergeSocialOnlyUser(userId, existingId);
    } catch (err) {
      // 확인 사이에 주민 등록·아이디가 생긴 경우. 브라우저는 이미 기존 회원으로 로그인됐다
      if (err instanceof MergeRefused) return c.json({ ok: true, redirect: "/account-setup/done?refused=1" });
      throw err;
    }
    const rewarded: string[] = [];
    for (const a of merged.moved) if (await grantSocialLinkReward(existingId, a.providerId, a.accountId)) rewarded.push(a.providerId);

    const q = new URLSearchParams();
    if (merged.moved.length) q.set("moved", merged.moved.map((a) => a.providerId).join(","));
    if (merged.skipped.length) q.set("skipped", merged.skipped.join(","));
    if (rewarded.length) q.set("rewarded", rewarded.join(","));
    return c.json({ ok: true, redirect: `/account-setup/done?${q}` });
  })
  .post("/withdraw", requireViewer("signedIn"), async (c) => {
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
