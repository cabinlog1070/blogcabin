// 마을 소식에서 연 글은 이전·다음 글이 글쓴이의 블로그가 아니라 열었던 목록(마을 전체·💛 이웃 새 글·태그) 순서를 따른다.
// 목록의 글 링크에 어느 목록인지 붙이고(?from=feed), 글 화면이 그 값을 읽어 이전·다음 글 링크에도 그대로 붙인다.

export type FeedSource = { tab: "all" | "following" } | { tag: string };

/** 글 주소에 붙일 쿼리 (물음표 없이) */
export function feedFrom(src: FeedSource): string {
  if ("tag" in src) return `from=tag&tag=${encodeURIComponent(src.tag)}`;
  return `from=${src.tab === "all" ? "feed" : "following"}`;
}

/** 글 화면의 searchParams에서 목록을 읽는다. 모르는 값이면 null (블로그 안의 이전·다음 글) */
export function parseFeedFrom(sp: Record<string, string | string[] | undefined>): FeedSource | null {
  const from = typeof sp.from === "string" ? sp.from : undefined;
  if (from === "feed") return { tab: "all" };
  if (from === "following") return { tab: "following" };
  if (from === "tag" && typeof sp.tag === "string" && sp.tag) return { tag: sp.tag };
  return null;
}
