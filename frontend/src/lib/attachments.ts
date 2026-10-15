// 글 첨부(사진·파일) 규칙: 브라우저와 서버가 같은 값을 쓴다 (POST-07 사진, POST-09 파일).
// 규칙은 서버(backend/src/attachments/rules.ts)에 있고, 여기서는 화면 언어가 필요한 것만 더한다

import { makeT, type T } from "@/lib/i18n";
import { FILE_CARD_LABEL, formatBytes } from "@backend/attachments/rules";

export * from "@backend/attachments/rules";

/** 파일 카드의 화면 읽기용 이름 */
// 글 HTML에 저장되는 문구라 기본은 한국어로 둔다 (화면 언어로 바꾸려면 t를 넘긴다)
export const fileCardLabel = (name: string, size: number, t: T = makeT("ko")) =>
  t(FILE_CARD_LABEL, { name, size: formatBytes(size) });

