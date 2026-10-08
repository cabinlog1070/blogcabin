import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

// 키가 설정된 소셜 로그인만 켠다
function provider<T extends object>(id: string, extra?: T) {
  const clientId = process.env[`${id}_CLIENT_ID`];
  const clientSecret = process.env[`${id}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, ...extra };
}

// 이메일을 주지 않는 소셜 계정용 대체 주소 (실제로 메일을 보내지 않는다)
const fallbackEmail = (providerId: string, accountId: string | number) =>
  `${providerId}_${accountId}@${providerId}.blogcabin.invalid`;

const google = provider("GOOGLE");
const kakao = provider("KAKAO", {
  // 개인 개발자 앱은 이메일 동의항목을 쓰기 어려워서 닉네임과 프로필 사진만 요청한다
  disableDefaultScope: true,
  scope: ["profile_nickname", "profile_image"],
  mapProfileToUser: (profile: { id: number; kakao_account?: { email?: string } }) => ({
    email: profile.kakao_account?.email ?? fallbackEmail("kakao", profile.id),
  }),
});
const naver = provider("NAVER", {
  mapProfileToUser: (profile: { response: { id: string; email?: string } }) => ({
    email: profile.response.email ?? fallbackEmail("naver", profile.response.id),
  }),
});

export const enabledProviders = {
  google: Boolean(google),
  kakao: Boolean(kakao),
  naver: Boolean(naver),
};

// ===== 로그인 시도 제한 (NF-10, spec 001 FR-014) =====
// 같은 아이디로 5번 연속 실패하면 5분 동안 그 아이디의 로그인을 막는다. 성공하면 실패 횟수가 0이 된다.
// 없는 아이디도 똑같이 센다(어떤 아이디가 있는지 알 수 없게). IP는 보지 않는다 (아이디 기준만).
// 화면의 Server Action(signIn)뿐 아니라 /api/auth/sign-in/* 를 직접 불러도 같은 규칙이 걸리도록 Better Auth 훅에 둔다.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 5;
export const LOGIN_LOCKED_CODE = "LOGIN_LOCKED";
export const LOGIN_LOCKED_MESSAGE = "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요";
const SIGN_IN_PATHS = new Set(["/sign-in/username", "/sign-in/email"]);

/** 막을 단위: 소문자 아이디. 이메일 로그인이면 아이디 가입자의 대체 이메일(아이디@users.blogcabin.invalid)은 아이디로 바꾼다 */
function loginKey(path: string, body: unknown): string | null {
  const b = (body ?? {}) as { username?: unknown; email?: unknown };
  const raw = path === "/sign-in/username" ? b.username : b.email;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const key = raw.trim().toLowerCase();
  return key.endsWith("@users.blogcabin.invalid") ? key.slice(0, -"@users.blogcabin.invalid".length) : key;
}

const loginHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (!SIGN_IN_PATHS.has(ctx.path)) return;
    const key = loginKey(ctx.path, ctx.body);
    if (!key) return;
    const [row] = await db
      .select({ locked: sql<boolean>`${schema.loginAttempts.lockedUntil} > now()` })
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.loginKey, key));
    if (row?.locked) throw new APIError("TOO_MANY_REQUESTS", { code: LOGIN_LOCKED_CODE, message: LOGIN_LOCKED_MESSAGE });
  }),
  after: createAuthMiddleware(async (ctx) => {
    // 아이디 회원가입도 바로 로그인 상태가 되므로 성공한 로그인처럼 실패 횟수를 지운다
    if (ctx.path === "/sign-up/email" && !isAPIError(ctx.context.returned)) {
      const key = loginKey("/sign-in/username", ctx.body);
      if (key) await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.loginKey, key));
      return;
    }
    if (!SIGN_IN_PATHS.has(ctx.path)) return;
    const key = loginKey(ctx.path, ctx.body);
    if (!key) return;
    const failed = isAPIError(ctx.context.returned);
    if (failed && (ctx.context.returned as APIError).body?.code === LOGIN_LOCKED_CODE) return;
    if (!failed) {
      await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.loginKey, key)); // 성공하면 초기화
      return;
    }
    // 실패 1번 더하기. 잠금이 끝난 뒤의 실패는 1번째부터 다시 센다. 5번째 실패에서 5분 잠금
    const t = schema.loginAttempts;
    const next = sql`CASE WHEN ${t.lockedUntil} IS NOT NULL AND ${t.lockedUntil} <= now() THEN 1 ELSE ${t.failures} + 1 END`;
    await db
      .insert(t)
      .values({ loginKey: key, failures: 1 })
      .onConflictDoUpdate({
        target: t.loginKey,
        set: {
          failures: next,
          lockedUntil: sql`CASE WHEN ${next} >= ${LOGIN_MAX_FAILURES} THEN now() + make_interval(mins => ${LOGIN_LOCK_MINUTES}) ELSE NULL END`,
        },
      });
  }),
};

// 로그인·로그아웃 요청을 받아 주는 주소 (다른 사이트에서 온 요청은 403).
// 운영: BETTER_AUTH_URL(http·https 둘 다) + TRUSTED_ORIGINS(쉼표로 여러 개, 선택).
// 개발 서버: localhost·127.0.0.1·같은 와이파이 주소(DEV_ALLOWED_ORIGINS) 어느 쪽으로 들어와도 로그아웃이 되게 한다.
function trustedOrigins(): string[] {
  const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = split(process.env.TRUSTED_ORIGINS);
  // 운영 주소를 http·https 어느 쪽으로 열어도 403(INVALID_ORIGIN)으로 막히지 않게 같은 호스트의 다른 쪽도 허용
  // (APP_URL은 http인데 nginx가 https로도 받아 주면 https에서 로그아웃이 막혔다)
  if (process.env.BETTER_AUTH_URL) {
    const base = new URL(process.env.BETTER_AUTH_URL);
    if (!base.port) list.push(`${base.protocol === "https:" ? "http" : "https"}://${base.host}`);
  }
  if (process.env.NODE_ENV !== "production") {
    const base = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000");
    const port = base.port || "3000";
    for (const host of ["localhost", "127.0.0.1", ...split(process.env.DEV_ALLOWED_ORIGINS)]) list.push(`http://${host}:${port}`);
  }
  return list;
}

