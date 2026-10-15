// 상점 규칙 (SHOP-01, SHOP-05). DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)
import { msg } from "@/lib/i18n";

// 판매 여부·미니룸 자리 계산은 서버(상점·꾸미기 저장 API)와 같은 코드를 쓴다
export { isForSale, type ItemType } from "@backend/shop/rules";
export {
  clampCharacterSpot,
  clampPct,
  clampPetSpot,
  PET_FLOOR,
  ROOM_CHARACTER_SPOT,
  type RoomSpot,
} from "@backend/shop/room";

export const SORTS = [
  { key: "level", label: msg("레벨순") },
  { key: "popular", label: msg("인기순") },
  { key: "price_desc", label: msg("비싼 순") },
  { key: "price_asc", label: msg("싼 순") },
  { key: "newest", label: msg("최신순") },
  { key: "owned", label: msg("보유순") },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

type Sortable = { id: number; price: number; requiredLevel: number; ownerCount: number; owned: boolean };

const cheap = (a: Sortable, b: Sortable) => a.price - b.price || a.requiredLevel - b.requiredLevel || a.id - b.id;
const lowLevel = (a: Sortable, b: Sortable) => a.requiredLevel - b.requiredLevel || a.id - b.id;

/** 상점 정렬 기준 (문서 저장소 cabinlog1070/docs의 docs/01-requirements.md SHOP-01 정렬 기준 표) */
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

/** 미니룸 안 앞뒤 순서: 아래쪽일수록 앞에. 가구는 가운데, 캐릭터·펫은 발 자리로 재서 16%쯤 차이를 맞춘다
 *  (기본 자리의 캐릭터 기준으로 가운데가 72%보다 아래인 가구가 앞에 보인다. 전과 같다) */
export const roomDepth = (kind: "furniture" | "character" | "pet", y: number) =>
  20 + Math.round(2 * (kind === "furniture" ? y : y - 16)) + (kind === "furniture" ? 0 : 1);

/** 꾸미기 화면 탭 (2026-10-13): 캐릭터 꾸미기 / 미니룸 꾸미기 / 집 테마. 주소 ?tab=으로 바로 연다 */
export type ClosetTab = "char" | "room" | "house";
export const CLOSET_TABS: ClosetTab[] = ["char", "room", "house"];
