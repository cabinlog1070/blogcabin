// 꾸미기 저장 (SHOP-04·05·06, TOWN-07): PUT /api/v1/closet
// 꾸미기 화면(탭 3개)에서 고친 것을 모아 두었다가 [저장하기]를 누르면 한 번에 보낸다 (2026-10-13)
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { avatarEquips, blogs, items, profiles, roomFurniture, userAnimals, userItems } from "../db/schema";
import { getWallet } from "../game/points";
import { readJson, requireViewer, type GuardEnv } from "../http/guard";
import { isFurnitureColor, isHairColor, isRoofColor } from "../shop/colors";
import { getCarriedShowcase } from "../farm/read";
import { getEquipped, getHairColor, listItemsWithOwnership } from "../shop/inventory";
import { clampCharacterSpot, clampPct, clampPetSpot, fitRoomSpot } from "../shop/room";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
const fail = (error: string, vars?: Vars) => ({ ok: false as const, error, vars });
export type ClosetResult = { ok: true } | ReturnType<typeof fail>;

/** 꾸미기 화면에서 한 번에 저장하는 내용 (2026-10-13 꾸미기 화면 탭 3개 + 저장하기 버튼).
 *  화면에서 고친 것을 모아 두었다가 [저장하기]를 누르면 이 모양 그대로 보낸다 */
export type ClosetDraft = {
  characterItemId: number;
  backgroundItemId: number;
  /** 부위 → 입은 아이템 (없으면 벗음). 헤어는 벗을 수 없다 */
  worn: Partial<Record<string, number>>;
  roof: string | null;
  /** flipped: 좌우로 뒤집어 놓음 (2026-10-15, 없으면 뒤집지 않음) */
  furniture: { itemId: number; x: number; y: number; flipped?: boolean }[];
  /** 가구 id → 색 (null = 기본 색) */
  colors: Record<string, string | null>;
  character: { x: number; y: number };
  pet: { x: number; y: number } | null;
  /** 머리 색 (null = 헤어마다 그린 그대로) */
  hairColor: string | null;
};

const finite = (...v: unknown[]) => v.every((n) => typeof n === "number" && Number.isFinite(n));

