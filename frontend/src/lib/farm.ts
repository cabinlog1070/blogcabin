// 동물 농장 규칙 (TOWN-09). DB를 쓰지 않는 순수 계산만 둔다
// 숫자·돌보기·꾸미기 목록·레벨 계산은 서버(농장 API)와 같은 코드를 쓰고, 여기엔 화면에 보이는 글자만 더한다
import { LOCALE_TAGS, msg, type Locale, type T } from "@/lib/i18n";
import type { AnimalStage, PetGender } from "@backend/farm/rules";

export * from "@backend/farm/rules";

export const GENDER_LABEL: Record<PetGender, string> = { male: msg("♂ 수컷"), female: msg("♀ 암컷") };

/** 만난 날 표시: YYYY. MM. DD. (한국 시간, 일본어 화면은 YYYY/MM/DD) */
export function formatMetDate(date: Date, locale: Locale = "ko"): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export const STAGE_LABEL: Record<AnimalStage, string> = { baby: msg("아기"), teen: msg("청소년"), adult: msg("어른") };

/** 이름 뒤에 받침에 맞는 조사: josa("곰", "이", "가") → 곰이. 받침이 ㄹ이면 (으)로의 "으"를 뺀다 */
export function josa(name: string, withFinal: string, withoutFinal: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const isHangul = code >= 0 && code <= 11171;
  const final = isHangul ? code % 28 : 0;
  const hasFinal = withFinal === "으로" ? final !== 0 && final !== 8 : final !== 0;
  return `${name}${hasFinal ? withFinal : withoutFinal}`;
}

/** 이름 뒤에 주격 조사 (토끼가, 송아지가, 병아리가 / 곰이) */
export function subject(name: string): string {
  return josa(name, "이", "가");
}

/** 문장에 넣을 이름: 한국어는 받침에 맞는 조사를 붙이고, 일본어는 이름만 (조사는 번역문에 있다) */
export function withJosa(locale: Locale, name: string, withFinal: string, withoutFinal: string): string {
  return locale === "ko" ? josa(name, withFinal, withoutFinal) : name;
}

/** 펫 이름 표시: 바꾸지 않은 기본 이름(= 종류 이름)은 번역하고, 회원이 지은 이름은 그대로 둔다 */
export function petDisplayName(t: T, name: string, speciesName: string | null | undefined): string {
  return speciesName && name === speciesName ? t(name) : name;
}
