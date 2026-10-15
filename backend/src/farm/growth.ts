// 농장 동물 수 세기와 성장 (TOWN-09). 농장 API와 글쓰기 보상(화면의 글 저장)이 같이 쓴다
import { and, eq, inArray, sql } from "drizzle-orm";
import { animalSpecies, notifications, pointLedger, userAnimals } from "../db/schema";
import type { Tx } from "../game/points";
import { recordLevelUps } from "../notifications";
import { petLevel, POST_GROWTH } from "./rules";

/** 둥지의 알 수(egg) 또는 풀밭에서 키우는 동물 수(growing). 다 키운 동물은 세지 않는다 */
export async function countAnimals(tx: Tx, userId: string, status: "egg" | "growing") {
  const [{ n }] = await tx
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(userAnimals)
    .where(and(eq(userAnimals.userId, userId), eq(userAnimals.status, status)));
  return n;
}

export type GrownAnimal = { id: number; name: string; speciesName: string; rewardExp: number; rewardCoins: number };

/**
 * 동물에게 성장치를 더하고, 다 자라면 보상을 준다. lockUser를 건 트랜잭션 안에서 호출한다.
 * animalIds가 없으면 그 회원이 키우는 모든 동물 (글쓰기 보상)
 */
export type GrowthResult = { grown: GrownAnimal[]; leveled: { id: number; name: string; speciesName: string; level: number }[] };

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
      leveled.push({ id: u.id, name: u.name ?? sp.name, speciesName: sp.name, level: after });
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
    grown.push({ id: u.id, name: u.name ?? sp.name, speciesName: sp.name, rewardExp: sp.rewardExp, rewardCoins: sp.rewardCoins });
  }
  return { grown, leveled };
}

/** 공개 글로 보상을 받으면 키우는 동물이 모두 자란다 (회의 결정: 글 1개당 동물마다 10) */
export function growForPost(tx: Tx, userId: string) {
  return addGrowth(tx, userId, POST_GROWTH);
}
