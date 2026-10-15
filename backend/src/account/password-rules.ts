// 비밀번호 바꾸기 규칙 (DB를 쓰지 않아서 화면도 @backend/account/password-rules로 같이 읽는다)

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;

/** 로그인한 지 이 시간(분) 안이면, 소셜을 연동한 회원은 지금 비밀번호 없이 바꿀 수 있다 */
export const FRESH_MINUTES = 10;

/** 새 비밀번호 확인 (회원가입과 같은 규칙: 8~64자, 확인 칸과 같아야 한다). 틀리면 한국어 문장 */
export function checkNewPassword(password: unknown, confirm: unknown): string | null {
  const pw = typeof password === "string" ? password : "";
  if (pw.length < 8) return msg("비밀번호는 8자 이상이에요");
  if (pw.length > 64) return msg("비밀번호는 64자까지예요");
  if (pw !== confirm) return msg("비밀번호가 서로 달라요");
  return null;
}