/** 꾸미기 전체 저장: 캐릭터 꾸미기(옷·헤어) · 미니룸(가구 자리·색, 캐릭터·펫 자리) · 집 테마(지붕 색·벽지)를 한 트랜잭션으로 */
export async function saveCloset(userId: string, draft: ClosetDraft): Promise<ClosetResult> {
  const bad = fail(msg("저장할 내용이 올바르지 않아요"));
  if (!draft || !finite(draft.characterItemId, draft.backgroundItemId, draft.character?.x, draft.character?.y)) return bad;
  if (!Array.isArray(draft.furniture) || draft.furniture.length > 200 || !draft.furniture.every((f) => finite(f?.itemId, f?.x, f?.y))) return bad;
  if (draft.pet !== null && !finite(draft.pet?.x, draft.pet?.y)) return bad;
  if (draft.roof !== null && !isRoofColor(draft.roof)) return fail(msg("고를 수 없는 색이에요"));
  if (draft.hairColor !== null && !isHairColor(draft.hairColor)) return fail(msg("고를 수 없는 색이에요"));

  const owned = new Map(
    (
      await db
        .select({ id: items.id, type: items.type, slot: items.slot, requiredLevel: items.requiredLevel, assetKey: items.assetKey })
        .from(userItems)
        .innerJoin(items, eq(items.id, userItems.itemId))
        .where(eq(userItems.userId, userId))
    ).map((i) => [i.id, i]),
  );
  const notOwned = fail(msg("가지고 있지 않은 아이템이에요"));
  if (owned.get(draft.characterItemId)?.type !== "character" || owned.get(draft.backgroundItemId)?.type !== "background") return notOwned;

  // 옷·헤어: 부위가 맞고, 레벨이 되어야 입을 수 있다
  const wallet = await getWallet(userId);
  const wear: { slot: NonNullable<(typeof avatarEquips.$inferInsert)["slot"]>; itemId: number }[] = [];
  for (const [slot, itemId] of Object.entries(draft.worn ?? {})) {
    if (itemId == null) continue;
    const item = owned.get(itemId);
    if (!item) return notOwned;
    if (item.type !== "avatar" || item.slot !== slot) return fail(msg("아직 장착할 수 없는 종류예요"));
    if (wallet.level < item.requiredLevel) return fail(msg("레벨 {level}부터 입을 수 있어요"), { level: item.requiredLevel });
    wear.push({ slot: item.slot, itemId });
  }

  // 가구: 가진 가구만, 같은 가구는 한 번. 벽 장식은 벽 안, 창문·액자를 가리지 않는 자리로, 바닥 가구는 바닥 위로
  const room = new Map<number, { x: number; y: number; flipped: boolean }>();
  for (const f of draft.furniture) {
    const item = owned.get(f.itemId);
    if (!item) return notOwned;
    if (item.type !== "furniture") return fail(msg("가구만 미니룸에 놓을 수 있어요"));
    room.set(f.itemId, { ...fitRoomSpot(item.assetKey, clampPct(f.x), clampPct(f.y)), flipped: f.flipped === true });
  }
  const colors: [number, string | null][] = [];
  for (const [id, color] of Object.entries(draft.colors ?? {})) {
    if (color !== null && !isFurnitureColor(color)) return fail(msg("고를 수 없는 색이에요"));
    if (owned.get(Number(id))?.type !== "furniture") return notOwned;
    colors.push([Number(id), color]);
  }

  // 펫은 데리고 다니는 펫이 있을 때만 놓인다
  let pet: { x: number; y: number } | null = null;
  if (draft.pet) {
    const [carried] = await db.select({ id: userAnimals.id }).from(userAnimals).where(and(eq(userAnimals.userId, userId), eq(userAnimals.carried, true)));
    if (!carried) return fail(msg("데리고 다니는 펫이 없어요. 동물 농장에서 펫을 골라 주세요"));
    pet = clampPetSpot(draft.pet);
  }
  const spot = clampCharacterSpot(draft.character);

  await db.transaction(async (tx) => {
    // 복합 외래 키가 "보유한 아이템만 장착"을 DB에서 한 번 더 막아 준다
    // DB CHECK profiles_hair_color_check가 머리 색을 한 번 더 막는다
    await tx.update(profiles).set({ characterItemId: draft.characterItemId, hairColor: draft.hairColor }).where(eq(profiles.userId, userId));
    await tx
      .update(blogs)
      .set({ backgroundItemId: draft.backgroundItemId, roofColor: draft.roof, roomCharX: spot.x, roomCharY: spot.y, roomPetX: pet?.x ?? null, roomPetY: pet?.y ?? null })
      .where(eq(blogs.ownerId, userId));
    // 헤어는 벗지 않는다: 보낸 목록에 헤어가 없으면 입던 헤어를 그대로 둔다
    const keepHair = !wear.some((w) => (w.slot as string) === "hair");
    await tx
      .delete(avatarEquips)
      .where(keepHair ? and(eq(avatarEquips.userId, userId), sql`${avatarEquips.slot} <> 'hair'`) : eq(avatarEquips.userId, userId));
    if (wear.length) await tx.insert(avatarEquips).values(wear.map((w) => ({ userId, ...w })));
    await tx.delete(roomFurniture).where(eq(roomFurniture.userId, userId));
    if (room.size) await tx.insert(roomFurniture).values([...room].map(([itemId, at]) => ({ userId, itemId, ...at })));
    // DB CHECK user_items_color_check가 한 번 더 막는다
    for (const [itemId, color] of colors) {
      await tx.update(userItems).set({ color }).where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)));
    }
  });
  return { ok: true };
}

/** 꾸미기 화면: 가진 아이템, 지금 입은 것, 지갑, 미니룸(지붕 색·캐릭터·펫 자리), 데리고 다니는 펫, 머리 색 */
export async function closetPage(userId: string) {
  const [all, equipped, wallet, [blog], pet, hairColor] = await Promise.all([
    listItemsWithOwnership(userId),
    getEquipped(userId),
    getWallet(userId),
    db
      .select({ roofColor: blogs.roofColor, roomCharX: blogs.roomCharX, roomCharY: blogs.roomCharY, roomPetX: blogs.roomPetX, roomPetY: blogs.roomPetY })
      .from(blogs)
      .where(eq(blogs.ownerId, userId)),
    getCarriedShowcase(userId), // 미니룸에 놓을 수 있는 펫 (데리고 다니는 펫)
    getHairColor(userId),
  ]);
  return {
    items: all.filter((i) => i.owned),
    equipped,
    wallet,
    roofColor: blog?.roofColor ?? null,
    characterSpot: blog?.roomCharX != null && blog.roomCharY != null ? { x: blog.roomCharX, y: blog.roomCharY } : null,
    petSpot: blog?.roomPetX != null && blog.roomPetY != null ? { x: blog.roomPetX, y: blog.roomPetY } : null,
    pet,
    hairColor,
  };
}

export const closetRoutes = new Hono<GuardEnv>()
  /** 꾸미기 화면 읽기 */
  .get("/", requireViewer("member"), async (c) => c.json(await closetPage(c.get("viewer").userId)))
  .put("/", requireViewer("member"), async (c) => {
  const result = await saveCloset(c.get("viewer").userId, (await readJson(c)) as ClosetDraft);
  return c.json(result, result.ok ? 200 : 400);
});
