// 상점 규칙 (SHOP-01). 화면은 @/lib/shop으로 다시 읽는다
import type { ITEM_TYPES } from "../db/schema";

export type ItemType = (typeof ITEM_TYPES)[number];

/** 상점에서 파는 아이템인가: 기본 아이템과 캐릭터(2026-10-06부터 판매 중단)는 팔지 않는다 */
export function isForSale(item: { type: ItemType; isStarter: boolean }): boolean {
  return !item.isStarter && item.type !== "character";
}
