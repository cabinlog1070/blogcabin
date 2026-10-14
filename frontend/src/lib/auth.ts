import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { authOptions } from "@backend/auth";

// 로그인 설정은 서버(backend/src/auth)에 있다. 화면은 같은 설정에 nextCookies만 더해
// 세션 확인(dal.ts)과 Server Action 로그인·가입(쿠키 설정)을 한다
export { enabledProviders, LOGIN_LOCKED_CODE, LOGIN_LOCKED_MESSAGE } from "@backend/auth";

export const auth = betterAuth({
  ...authOptions,
  plugins: [...authOptions.plugins, nextCookies()], // Server Action에서 로그인 쿠키를 설정할 수 있게 한다 (마지막에 둔다)
});

export type Session = typeof auth.$Infer.Session;
