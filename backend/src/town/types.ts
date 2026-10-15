import type { PetAccessory, PetColor } from "../farm/rules";

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
export type TownPet = { name: string; assetKey: string; stage: "baby" | "teen" | "adult"; accessory: PetAccessory; color?: PetColor };

/** 광장을 돌아다니는 이웃 주민 (TOWN-12): 즐겨찾기한 이웃이 데리고 다니는 펫과 함께 걷고, 가까이 가면 상태 메시지 말풍선을 띄운다 */
export type TownResident = {
  slug: string;
  nickname: string;
  look: string; // 캐릭터 모습 키 (입은 꾸미기 포함)
  statusMessage: string | null;
  pet: Omit<TownPet, "name"> | null;
};
