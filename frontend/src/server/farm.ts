// 농장·펫 읽기는 서버 코드(backend/src/farm/read.ts, 농장 읽기 API)에 있고, 여기엔 화면 언어로 바꾸는 것만 둔다
import { petDisplayName } from "@/lib/farm";
import type { T } from "@/lib/i18n";
import type { PetShowcase } from "@backend/farm/read";

export type { FarmAnimal, PetShowcase, SpeciesCard } from "@backend/farm/read";

/** 보여 줄 펫 이름: 이름을 안 바꿨으면(동물 이름 그대로) 화면 언어의 동물 이름으로 (petDisplayName) */
export function petShowcaseName<P extends PetShowcase>(t: T, pet: P | null): P | null {
  return pet ? { ...pet, name: petDisplayName(t, pet.name, pet.speciesName) } : null;
}
