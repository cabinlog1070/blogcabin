// 문의함 화면 글자 (문의하기 화면과 관리자 문의함이 같이 쓴다). 종류·상태 값은 backend/src/db/schema.ts의 INQUIRY_TOPICS·INQUIRY_STATUSES
import { msg } from "@/lib/i18n";

export const INQUIRY_TOPIC_LABELS = {
  password: msg("비밀번호"),
  account: msg("계정"),
  bug: msg("오류 신고"),
  other: msg("기타"),
} as const;
export type InquiryTopic = keyof typeof INQUIRY_TOPIC_LABELS;

export const INQUIRY_STATUS_LABELS = {
  waiting: msg("답 기다리는 중"),
  answered: msg("답변함"),
  closed: msg("처리 완료"),
} as const;
export type InquiryStatus = keyof typeof INQUIRY_STATUS_LABELS;

/** 상태 배지 색 */
export const INQUIRY_STATUS_CLASS: Record<InquiryStatus, string> = {
  waiting: "bg-sun/60 text-ink",
  answered: "bg-leaf text-white",
  closed: "bg-line text-ink-soft",
};

export const INQUIRY_CONTENT_MAX = 2000;