// ===== 남겨 둔 아이디 (AUTH-07, AUTH-08) =====
// 관리자·공지 블로그와 헷갈릴 아이디는 회원가입·아이디 변경으로 쓸 수 없다 (`이미 있는 아이디예요`).
// usernameValidator에 넣지 않는다: username 플러그인이 로그인(/sign-in/username)에도 같은 검사를 해서 관리자가 로그인하지 못하게 된다.
// 관리자 계정은 npm run admin:create가 DB에 바로 만들므로 이 검사를 거치지 않는다.
const SITE_EMAIL_DOMAIN = "@users.blogcabin.invalid";
const RESERVED_USERNAMES = new Set(
  ["admin", "administrator", "root", "notice", "blogcabin", process.env.ADMIN_USERNAME?.trim().toLowerCase()].filter((n): n is string => Boolean(n)),
);
const usernameTaken = () => new APIError("BAD_REQUEST", { code: "USERNAME_IS_ALREADY_TAKEN", message: "이미 있는 아이디예요" });

function assertUsernameAllowed(data: Record<string, unknown>, creating: boolean) {
  const name = typeof data.username === "string" ? data.username.trim().toLowerCase() : null;
  if (name && RESERVED_USERNAMES.has(name)) throw usernameTaken();
  // 아이디 회원의 대체 이메일(아이디@users.blogcabin.invalid)은 그 아이디로만 만들 수 있다
  if (creating && typeof data.email === "string") {
    const email = data.email.trim().toLowerCase();
    if (email.endsWith(SITE_EMAIL_DOMAIN)) {
      const local = email.slice(0, -SITE_EMAIL_DOMAIN.length);
      if (RESERVED_USERNAMES.has(local) || local !== name) throw usernameTaken();
    }
  }
}

export const auth = betterAuth({
  appName: "BlogCabin",
  trustedOrigins: trustedOrigins(),
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    ...(google && { google }),
    ...(kakao && { kakao }),
    ...(naver && { naver }),
  },
  // 헤더 내 정보 메뉴의 [연동하기] (AUTH-05): 로그인한 회원이 직접 소셜 계정을 연결할 때는 이메일이 달라도 된다.
  // 아이디 회원의 이메일은 대체 주소(아이디@users.blogcabin.invalid)라 소셜 계정 이메일과 같을 수 없다.
  // 로그인 중에만 쓰는 연결 요청에만 적용된다 (소셜로 처음 로그인할 때 자동으로 합치는 규칙은 그대로)
  account: { accountLinking: { allowDifferentEmails: true } },
  // 사이트 자체 회원가입: 아이디 + 비밀번호 (username 플러그인이 이메일·비밀번호 로그인 위에 아이디를 얹는다)
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 64 },
  hooks: loginHooks,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertUsernameAllowed(user, true);
        },
      },
      update: {
        before: async (user) => {
          assertUsernameAllowed(user, false);
        },
      },
    },
  },
  user: {
    additionalFields: {
      // 관리자 여부. 가입 요청으로는 바꿀 수 없다 (input: false)
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  plugins: [
    username({
      minUsernameLength: 4,
      maxUsernameLength: 20,
      usernameValidator: (name) => /^[a-z0-9_]+$/.test(name), // 소문자로 정규화된 뒤 검사
      validationOrder: { username: "post-normalization" },
    }),
    nextCookies(), // Server Action에서 로그인 쿠키를 설정할 수 있게 한다 (마지막에 둔다)
  ],
});

export type Session = typeof auth.$Infer.Session;
