"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, blogs, items, profiles, roomFurniture, userAnimals, userItems } from "@/db/schema";
import { isFurnitureColor } from "@/lib/art/furniture";
import { isRoofColor } from "@/lib/art/town";
import { clampCharacterSpot, clampPct, clampPetSpot } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { getWallet } from "@/server/points";

export type ActionResult = { ok: boolean; error?: string };

/** 내가 가진 아이템인지와 종류·부위·필요 레벨 */
async function ownedItem(userId: string, itemId: number) {
  const [owned] = await db
    .select({ type: items.type, slot: items.slot, requiredLevel: items.requiredLevel })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)));
  return owned ?? null;
}

/** 캐릭터·배경 장착 (SHOP-04) */
export async function equipItem(itemId: number): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: t("가지고 있지 않은 아이템이에요") };

  // 복합 외래 키가 "보유한 아이템만 장착"을 DB에서 한 번 더 막아 준다
  if (owned.type === "character") {
    await db.update(profiles).set({ characterItemId: itemId }).where(eq(profiles.userId, viewer.userId));
  } else if (owned.type === "background") {
    await db.update(blogs).set({ backgroundItemId: itemId }).where(eq(blogs.ownerId, viewer.userId));
  } else {
    return { ok: false, error: t("아직 장착할 수 없는 종류예요") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 아바타 꾸미기 입기·벗기 (SHOP-06). 부위마다 하나: 같은 부위의 다른 아이템을 입으면 바뀐다 */
export async function setAvatarWear(itemId: number, wear: boolean): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: t("가지고 있지 않은 아이템이에요") };
  if (owned.type !== "avatar" || !owned.slot) return { ok: false, error: t("아직 장착할 수 없는 종류예요") };

  if (wear) {
    // 레벨이 되어야 입을 수 있다 (옷은 레벨에 따라 풀린다)
    const wallet = await getWallet(viewer.userId);
    if (wallet.level < owned.requiredLevel) return { ok: false, error: t("레벨 {level}부터 입을 수 있어요", { level: owned.requiredLevel }) };
    // 복합 외래 키: (회원, 아이템) → user_items 보유 확인, (아이템, 부위) → items 부위 확인
    await db
      .insert(avatarEquips)
      .values({ userId: viewer.userId, slot: owned.slot, itemId })
      .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId } });
  } else {
    await db.delete(avatarEquips).where(and(eq(avatarEquips.userId, viewer.userId), eq(avatarEquips.itemId, itemId)));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 미니룸에 가구 놓기·옮기기 (SHOP-05). 위치는 미니룸 기준 비율(0~100%) */
export async function placeFurniture(itemId: number, x: number, y: number): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: t("놓을 위치가 올바르지 않아요") };

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: t("가지고 있지 않은 아이템이에요") };
  if (owned.type !== "furniture") return { ok: false, error: t("가구만 미니룸에 놓을 수 있어요") };

  // 가진 가구는 몇 개든 놓을 수 있다 (2026-10-13 5개 제한 없앰). 이미 놓인 가구면 위치만 옮긴다 (기본 키: 회원, 아이템)
  await db
    .insert(roomFurniture)
    .values({ userId: viewer.userId, itemId, x: clampPct(x), y: clampPct(y) })
    .onConflictDoUpdate({ target: [roomFurniture.userId, roomFurniture.itemId], set: { x: clampPct(x), y: clampPct(y) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 미니룸 안 캐릭터 자리 옮기기 (SHOP-05, 2026-10-13). x·y는 발이 닿는 곳(미니룸 기준 %), 바닥 근처로 맞춘다 */
export async function moveRoomCharacter(x: number, y: number): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: t("놓을 위치가 올바르지 않아요") };
  const spot = clampCharacterSpot({ x, y });
  await db.update(blogs).set({ roomCharX: spot.x, roomCharY: spot.y }).where(eq(blogs.ownerId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 데리고 다니는 펫을 미니룸에 놓기·옮기기(spot) 또는 빼기(null, 다시 캐릭터 옆으로). 놓은 펫은 그 자리에서부터 방 안을 돌아다닌다 */
export async function placeRoomPet(spot: { x: number; y: number } | null): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();
  if (spot === null) {
    await db.update(blogs).set({ roomPetX: null, roomPetY: null }).where(eq(blogs.ownerId, viewer.userId));
  } else {
    if (!Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return { ok: false, error: t("놓을 위치가 올바르지 않아요") };
    const [carried] = await db.select({ id: userAnimals.id }).from(userAnimals).where(and(eq(userAnimals.userId, viewer.userId), eq(userAnimals.carried, true)));
    if (!carried) return { ok: false, error: t("데리고 다니는 펫이 없어요. 동물 농장에서 펫을 골라 주세요") };
    const at = clampPetSpot(spot);
    await db.update(blogs).set({ roomPetX: at.x, roomPetY: at.y }).where(eq(blogs.ownerId, viewer.userId));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 미니룸에서 가구 빼기 (미니룸 밖으로 끌어냄) */
export async function removeFurniture(itemId: number): Promise<ActionResult> {
  const viewer = await requireMember();
  await db.delete(roomFurniture).where(and(eq(roomFurniture.userId, viewer.userId), eq(roomFurniture.itemId, itemId)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 가구 색 바꾸기 (SHOP-05, 2026-10-13): 가진 가구마다 8가지 중 하나, null이면 기본 색. 무료, 언제든 바꿀 수 있다 */
export async function setFurnitureColor(itemId: number, color: string | null): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();
  if (color !== null && !isFurnitureColor(color)) return { ok: false, error: t("고를 수 없는 색이에요") };
  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: t("가지고 있지 않은 아이템이에요") };
  if (owned.type !== "furniture") return { ok: false, error: t("가구만 색을 바꿀 수 있어요") };
  // DB CHECK user_items_color_check가 한 번 더 막는다
  await db.update(userItems).set({ color }).where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, itemId)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 광장 내 집 지붕 색 (TOWN-07): 정해진 8가지 중 하나, null이면 [배경 색 따라가기].
 * 무료라서 코인·경험치 기록을 남기지 않고, 언제든 몇 번이든 바꿀 수 있다 (spec 007 Clarifications).
 */
export async function setRoofColor(color: string | null): Promise<ActionResult> {
  const viewer = await requireMember();
  const t = await getT();
  if (color !== null && !isRoofColor(color)) return { ok: false, error: t("고를 수 없는 색이에요") };
  // DB CHECK blogs_roof_color_check가 한 번 더 막는다
  await db.update(blogs).set({ roofColor: color }).where(eq(blogs.ownerId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: true };
}
