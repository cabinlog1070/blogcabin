// 닉네임·블로그 이름 규칙: 온보딩(AUTH-02)과 블로그 관리 기본 정보(BLOG-03)가 함께 쓴다. 중복은 DB UNIQUE가 막는다 (AUTH-03)

/** 화면이 t()로 바꿀 문장 표시 (값은 그대로) */
const msg = <S extends string>(text: S): S => text;

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
export const NICKNAME_TOO_SHORT = msg("닉네임은 2자 이상이에요");
export const NICKNAME_TOO_LONG = msg("닉네임은 12자까지예요");

/** 닉네임이 규칙에 맞지 않으면 그 이유(한국어 문장), 맞으면 null. 앞뒤 공백은 먼저 지운다 */
export function nicknameError(nickname: string): string | null {
  if (nickname.length < NICKNAME_MIN) return NICKNAME_TOO_SHORT;
  if (nickname.length > NICKNAME_MAX) return NICKNAME_TOO_LONG;
  return null;
}

/** 관리자 계정의 닉네임 (AUTH-08). 회원은 쓸 수 없다 */
export const ADMIN_NICKNAME = "관리자";

/** 관리자 공지 블로그(/@notice)의 이름. 관리자도 블로그 관리에서 바꿀 수 없다 (BLOG-03) */
export const ADMIN_BLOG_TITLE = "BlogCabin 공지사항";
