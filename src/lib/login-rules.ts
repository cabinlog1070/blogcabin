import { z } from "zod";

// 아이디·비밀번호 규칙 (회원가입과 /account-setup 아이디 만들기가 같이 쓴다).
// 남겨 둔 아이디(admin 등)는 src/lib/auth.ts의 assertUsernameAllowed가 저장 직전에 막는다.
export const USERNAME_RULE_MESSAGE = "아이디는 영문 소문자, 숫자, _ 로 4~20자예요";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,20}$/, USERNAME_RULE_MESSAGE);

export const newLoginSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(8, "비밀번호는 8자 이상이에요").max(64, "비밀번호는 64자까지예요"),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "비밀번호가 서로 달라요", path: ["passwordConfirm"] });

/** Better Auth APIError의 code (예: USERNAME_IS_ALREADY_TAKEN) */
export function authErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("body" in err)) return undefined;
  return ((err as { body?: { code?: string } }).body ?? {}).code;
}
