export type TownHouse = {
  slug: string;
  title: string;
  nickname: string;
  characterAsset: string;
  backgroundAsset: string;
  stage: 1 | 2 | 3; // 집 성장 단계 = 주인 레벨로 정함 (TOWN-11)
  roofColor: string | null; // 고른 지붕 색 (TOWN-07). null이면 배경 색
  favorite?: boolean; // 내가 즐겨찾기한 이웃 (TOWN-08, 🏘 이웃집 패널의 ⭐)
};

/** 데리고 다니는 펫 (TOWN-09): 광장에서 내 캐릭터 뒤를 따라온다 */
export type TownPet = { name: string; assetKey: string; stage: "baby" | "teen" | "adult"; accessory: "none" | "ribbon" | "flower" | "scarf" };

export type TownData = {
  player: { nickname: string; characterAsset: string; pet: TownPet | null } | null; // null = 로그인하지 않은 방문자
  myHouse: TownHouse | null;
  neighbors: TownHouse[]; // 광장에 집으로 보이는 블로그 (회원: 즐겨찾기 최대 10, 방문자: 인기 100곳 중 무작위 10)
  panel: TownHouse[]; // 🏘 이웃집 패널 목록 (회원: 내 이웃 전부 ⭐ 먼저, 방문자: 광장의 집과 같음)
  noFavorites: boolean; // 즐겨찾기한 이웃이 없는 회원 → 안내 문구 (TOWN-04)
  attendedToday: boolean;
};

/** 광장 건물을 눌렀을 때 이동할 곳 */
export type TownTarget =
  | { kind: "link"; href: string }
  | { kind: "login" };
