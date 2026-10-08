"use server";

import { randomInt } from "node:crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { animalCares, animalSpecies, farmItems, pointLedger, profiles, userAnimals } from "@/db/schema";
import {
  CARE_ACTIONS,
  type CareAction,
  cleanPetName,
  EGG_PRICE,
  levelEggLevels,
  MAX_ACTIVE_ANIMALS,
  PET_ACCESSORIES,
  PET_NAME_MAX,
  type PetAccessory,
  josa,
  pickWeighted,
  POTION_GROWTH,
  POTION_PRICE,
  subject,
} from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { addGrowth, countActive, type GrowthResult } from "@/server/farm";
import { getWallet, grantReward, lockUser } from "@/server/points";

export type FarmResult = { ok: true; text: string } | { ok: false; text: string };

const FULL = `한 번에 ${MAX_ACTIVE_ANIMALS}마리까지 키울 수 있어요. 다 키운 뒤에 새 알을 받아 주세요`;

/** 무료 알 받기: 농장 첫 알(starter) 또는 레벨 보상 알(5레벨마다) */
export async function claimEgg(kind: "starter" | "level", level?: number): Promise<FarmResult> {
  const viewer = await requireMember();
  if (kind !== "starter" && kind !== "level") return { ok: false, text: "잘못된 요청이에요" };
  try {
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, viewer.userId);
      if ((await countActive(tx, viewer.userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, text: FULL };
      if (kind === "level") {
        const wallet = await getWallet(viewer.userId, tx);
        if (!level || !levelEggLevels(wallet.level).includes(level)) return { ok: false, text: "아직 받을 수 없는 알이에요" };
      }
      await tx.insert(userAnimals).values({
        userId: viewer.userId,
        source: kind,
        sourceLevel: kind === "level" ? level : null,
      });
      return { ok: true, text: "🥚 알을 받았어요! [부화시키기]를 눌러 보세요" };
    });
    revalidatePath("/farm");
    return result;
  } catch (err) {
    // 같은 알을 두 번 받으려 하면 고유 인덱스(starter, level)에 막힌다
    if (uniqueViolation(err) !== null) return { ok: false, text: "이미 받은 알이에요" };
    throw err;
  }
}

/** 코인으로 알 사기 */
export async function buyEgg(): Promise<FarmResult> {
  const viewer = await requireMember();
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    if ((await countActive(tx, viewer.userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, text: FULL };
    const wallet = await getWallet(viewer.userId, tx);
    if (wallet.coins < EGG_PRICE) return { ok: false, text: `코인이 ${EGG_PRICE - wallet.coins}개 부족해요` };
    const [egg] = await tx.insert(userAnimals).values({ userId: viewer.userId, source: "shop" }).returning({ id: userAnimals.id });
    await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "egg_purchase", coinDelta: -EGG_PRICE, refId: String(egg.id) });
    return { ok: true, text: `🥚 알을 샀어요! (🪙 −${EGG_PRICE})` };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 성장 결과를 한 줄로: 다 자랐으면 보상, 레벨이 올랐으면 새 레벨 */
function growthText(base: string, { grown, leveled }: GrowthResult) {
  if (grown[0]) return `🎉 ${subject(grown[0].name)} 다 자랐어요! 경험치 +${grown[0].rewardExp}, 🪙 +${grown[0].rewardCoins} · 카드 도감에 모였어요`;
  if (leveled[0]) return `${base} · 🐣 ${subject(leveled[0].name)} Lv.${leveled[0].level}이 되었어요!`;
  return base;
}

/** 알 부화: 종류는 비중에 따라 랜덤, 성별도 랜덤, 이름은 종류 이름 */
export async function hatchEgg(animalId: number): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  if (id === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const species = await tx.select().from(animalSpecies);
    if (!species.length) return { ok: false, text: "동물 종류가 없어요. npm run db:seed 를 실행해 주세요" };
    const sp = pickWeighted(species, randomInt(1_000_000) / 1_000_000);
    const [hatched] = await tx
      .update(userAnimals)
      .set({ status: "growing", speciesId: sp.id, hatchedAt: new Date(), name: sp.name, gender: randomInt(2) ? "male" : "female" })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "egg")))
      .returning({ id: userAnimals.id });
    if (!hatched) return { ok: false, text: "부화시킬 수 있는 알이 아니에요" };
    return { ok: true, text: `🐣 ${subject(sp.name)} 태어났어요!` };
  });
  revalidatePath("/farm");
  return result;
}

/** 돌보기: 동물 한 마리에 같은 돌보기는 하루 한 번. 성장치 + 경험치 조금 */
export async function careAnimal(animalId: number, action: CareAction): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  const care = CARE_ACTIONS.find((c) => c.action === action); // 물 주기(water)는 더 이상 받지 않는다
  if (id === null || !care) return { ok: false, text: "잘못된 요청이에요" };
  try {
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, viewer.userId);
      const [animal] = await tx
        .select({ id: userAnimals.id })
        .from(userAnimals)
        .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "growing")));
      if (!animal) return { ok: false, text: "돌볼 수 있는 동물이 아니에요" };
      await tx.insert(animalCares).values({ animalId: id, action, date: todayKST() });
      await grantReward(tx, viewer.userId, "farm_care", id);
      const growth = await addGrowth(tx, viewer.userId, care.growth, [id]);
      return { ok: true, text: growthText(`${care.emoji} ${care.label} 완료! 경험치 +${care.growth}`, growth) };
    });
    revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, text: `오늘은 이미 ${care.label}를 했어요` };
    throw err;
  }
}

