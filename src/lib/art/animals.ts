// 동물 농장 동물 그림 (SVG). 2026-10-11 크레용 그림체 (crayon-animals.ts).
// 정면을 본다. 그림은 정사각형, 발바닥은 아래 가운데 y≈0.906 (예전 그림과 같은 자리).
// 단계(아기·청소년·어른)에 따라 크기와 생김새가 다르다. 펫 꾸미기(리본·꽃·스카프)는 몸과 함께 커진다.
import type { AnimalStage, PetAccessory, PetColor } from "@/lib/farm";
import { pastel } from "./crayon";
import { animal, egg, silhouette, type AnimalKind } from "./crayon-animals";

/** DB asset_key → 그림 종류 */
const KIND_BY_ASSET: Record<string, AnimalKind> = {
  "animal.chick": "chick",
  "animal.bunny": "rabbit",
  "animal.piglet": "pig",
  "animal.calf": "cow",
  "animal.lamb": "sheep",
  // 2026-10-12 새 동물 13종
  "animal.tiger": "tiger",
  "animal.dragon": "dragon",
  "animal.raccoon": "raccoon",
  "animal.monkey": "monkey",
  "animal.cat": "cat",
  "animal.bear": "bear",
  "animal.fox": "fox",
  "animal.hamster": "hamster",
  "animal.unicorn": "unicorn",
  "animal.wolf": "wolf",
  "animal.turtle": "turtle",
  "animal.dino": "dino",
  "animal.mole": "mole",
};
const kindOf = (assetKey: string): AnimalKind => KIND_BY_ASSET[assetKey] ?? "chick";

/** 동물 SVG. 단계가 낮을수록 작게 (발바닥 기준으로 줄인다). accessory = 펫 꾸미기, color = 펫 색 */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64, accessory: PetAccessory = "none", color: PetColor = "default"): string {
  return pastel(() => animal(kindOf(assetKey), stage, accessory, size, color)); // 2026-10-12 파스텔 크레용 그림체
}

/** 아직 부화하지 않은 알 (크림색 점박이 달걀) */
export function eggSvg(size = 64): string {
  return pastel(() => egg(size));
}

/** 아직 모으지 못한 동물의 실루엣 (카드 도감). 그림 전체를 한 색으로 덮는다 */
export function silhouetteSvg(assetKey: string, size = 64): string {
  return pastel(() => silhouette(kindOf(assetKey), size));
}

export function toAnimalDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
