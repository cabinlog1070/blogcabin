import type { TownHouse, TownPet } from "@backend/town/types";

// 집·펫·주민 모양은 서버(광장 API)가 돌려주는 모양 그대로
export type { TownHouse, TownPet, TownResident } from "@backend/town/types";

export type TownData = {
  player: { nickname: string; characterAsset: string; pet: TownPet | null } | null; // null = 로그인하지 않은 방문자
  myHouse: TownHouse | null;
  neighbors: TownHouse[]; // 광장에 집으로 보이는 블로그 (회원: 즐겨찾기 최대 10, 방문자: 인기 100곳 중 무작위 10)
  residents: import("@backend/town/types").TownResident[]; // 광장을 돌아다니는 즐겨찾기 이웃 (회원만, 방문자는 빈 목록)
  panel: TownHouse[]; // 🏘 이웃집 패널 목록 (회원: 내 이웃 전부 ⭐ 먼저, 방문자: 광장의 집과 같음)
  noFavorites: boolean; // 즐겨찾기한 이웃이 없는 회원 → 안내 문구 (TOWN-04)
  attendedToday: boolean;
  quests: { done: number; total: number } | null; // 오늘의 퀘스트 진행 (출석 도장 판에 보인다). 방문자는 null
};

/** 광장 건물을 눌렀을 때 이동할 곳 */
export type TownTarget =
  | { kind: "link"; href: string }
  | { kind: "login" };