/** 물약 사기: 🪙 50, 가방(farm_items)에 하나 더한다 */
export async function buyPotion(): Promise<FarmResult> {
  const viewer = await requireMember();
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const wallet = await getWallet(viewer.userId, tx);
    if (wallet.coins < POTION_PRICE) return { ok: false, text: `코인이 ${POTION_PRICE - wallet.coins}개 부족해요` };
    await tx
      .insert(farmItems)
      .values({ userId: viewer.userId, kind: "potion", quantity: 1 })
      .onConflictDoUpdate({ target: [farmItems.userId, farmItems.kind], set: { quantity: sql`${farmItems.quantity} + 1` } });
    await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "potion_purchase", coinDelta: -POTION_PRICE });
    return { ok: true, text: `🧪 물약을 샀어요! (🪙 −${POTION_PRICE})` };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 물약 쓰기: 가진 물약 하나로 성장 +30. 하루 횟수 제한은 없다 */
export async function givePotion(animalId: number): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  if (id === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const [animal] = await tx
      .select({ id: userAnimals.id })
      .from(userAnimals)
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "growing")));
    if (!animal) return { ok: false, text: "물약을 쓸 수 있는 동물이 아니에요" };
    const [used] = await tx
      .update(farmItems)
      .set({ quantity: sql`${farmItems.quantity} - 1` })
      .where(and(eq(farmItems.userId, viewer.userId), eq(farmItems.kind, "potion"), gt(farmItems.quantity, 0)))
      .returning({ quantity: farmItems.quantity });
    if (!used) return { ok: false, text: "물약이 없어요. 농장 가게에서 사 주세요" };
    const growth = await addGrowth(tx, viewer.userId, POTION_GROWTH, [id]);
    return { ok: true, text: growthText(`🧪 물약을 썼어요! 경험치 +${POTION_GROWTH}`, growth) };
  });
  revalidatePath("/", "layout");
  return result;
}

/** 펫 이름 바꾸기 (1~10자) */
export async function renamePet(animalId: number, rawName: string): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  const name = typeof rawName === "string" ? cleanPetName(rawName) : null;
  if (id === null) return { ok: false, text: "잘못된 요청이에요" };
  if (!name) return { ok: false, text: `이름은 1~${PET_NAME_MAX}자로 지어 주세요` };
  const [row] = await db
    .update(userAnimals)
    .set({ name })
    .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), ne(userAnimals.status, "egg")))
    .returning({ id: userAnimals.id });
  if (!row) return { ok: false, text: "이름을 바꿀 수 있는 동물이 아니에요" };
  revalidatePath("/farm");
  return { ok: true, text: `✏️ 이름을 ${josa(name, "으로", "로")} 바꿨어요` };
}

/** 데리고 다니기 (animalId) / 두고 다니기 (null). 한 마리만: 다른 펫을 고르면 바뀐다 */
export async function setCarriedPet(animalId: number | null): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = animalId === null ? null : parseId(animalId);
  if (animalId !== null && id === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    // 먼저 지금 데리고 다니는 펫을 내려놓는다 (부분 고유 인덱스: 회원당 carried 한 마리)
    await tx
      .update(userAnimals)
      .set({ carried: false })
      .where(and(eq(userAnimals.userId, viewer.userId), eq(userAnimals.carried, true)));
    if (id === null) return { ok: true, text: "🏡 펫을 농장에 두고 다녀요" };
    const [pet] = await tx
      .update(userAnimals)
      .set({ carried: true })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), ne(userAnimals.status, "egg")))
      .returning({ name: userAnimals.name });
    if (!pet) throw new NotMine();
    return { ok: true, text: `🐾 ${josa(pet.name ?? "펫", "과", "와")} 함께 다녀요! 광장과 내 미니룸에서 볼 수 있어요` };
  }).catch((err) => {
    if (err instanceof NotMine) return { ok: false as const, text: "데리고 다닐 수 있는 동물이 아니에요" };
    throw err;
  });
  revalidatePath("/farm");
  return result;
}
class NotMine extends Error {}

/** 프로필에 다 키운 동물 카드 하나 전시 (null = 내리기) */
export async function setDisplayedCard(animalId: number | null): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = animalId === null ? null : parseId(animalId);
  if (animalId !== null && id === null) return { ok: false, text: "잘못된 요청이에요" };
  if (id !== null) {
    const [grown] = await db
      .select({ name: userAnimals.name })
      .from(userAnimals)
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "grown")));
    if (!grown) return { ok: false, text: "다 키운 내 동물만 전시할 수 있어요" };
  }
  await db.update(profiles).set({ displayedAnimalId: id }).where(eq(profiles.userId, viewer.userId));
  revalidatePath("/farm");
  return { ok: true, text: id === null ? "프로필 전시를 내렸어요" : "🏅 프로필에 카드를 전시했어요! 내 블로그 홈에서 보여요" };
}

/** 펫 꾸미기 (무료): 없음·리본·꽃·스카프 */
export async function setPetAccessory(animalId: number, accessory: PetAccessory): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  if (id === null || !PET_ACCESSORIES.some((a) => a.value === accessory)) return { ok: false, text: "잘못된 요청이에요" };
  const [row] = await db
    .update(userAnimals)
    .set({ accessory })
    .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), ne(userAnimals.status, "egg")))
    .returning({ name: userAnimals.name });
  if (!row) return { ok: false, text: "꾸밀 수 있는 동물이 아니에요" };
  revalidatePath("/farm");
  return { ok: true, text: `🎀 ${row.name} 꾸미기를 바꿨어요` };
}
