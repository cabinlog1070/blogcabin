// 친구 초대 코드 (GAME-09, spec 005 Clarifications 2026-10-07)
// 블로그 주소와 별개인 무작위 6자리: 대문자와 숫자, 헷갈리는 0·O·1·I는 쓰지 않는다. 입력할 때 대소문자는 구분하지 않는다.
// DB를 쓰지 않는 순수 함수만 둔다 (화면·서버·테스트 어디서나 import)

/** 쓸 수 있는 글자 32개: A~Z에서 I·O를 빼고, 2~9 */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;
/** DB CHECK `profiles_invite_code_check`와 같은 규칙 */
export const INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** 초대 링크로 들어온 코드를 온보딩까지 기억하는 쿠키 (src/proxy.ts에서 남긴다) */
export const INVITE_COOKIE = "bc_invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

/** 초대 보상: 초대한 사람과 친구 둘 다 코인 50, 경험치 없음 (GAME-09) */
export const INVITE_REWARD_COINS = 50;

/** 무작위 초대 코드. 서로 겹치는지는 DB UNIQUE가 확인하고, 겹치면 부르는 쪽이 다시 만든다 */
export function generateInviteCode(random: (n: number) => Uint8Array = defaultRandom): string {
  // 32글자라 바이트를 32로 나눈 나머지를 써도 치우침이 없다 (256 = 32 × 8)
  return Array.from(random(INVITE_CODE_LENGTH), (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

function defaultRandom(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** 입력값 정리: 앞뒤 공백을 빼고 대문자로. 빈 값이면 "", 형식이 틀리면 null */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  if (!code) return "";
  return INVITE_CODE_RE.test(code) ? code : null;
}

/** 초대 링크: 첫 화면에 ?invite=코드 */
export function inviteLink(origin: string, code: string) {
  return `${origin}/?invite=${code}`;
}
