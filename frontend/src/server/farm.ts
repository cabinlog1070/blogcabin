import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { animalCares, animalSpecies, farmItems, profiles, userAnimals } from "@/db/schema";
import {
  petDisplayName,
  animalStage,
  type CareAction,
  levelEggLevels,
  MAX_ACTIVE_ANIMALS,
  MAX_NEST_EGGS,
  type PetAccessory,
  type PetColor,
  type PetGender,
  petLevel,
} from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { msg } from "@/lib/i18n";
import { getT } from "@/server/i18n";

// 동물 수 세기·성장은 서버(농장 API)와 같은 코드를 쓴다
export { addGrowth, countAnimals, growForPost, type GrowthResult, type GrownAnimal } from "@backend/farm/growth";

export type FarmAnimal = {
  id: number;
  status: "egg" | "growing" | "grown";
  growth: number;
  name: string | null; // 펫 이름 (알이면 NULL)
  speciesName: string | null;
  /** 나올 펫이 정해진 알이면 그 펫 종류 이름 (예전 캐릭터 대신 받은 알) */
  eggSpeciesName: string | null;
  gender: PetGender | null;
  accessory: PetAccessory;
  color: PetColor;
  carried: boolean;
  assetKey: string | null;
  growExp: number | null;
  maxLevel: number | null;
  rewardExp: number | null;
  rewardCoins: number | null;
  hatchedAt: Date | null;
  grownAt: Date | null;
  caredToday: CareAction[];
};

export type SpeciesCard = { id: number; name: string; assetKey: string; growExp: number; maxLevel: number; hatchWeight: number };

const eggSpecies = alias(animalSpecies, "egg_species");

/** 농장 화면에 필요한 것: 키우는 알·동물, 다 키운 동물, 받을 수 있는 무료 알 */
export async function getFarm(userId: string, level: number) {
  const rows = await db
    .select({
      id: userAnimals.id,
      status: userAnimals.status,
      growth: userAnimals.growth,
      source: userAnimals.source,
      sourceLevel: userAnimals.sourceLevel,
      grownAt: userAnimals.grownAt,
      hatchedAt: userAnimals.hatchedAt,
      name: userAnimals.name,
      gender: userAnimals.gender,
      accessory: userAnimals.accessory,
      color: userAnimals.color,
      carried: userAnimals.carried,
      speciesName: animalSpecies.name,
      eggSpeciesName: eggSpecies.name,
      assetKey: animalSpecies.assetKey,
      growExp: animalSpecies.growExp,
      maxLevel: animalSpecies.maxLevel,
      rewardExp: animalSpecies.rewardExp,
      rewardCoins: animalSpecies.rewardCoins,
    })
    .from(userAnimals)
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .leftJoin(eggSpecies, eq(eggSpecies.id, userAnimals.eggSpeciesId))
    .where(eq(userAnimals.userId, userId))
    .orderBy(asc(userAnimals.id));

  const cares = rows.length
    ? await db
        .select({ animalId: animalCares.animalId, action: animalCares.action })
        .from(animalCares)
        .where(and(inArray(animalCares.animalId, rows.map((r) => r.id)), eq(animalCares.date, todayKST())))
    : [];

  const animals: FarmAnimal[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    growth: r.growth,
    name: r.name,
    speciesName: r.speciesName,
    eggSpeciesName: r.eggSpeciesName,
    gender: r.gender,
    accessory: r.accessory,
    color: r.color,
    carried: r.carried,
    assetKey: r.assetKey,
    growExp: r.growExp,
    maxLevel: r.maxLevel,
    rewardExp: r.rewardExp,
    rewardCoins: r.rewardCoins,
    hatchedAt: r.hatchedAt,
    grownAt: r.grownAt,
    // 옛 물 주기(water) 기록은 빼고 본다
    caredToday: cares.filter((c) => c.animalId === r.id && c.action !== "water").map((c) => c.action as CareAction),
  }));
  const active = animals.filter((a) => a.status !== "grown");
  const grown = animals.filter((a) => a.status === "grown").sort((a, b) => (b.grownAt?.getTime() ?? 0) - (a.grownAt?.getTime() ?? 0));

  const hasStarter = rows.some((r) => r.source === "starter");
  const claimedLevels = new Set(rows.filter((r) => r.source === "level").map((r) => r.sourceLevel));
  const freeEggs = [
    ...(hasStarter ? [] : [{ kind: "starter" as const, label: msg("농장 첫 알") }]),
    ...levelEggLevels(level)
      .filter((l) => !claimedLevels.has(l))
      // label은 화면에서 t(label, { level })로 바꾼다
      .map((l) => ({ kind: "level" as const, level: l, label: msg("레벨 {level} 보상 알") })),
  ];

  const [[potion], species, [profile]] = await Promise.all([
    db.select({ quantity: farmItems.quantity }).from(farmItems).where(and(eq(farmItems.userId, userId), eq(farmItems.kind, "potion"))),
    db
      .select({
        id: animalSpecies.id,
        name: animalSpecies.name,
        assetKey: animalSpecies.assetKey,
        growExp: animalSpecies.growExp,
        maxLevel: animalSpecies.maxLevel,
        hatchWeight: animalSpecies.hatchWeight,
      })
      .from(animalSpecies)
      .orderBy(asc(animalSpecies.growExp)),
    db.select({ displayedAnimalId: profiles.displayedAnimalId }).from(profiles).where(eq(profiles.userId, userId)),
  ]);

  return {
    active,
    grown,
    freeEggs,
    // 알 둥지 자리(부화 전 알)와 풀밭 자리(키우는 동물)는 따로 센다
    nestLeft: MAX_NEST_EGGS - active.filter((a) => a.status === "egg").length,
    fieldLeft: MAX_ACTIVE_ANIMALS - active.filter((a) => a.status === "growing").length,
    potions: potion?.quantity ?? 0,
    species: species as SpeciesCard[],
    displayedId: profile?.displayedAnimalId ?? null,
  };
}

