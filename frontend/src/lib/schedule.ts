/**
 * 글 예약 발행 (POST-11)과 관리자 글 광장 게시판 게시 시간.
 * 예약 시각은 한국 시간으로 받는다 (입력칸 `datetime-local`의 "2026-10-14T09:00"을 한국 시간으로 읽는다)
 */

/** 예약은 지금부터 이 날 수 안으로만 */
export const SCHEDULE_MAX_DAYS = 365;

/** 관리자 글을 광장 게시판(마을 소식) 맨 위에 걸어 두는 시간 고르기 (시간). 0 = 걸지 않음 */
export const PIN_HOUR_OPTIONS = [0, 1, 3, 6, 12, 24, 48, 72, 168] as const;
/** 관리자 새 글의 기본 게시 시간 (전에 고정이던 7일) */
export const DEFAULT_PIN_HOURS = 168;
/** DB 제약(posts_pin_hours_check)과 같은 최대값 */
export const MAX_PIN_HOURS = 720;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → 한국 시간 "YYYY-MM-DDTHH:mm" (datetime-local 입력칸 값) */
export function toKstInput(d: Date) {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** 한국 시간 "YYYY-MM-DDTHH:mm" → Date. 모양이 틀리거나 없는 날짜면 null */
export function parseKstInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(utc);
  // 2월 30일처럼 없는 날짜는 다음 달로 넘어가므로 되돌려 확인한다
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || back.getUTCHours() !== h) return null;
  return new Date(utc - KST_OFFSET_MS);
}
