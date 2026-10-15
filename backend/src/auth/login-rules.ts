// 아이디·비밀번호 규칙 (화면의 회원가입과 서버의 /account-setup 아이디 만들기가 같이 쓴다).
// 남겨 둔 아이디(admin 등)는 src/auth/index.ts의 assertUsernameAllowed가 저장 직전에 막는다.

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;

export const USERNAME_RULE_MESSAGE = msg("아이디는 영문 소문자, 숫자, _ 로 4~20자예요");
const USERNAME_RE = /^[a-z0-9_]{4,20}$/;

/**
 * 새 아이디·비밀번호 확인. 맞으면 { username(소문자로 정리), password }, 틀리면 { error: 한국어 문장 }.
 * 순서는 아이디 → 비밀번호 길이 → 비밀번호 확인
 */
export function checkNewLogin(raw: {
  username: unknown;
  password: unknown;
  passwordConfirm: unknown;
}): { error: string } | { username: string; password: string } {
  const username = typeof raw.username === "string" ? raw.username.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  if (!USERNAME_RE.test(username)) return { error: USERNAME_RULE_MESSAGE };
  if (password.length < 8) return { error: msg("비밀번호는 8자 이상이에요") };
  if (password.length > 64) return { error: msg("비밀번호는 64자까지예요") };
  if (password !== raw.passwordConfirm) return { error: msg("비밀번호가 서로 달라요") };
  return { username, password };
}

/** Better Auth APIError의 code (예: USERNAME_IS_ALREADY_TAKEN) */
export function authErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("body" in err)) return undefined;
  return ((err as { body?: { code?: string } }).body ?? {}).code;
}

/** 아이디 형식이 틀렸다는 Better Auth 코드 */
export function isUsernameRuleCode(code: string | undefined) {
  return code === "INVALID_USERNAME" || code === "USERNAME_TOO_SHORT" || code === "USERNAME_TOO_LONG";
}
