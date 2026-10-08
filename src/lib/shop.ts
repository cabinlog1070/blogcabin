// 상점 규칙 (SHOP-01, SHOP-05). DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)

export type ItemType = "character" | "background" | "furniture" | "avatar";

/** 상점에서 파는 아이템인가: 기본 아이템과 캐릭터(2026-10-06부터 판매 중단)는 팔지 않는다 */
export function isForSale(item: { type: ItemType; isStarter: boolean }): boolean {
  return !item.isStarter && item.type !== "character";
}

/** 한 미니룸에 놓을 수 있는 가구 수 (SHOP-05) */
export const MAX_FURNITURE = 5;

export const SORTS = [
  { key: "level", label: "레벨순" },
  { key: "popular", label: "인기순" },
  { key: "price_desc", label: "비싼 순" },
  { key: "price_asc", label: "싼 순" },
  { key: "newest", label: "최신순" },
  { key: "owned", label: "보유순" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

type Sortable = { id: number; price: number; requiredLevel: number; ownerCount: number; owned: boolean };

const cheap = (a: Sortable, b: Sortable) => a.price - b.price || a.requiredLevel - b.requiredLevel || a.id - b.id;
const lowLevel = (a: Sortable, b: Sortable) => a.requiredLevel - b.requiredLevel || a.id - b.id;

/** 상점 정렬 기준 (docs/01-requirements.md SHOP-01 정렬 기준 표) */
export function sortItems<T extends Sortable>(items: T[], sort: SortKey): T[] {
  const list = [...items];
  switch (sort) {
    case "level": // 필요 레벨 낮은 순, 같으면 싼 순
      return list.sort((a, b) => a.requiredLevel - b.requiredLevel || cheap(a, b));
    case "popular": // 가진 회원이 많은 순, 같으면 싼 순
      return list.sort((a, b) => b.ownerCount - a.ownerCount || cheap(a, b));
    case "price_desc": // 비싼 순, 같으면 필요 레벨 낮은 순
      return list.sort((a, b) => b.price - a.price || lowLevel(a, b));
    case "price_asc": // 싼 순, 같으면 필요 레벨 낮은 순
      return list.sort((a, b) => a.price - b.price || lowLevel(a, b));
    case "newest": // 새로 들어온 아이템(id 큰 것)부터
      return list.sort((a, b) => b.id - a.id);
    case "owned": // 내가 가진 것 먼저, 같으면 싼 순
      return list.sort((a, b) => Number(b.owned) - Number(a.owned) || cheap(a, b));
  }
}

/** 미니룸 위치(%)를 0~100 안으로 */
export function clampPct(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}
