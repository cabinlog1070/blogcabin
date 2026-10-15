// 농장·펫 읽기는 서버 코드(backend/src/farm/read.ts, 농장 읽기 API)에 있고, 여기엔 화면 언어로 바꾸는 것만 둔다
import "server-only";
import { petDisplayName } from "@/lib/farm";
import type { T } from "@/lib/i18n";
import { getCarriedShowcase, getDisplayedCard as getDisplayedCardRaw, type PetShowcase } from "@backend/farm/read";
import { getT } from "@/server/i18n";

export type { FarmAnimal, PetShowcase, SpeciesCard } from "@backend/farm/read";

/** 보여 줄 펫 이름: 이름을 안 바꿨으면(동물 이름 그대로) 화면 언어의 동물 이름으로 (petDisplayName) */
export function petShowcaseName<P extends PetShowcase>(t: T, pet: P | null): P | null {
  return pet ? { ...pet, name: petDisplayName(t, pet.name, pet.speciesName) } : null;
}

/** 데리고 다니는 펫 (없으면 null) */
export async function getCarriedPet(userId: string) {
  return petShowcaseName(await getT(), await getCarriedShowcase(userId));
}

/** 프로필에 전시한 다 키운 동물 카드 (없으면 null) */
export async function getDisplayedCard(userId: string) {
  return petShowcaseName(await getT(), await getDisplayedCardRaw(userId));
}
