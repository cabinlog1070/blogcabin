// 동물 농장 규칙 (TOWN-09). DB를 쓰지 않는 순수 계산만 둔다
// 종류별 숫자(성장치, 보상)는 animal_species 테이블에 있다 (scripts/seed.ts)

/** 한 번에 키울 수 있는 알·동물 수 (다 키운 동물은 세지 않는다) */
export const MAX_ACTIVE_ANIMALS = 5;
/** 레벨 보상 알: 이 레벨마다 하나 */
export const EGG_LEVEL_EVERY = 5;
/** 상점(농장)에서 알 하나 값 */
export const EGG_PRICE = 100;
/** 공개 글로 보상을 받으면 키우는 동물마다 오르는 성장치 */
export const POST_GROWTH = 10;

/** 하루 한 번씩 하는 돌보기. 물 주기는 2026-10-08에 물약으로 바뀌었다 (DB 값 water는 옛 기록용) */
export type CareAction = "feed" | "pet";
export const CARE_ACTIONS: { action: CareAction; label: string; emoji: string; growth: number }[] = [
  { action: "feed", label: "밥 주기", emoji: "🥕", growth: 10 },
  { action: "pet", label: "쓰다듬기", emoji: "🤲", growth: 5 },
];

/** 물약: 코인으로 사서 하나 쓰면 성장 +30. 하루 횟수 제한은 없지만 가진 것만 쓸 수 있다 */
export const POTION_PRICE = 50;
export const POTION_GROWTH = 30;

/** 펫 이름 길이 (부화할 때 기본 = 종류 이름) */
export const PET_NAME_MAX = 10;
export function cleanPetName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return name.length >= 1 && [...name].length <= PET_NAME_MAX ? name : null;
}

export type PetGender = "male" | "female";
export const GENDER_LABEL: Record<PetGender, string> = { male: "♂ 수컷", female: "♀ 암컷" };

export type PetAccessory = "none" | "ribbon" | "flower" | "scarf";
export const PET_ACCESSORIES: { value: PetAccessory; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "ribbon", label: "🎀 리본" },
  { value: "flower", label: "🌼 꽃" },
  { value: "scarf", label: "🧣 스카프" },
];

/**
 * 펫 레벨 (동물마다 경험치 크기가 다르다): Lv.1에서 시작해 성장치가 growExp에 닿으면 maxLevel(다 자람).
 * 레벨 L이 되는 누적 성장치 = growExp × ((L−1)/(maxLevel−1))^1.4 (반올림). 높은 레벨일수록 한 레벨이 길다.
 */
export function petLevelExp(level: number, growExp: number, maxLevel: number): number {
  if (level <= 1) return 0;
  if (level >= maxLevel) return growExp;
  return Math.round(growExp * ((level - 1) / (maxLevel - 1)) ** 1.4);
}

export function petLevel(growth: number, growExp: number, maxLevel: number): number {
  let level = 1;
  while (level < maxLevel && growth >= petLevelExp(level + 1, growExp, maxLevel)) level++;
  return level;
}

/** 지금 레벨 안에서의 경험치 (상태창 막대): 현재 / 다음 레벨까지 */
export function petLevelProgress(growth: number, growExp: number, maxLevel: number) {
  const level = petLevel(growth, growExp, maxLevel);
  if (level >= maxLevel) return { level, current: 0, needed: 0, ratio: 1, isMax: true };
  const base = petLevelExp(level, growExp, maxLevel);
  const next = petLevelExp(level + 1, growExp, maxLevel);
  return { level, current: growth - base, needed: next - base, ratio: (growth - base) / (next - base), isMax: false };
}

/** 만난 날 표시: YYYY. MM. DD. (한국 시간) */
export function formatMetDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type AnimalStage = "baby" | "teen" | "adult";
export const STAGE_LABEL: Record<AnimalStage, string> = { baby: "아기", teen: "청소년", adult: "어른" };

/** 성장치로 단계 계산: 1/3 미만 아기, 다 자라기 전까지 청소년, 다 자라면 어른 */
export function animalStage(growth: number, growExp: number): AnimalStage {
  if (growth >= growExp) return "adult";
  return growth * 3 < growExp ? "baby" : "teen";
}

/** 지금 레벨까지 받을 수 있는 레벨 보상 알의 레벨 목록 (5, 10, 15, ...) */
export function levelEggLevels(level: number): number[] {
  const list: number[] = [];
  for (let l = EGG_LEVEL_EVERY; l <= level; l += EGG_LEVEL_EVERY) list.push(l);
  return list;
}

/** 비중(weight)에 따라 하나 고르기. r은 0 이상 1 미만 */
export function pickWeighted<T extends { hatchWeight: number }>(list: T[], r: number): T {
  const total = list.reduce((sum, x) => sum + x.hatchWeight, 0);
  let point = r * total;
  for (const x of list) {
    point -= x.hatchWeight;
    if (point < 0) return x;
  }
  return list[list.length - 1];
}

/** 이름 뒤에 받침에 맞는 조사: josa("곰", "이", "가") → 곰이. 받침이 ㄹ이면 (으)로의 "으"를 뺀다 */
export function josa(name: string, withFinal: string, withoutFinal: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const isHangul = code >= 0 && code <= 11171;
  const final = isHangul ? code % 28 : 0;
  const hasFinal = withFinal === "으로" ? final !== 0 && final !== 8 : final !== 0;
  return `${name}${hasFinal ? withFinal : withoutFinal}`;
}

/** 이름 뒤에 주격 조사 (토끼가, 송아지가, 병아리가 / 곰이) */
export function subject(name: string): string {
  return josa(name, "이", "가");
}