/** 다른 화면에 보이는 펫 (광장에서 따라다니는 펫, 미니룸 옆 펫, 프로필 전시 카드) */
export type PetShowcase = { id: number; name: string; assetKey: string; stage: ReturnType<typeof animalStage>; accessory: PetAccessory; color: PetColor; level: number };

function toShowcase(r: { id: number; name: string | null; assetKey: string; growth: number; growExp: number; maxLevel: number; accessory: PetAccessory; color: PetColor }): PetShowcase {
  return {
    id: r.id,
    name: r.name ?? "",
    assetKey: r.assetKey,
    stage: animalStage(r.growth, r.growExp),
    accessory: r.accessory,
    color: r.color,
    level: petLevel(r.growth, r.growExp, r.maxLevel),
  };
}

const showcaseColumns = {
  id: userAnimals.id,
  name: userAnimals.name,
  assetKey: animalSpecies.assetKey,
  growth: userAnimals.growth,
  growExp: animalSpecies.growExp,
  maxLevel: animalSpecies.maxLevel,
  accessory: userAnimals.accessory,
  color: userAnimals.color,
  speciesName: animalSpecies.name,
};

/** 보여 줄 펫 이름: 이름을 안 바꿨으면(동물 이름 그대로) 화면 언어로 (petDisplayName) */
async function shownName<P extends { name: string }>(pet: P, speciesName: string): Promise<P> {
  return { ...pet, name: petDisplayName(await getT(), pet.name, speciesName) };
}

/** 데리고 다니는 펫 (없으면 null) */
export async function getCarriedPet(userId: string): Promise<PetShowcase | null> {
  const [row] = await db
    .select(showcaseColumns)
    .from(userAnimals)
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(and(eq(userAnimals.userId, userId), eq(userAnimals.carried, true)));
  return row ? shownName(toShowcase(row), row.speciesName) : null;
}

/** 프로필에 전시한 다 키운 동물 카드 (없으면 null) */
export async function getDisplayedCard(userId: string): Promise<(PetShowcase & { grownAt: Date | null }) | null> {
  const [row] = await db
    .select({ ...showcaseColumns, grownAt: userAnimals.grownAt })
    .from(profiles)
    .innerJoin(userAnimals, and(eq(userAnimals.id, profiles.displayedAnimalId), eq(userAnimals.status, "grown")))
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(eq(profiles.userId, userId));
  return row ? shownName({ ...toShowcase(row), grownAt: row.grownAt }, row.speciesName) : null;
}
