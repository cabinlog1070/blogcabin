"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, blogs, items, profiles, roomFurniture, userItems } from "@/db/schema";
import { isRoofColor } from "@/lib/art/town";
import { clampPct, MAX_FURNITURE } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { getWallet, lockUser } from "@/server/points";

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

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: "가지고 있지 않은 아이템이에요" };

  // 복합 외래 키가 "보유한 아이템만 장착"을 DB에서 한 번 더 막아 준다
  if (owned.type === "character") {
    await db.update(profiles).set({ characterItemId: itemId }).where(eq(profiles.userId, viewer.userId));
  } else if (owned.type === "background") {
    await db.update(blogs).set({ backgroundItemId: itemId }).where(eq(blogs.ownerId, viewer.userId));
  } else {
    return { ok: false, error: "아직 장착할 수 없는 종류예요" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 아바타 꾸미기 입기·벗기 (SHOP-06). 부위마다 하나: 같은 부위의 다른 아이템을 입으면 바뀐다 */
export async function setAvatarWear(itemId: number, wear: boolean): Promise<ActionResult> {
  const viewer = await requireMember();

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: "가지고 있지 않은 아이템이에요" };
  if (owned.type !== "avatar" || !owned.slot) return { ok: false, error: "아직 장착할 수 없는 종류예요" };

  if (wear) {
    // 레벨이 되어야 입을 수 있다 (옷은 레벨에 따라 풀린다)
    const wallet = await getWallet(viewer.userId);
    if (wallet.level < owned.requiredLevel) return { ok: false, error: `레벨 ${owned.requiredLevel}부터 입을 수 있어요` };
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
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "놓을 위치가 올바르지 않아요" };

  const owned = await ownedItem(viewer.userId, itemId);
  if (!owned) return { ok: false, error: "가지고 있지 않은 아이템이에요" };
  if (owned.type !== "furniture") return { ok: false, error: "가구만 미니룸에 놓을 수 있어요" };

  const result = await db.transaction(async (tx): Promise<ActionResult> => {
    // 같은 회원의 배치 요청이 겹쳐서 5개를 넘지 않게 잠근다
    await lockUser(tx, viewer.userId);
    const [others] = await tx
      .select({ n: count() })
      .from(roomFurniture)
      .where(and(eq(roomFurniture.userId, viewer.userId), ne(roomFurniture.itemId, itemId)));
    if (others.n >= MAX_FURNITURE) return { ok: false, error: `가구는 ${MAX_FURNITURE}개까지 놓을 수 있어요` };
    // 이미 놓인 가구면 새로 추가하지 않고 위치만 옮긴다 (기본 키: 회원, 아이템)
    await tx
      .insert(roomFurniture)
      .values({ userId: viewer.userId, itemId, x: clampPct(x), y: clampPct(y) })
      .onConflictDoUpdate({ target: [roomFurniture.userId, roomFurniture.itemId], set: { x: clampPct(x), y: clampPct(y) } });
    return { ok: true };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 미니룸에서 가구 빼기 (미니룸 밖으로 끌어냄) */
export async function removeFurniture(itemId: number): Promise<ActionResult> {
  const viewer = await requireMember();
  await db.delete(roomFurniture).where(and(eq(roomFurniture.userId, viewer.userId), eq(roomFurniture.itemId, itemId)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 광장 내 집 지붕 색 (TOWN-07): 정해진 8가지 중 하나, null이면 [배경 색 따라가기].
 * 무료라서 코인·경험치 기록을 남기지 않고, 언제든 몇 번이든 바꿀 수 있다 (spec 007 Clarifications).
 */
export async function setRoofColor(color: string | null): Promise<ActionResult> {
  const viewer = await requireMember();
  if (color !== null && !isRoofColor(color)) return { ok: false, error: "고를 수 없는 색이에요" };
  // DB CHECK blogs_roof_color_check가 한 번 더 막는다
  await db.update(blogs).set({ roofColor: color }).where(eq(blogs.ownerId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: true };
}
