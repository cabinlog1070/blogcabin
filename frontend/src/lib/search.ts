// 마을 검색 (BLOG-07, spec 002 FR-042·FR-043). DB를 쓰지 않는 순수 함수
export const SEARCH_MAX_LENGTH = 50;
/** 블로그 구역에 보여줄 최대 개수 */
export const SEARCH_BLOG_LIMIT = 5;

export type SearchQuery =
  | { kind: "none" } // 검색창만 (q가 없거나 50자를 넘는 조작한 요청)
  | { kind: "empty" } // 공백만 넣고 검색함 → `검색어를 입력해 주세요`
  | { kind: "ok"; q: string };

/** 주소의 q 값을 검사한다: 앞뒤 공백을 빼고 1~50자 */
export function parseSearchQuery(raw: string | string[] | undefined): SearchQuery {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return { kind: "none" };
  const q = value.trim();
  if (!q) return { kind: "empty" };
  if ([...q].length > SEARCH_MAX_LENGTH) return { kind: "none" };
  return { kind: "ok", q };
}

/** ILIKE 패턴용: %, _, \ 를 글자 그대로 찾도록 막고 앞뒤에 %를 붙인다 */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
