import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { animalCares, animalSpecies, farmItems, notifications, pointLedger, profiles, userAnimals } from "@/db/schema";
import {
  animalStage,
  type CareAction,
  levelEggLevels,
  MAX_ACTIVE_ANIMALS,
  type PetAccessory,
  type PetGender,
  petLevel,
  POST_GROWTH,
} from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { recordLevelUps } from "@/server/notifications";
import type { Tx } from "@/server/points";

export type FarmAnimal = {
  id: number;
  status: "egg" | "growing" | "grown";
  growth: number;
  name: string | null; // 펫 이름 (알이면 NULL)
  speciesName: string | null;
  gender: PetGender | null;
  accessory: PetAccessory;
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
      carried: userAnimals.carried,
      speciesName: animalSpecies.name,
      assetKey: animalSpecies.assetKey,
      growExp: animalSpecies.growExp,
      maxLevel: animalSpecies.maxLevel,
      rewardExp: animalSpecies.rewardExp,
      rewardCoins: animalSpecies.rewardCoins,
    })
    .from(userAnimals)
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
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
    gender: r.gender,
    accessory: r.accessory,
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
    ...(hasStarter ? [] : [{ kind: "starter" as const, label: "농장 첫 알" }]),
    ...levelEggLevels(level)
      .filter((l) => !claimedLevels.has(l))
      .map((l) => ({ kind: "level" as const, level: l, label: `레벨 ${l} 보상 알` })),
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
    slotsLeft: MAX_ACTIVE_ANIMALS - active.length,
    potions: potion?.quantity ?? 0,
    species: species as SpeciesCard[],
    displayedId: profile?.displayedAnimalId ?? null,
  };
}

/** 다른 화면에 보이는 펫 (광장에서 따라다니는 펫, 미니룸 옆 펫, 프로필 전시 카드) */
export type PetShowcase = { id: number; name: string; assetKey: string; stage: ReturnType<typeof animalStage>; accessory: PetAccessory; level: number };

function toShowcase(r: { id: number; name: string | null; assetKey: string; growth: number; growExp: number; maxLevel: number; accessory: PetAccessory }): PetShowcase {
  return {
    id: r.id,
    name: r.name ?? "",
    assetKey: r.assetKey,
    stage: animalStage(r.growth, r.growExp),
    accessory: r.accessory,
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
};

/** 데리고 다니는 펫 (없으면 null) */
export async function getCarriedPet(userId: string): Promise<PetShowcase | null> {
  const [row] = await db
    .select(showcaseColumns)
    .from(userAnimals)
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(and(eq(userAnimals.userId, userId), eq(userAnimals.carried, true)));
  return row ? toShowcase(row) : null;
}

/** 프로필에 전시한 다 키운 동물 카드 (없으면 null) */
export async function getDisplayedCard(userId: string): Promise<(PetShowcase & { grownAt: Date | null }) | null> {
  const [row] = await db
    .select({ ...showcaseColumns, grownAt: userAnimals.grownAt })
    .from(profiles)
    .innerJoin(userAnimals, and(eq(userAnimals.id, profiles.displayedAnimalId), eq(userAnimals.status, "grown")))
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(eq(profiles.userId, userId));
  return row ? { ...toShowcase(row), grownAt: row.grownAt } : null;
}

/** 키우는 중인 알·동물 수 (다 키운 동물은 빼고) */
export async function countActive(tx: Tx, userId: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(userAnimals)
    .where(and(eq(userAnimals.userId, userId), inArray(userAnimals.status, ["egg", "growing"])));
  return n;
}

export type GrownAnimal = { id: number; name: string; rewardExp: number; rewardCoins: number };

/**
 * 동물에게 성장치를 더하고, 다 자라면 보상을 준다. lockUser를 건 트랜잭션 안에서 호출한다.
 * animalIds가 없으면 그 회원이 키우는 모든 동물 (글쓰기 보상)
 */
export type GrowthResult = { grown: GrownAnimal[]; leveled: { id: number; name: string; level: number }[] };

export async function addGrowth(tx: Tx, userId: string, amount: number, animalIds?: number[]): Promise<GrowthResult> {
  const where = and(
    eq(userAnimals.userId, userId),
    eq(userAnimals.status, "growing"),
    animalIds ? inArray(userAnimals.id, animalIds) : undefined,
  );
  const updated = await tx
    .update(userAnimals)
    .set({ growth: sql`${userAnimals.growth} + ${amount}` })
    .where(where)
    .returning({ id: userAnimals.id, growth: userAnimals.growth, speciesId: userAnimals.speciesId, name: userAnimals.name });
  if (!updated.length) return { grown: [], leveled: [] };

  const species = await tx
    .select()
    .from(animalSpecies)
    .where(inArray(animalSpecies.id, updated.map((u) => u.speciesId!)));
  const grown: GrownAnimal[] = [];
  const leveled: GrowthResult["leveled"] = [];
  for (const u of updated) {
    const sp = species.find((s) => s.id === u.speciesId)!;
    // 레벨이 오르면 오른 레벨마다 pet_level_up 알림 (GAME-08). 같은 동물·같은 레벨은 고유 인덱스로 한 번만
    const before = petLevel(u.growth - amount, sp.growExp, sp.maxLevel);
    const after = petLevel(Math.min(u.growth, sp.growExp), sp.growExp, sp.maxLevel);
    if (after > before) {
      const rows = [];
      for (let level = before + 1; level <= after; level++) rows.push({ userId, kind: "pet_level_up" as const, level, refId: String(u.id) });
      await tx.insert(notifications).values(rows).onConflictDoNothing();
      leveled.push({ id: u.id, name: u.name ?? sp.name, level: after });
    }
    if (u.growth < sp.growExp) continue;
    await tx
      .update(userAnimals)
      .set({ status: "grown", growth: sp.growExp, grownAt: new Date() })
      .where(eq(userAnimals.id, u.id));
    // 다 키운 보상은 종류마다 달라서 REWARD_RULES가 아니라 종류 표의 숫자로 기록한다
    if (sp.rewardExp || sp.rewardCoins) {
      await tx.insert(pointLedger).values({
        userId,
        reason: "farm_grown",
        expDelta: sp.rewardExp,
        coinDelta: sp.rewardCoins,
        refId: String(u.id),
      });
      await recordLevelUps(tx, userId, sp.rewardExp);
    }
    grown.push({ id: u.id, name: u.name ?? sp.name, rewardExp: sp.rewardExp, rewardCoins: sp.rewardCoins });
  }
  return { grown, leveled };
}

/** 공개 글로 보상을 받으면 키우는 동물이 모두 자란다 (회의 결정: 글 1개당 동물마다 10) */
export function growForPost(tx: Tx, userId: string) {
  return addGrowth(tx, userId, POST_GROWTH);
}
