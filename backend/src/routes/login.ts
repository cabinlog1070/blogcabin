// 아이디로 가입·로그인 (AUTH-01·02): POST /api/v1/login/sign-up, /api/v1/login/sign-in
// 로그인 라이브러리(Better Auth)가 만든 로그인 쿠키를 응답에 그대로 실어 브라우저가 받는다.
// 소셜 로그인(카카오·구글·네이버)은 로그인 라이브러리 주소(/api/auth/…)가 그대로 받는다
import { APIError } from "better-auth/api";
import { Hono, type Context } from "hono";
import { auth, LOGIN_LOCKED_CODE, LOGIN_LOCKED_MESSAGE } from "../auth";
import { authErrorCode, checkNewLogin, isUsernameRuleCode, USERNAME_RULE_MESSAGE } from "../auth/login-rules";
import { BAD_REQUEST, isSameOrigin, readJson } from "../http/guard";

const msg = <S extends string>(text: S): S => text;
const fail = (error: string) => ({ ok: false as const, error });

function forwardCookies(c: Context, headers: Headers) {
  for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export const loginRoutes = new Hono()
  // 다른 사이트에서 몰래 보낸 가입·로그인을 막는다
  .use(async (c, next) => (isSameOrigin(c.req.raw.headers) ? next() : c.json(fail(BAD_REQUEST), 403)))
  /** 회원가입: { username, password, passwordConfirm } → 성공하면 로그인된 채로 { ok, redirect: "/onboarding" } */
  .post("/sign-up", async (c) => {
    const checked = checkNewLogin(await readJson(c).then((b) => ({ username: text(b.username), password: text(b.password), passwordConfirm: text(b.passwordConfirm) })));
    if ("error" in checked) return c.json(fail(checked.error), 400);
    const { username, password } = checked;
    try {
      const res = await auth.api.signUpEmail({
        body: {
          // 아이디로만 가입하므로 실제로 쓰지 않는 대체 이메일을 넣는다 (로그인 라이브러리가 이메일을 필수로 요구)
          email: `${username}@users.blogcabin.invalid`,
          password,
          name: username,
          username,
        },
        headers: c.req.raw.headers,
        returnHeaders: true,
      });
      forwardCookies(c, res.headers);
    } catch (err) {
      const code = err instanceof APIError ? authErrorCode(err) : undefined;
      if (code === "USERNAME_IS_ALREADY_TAKEN" || code?.startsWith("USER_ALREADY_EXISTS")) return c.json(fail(msg("이미 있는 아이디예요")), 409);
      if (isUsernameRuleCode(code)) return c.json(fail(USERNAME_RULE_MESSAGE), 400);
      throw err;
    }
    return c.json({ ok: true, redirect: "/onboarding" });
  })
  /** 로그인: { username, password } → 성공하면 { ok, redirect: "/town" } (주민 등록 전이면 광장이 주민 등록으로 보낸다) */
  .post("/sign-in", async (c) => {
    const body = await readJson(c);
    const username = text(body.username).trim().toLowerCase();
    const password = text(body.password);
    if (!username || !password) return c.json(fail(msg("아이디와 비밀번호를 적어 주세요")), 400);
    try {
      const res = await auth.api.signInUsername({ body: { username, password }, headers: c.req.raw.headers, returnHeaders: true });
      forwardCookies(c, res.headers);
    } catch (err) {
      // 같은 아이디로 5번 연속 실패하면 5분 동안 막힌다 (NF-10, src/auth/index.ts 로그인 훅)
      if (err instanceof APIError && authErrorCode(err) === LOGIN_LOCKED_CODE) return c.json(fail(LOGIN_LOCKED_MESSAGE), 429);
      if (err instanceof APIError) return c.json(fail(msg("아이디 또는 비밀번호가 맞지 않아요")), 400);
      throw err;
    }
    return c.json({ ok: true, redirect: "/town" });
  });
