// 상점 (SHOP-01·SHOP-06): /api/v1/shop/…
// 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)으로 돌려주고, 화면이 보는 사람의 언어로 바꾼다
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { AVATAR_SLOTS, avatarEquips, items, pointLedger, profiles, userItems } from "../db/schema";
import { getWallet, lockUser } from "../game/points";
import { readJson, requireViewer, type GuardEnv } from "../http/guard";
import { uniqueViolation } from "../lib/db-errors";
import { parseId } from "../lib/ids";
import { isHairColor } from "../shop/colors";
import { getEquipped, getHairColor, listItemsWithOwnership } from "../shop/inventory";
import { isForSale } from "../shop/rules";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
type Fail = { ok: false; error: string; vars?: Vars };
const fail = (error: string, vars?: Vars): Fail => ({ ok: false, error, vars });

export type BuyResult = { ok: true; name: string } | Fail;
export type SaveLookResult = { ok: true; bought: number } | Fail;

/** 상점 화면 (SHOP-01): 파는 아이템, 지갑, 지금 입은 것, 머리 색 */
export async function shopPage(userId: string) {
  const [all, wallet, equipped, hairColor] = await Promise.all([
    listItemsWithOwnership(userId),
    getWallet(userId),
    getEquipped(userId),
    getHairColor(userId),
  ]);
  // 미리 입어 보기는 지금 입고 있는 모습에서 시작한다 (부위별 asset_key)
  const wornAssets = equipped.worn.map((w) => all.find((i) => i.id === w.itemId)?.assetKey ?? "").filter(Boolean);
  // 기본 아이템과 캐릭터(2026-10-06부터 판매 중단)는 상점에 나오지 않는다
  return { items: all.filter(isForSale), wallet, wornAssets, hairColor };
}

export const shopRoutes = new Hono<GuardEnv>()
  .use(requireViewer("member"))
  /** 상점 화면 읽기 */
  .get("/", async (c) => c.json(await shopPage(c.get("viewer").userId)))
  /** 아이템 하나 사기 (SHOP-02): { itemId } */
  .post("/buy", async (c) => {
    const { userId } = c.get("viewer");
    const itemId = parseId((await readJson(c)).itemId);
    if (itemId === null) return c.json(fail(msg("살 수 없는 아이템이에요")), 400);

    try {
      const result = await db.transaction(async (tx): Promise<BuyResult> => {
        // 같은 회원의 다른 구매·보상과 겹치지 않게 잠그고 잔액을 계산한다
        await lockUser(tx, userId);

        const [item] = await tx.select().from(items).where(eq(items.id, itemId));
        // 기본 아이템, 상점에서 빠진 캐릭터(2026-10-06 결정), 없는 아이템은 살 수 없다
        if (!item || !isForSale(item)) return fail(msg("살 수 없는 아이템이에요"));

        const wallet = await getWallet(userId, tx);
        if (wallet.level < item.requiredLevel) return fail(msg("레벨 {level}부터 살 수 있어요"), { level: item.requiredLevel });
        if (wallet.coins < item.price) return fail(msg("코인이 {n}개 부족해요"), { n: item.price - wallet.coins });

        // 아이템 지급 (이미 있으면 기본 키 위반 → 전체 취소)
        await tx.insert(userItems).values({ userId, itemId: item.id });
        // 0코인 아이템(헤어)은 원장에 남길 코인이 없다 (원장은 0인 줄을 막는다)
        if (item.price > 0) {
          await tx.insert(pointLedger).values({ userId, reason: "purchase", coinDelta: -item.price, refId: String(item.id) });
        }
        return { ok: true, name: item.name };
      });
      return c.json(result, result.ok ? 200 : 400);
    } catch (err) {
      if (uniqueViolation(err) !== null) return c.json(fail(msg("이미 가지고 있는 아이템이에요")), 409);
      throw err;
    }
  })
  /**
   * 미리 입어 본 모습을 저장하기 (SHOP-06, 2026-10-13): { itemIds, hairColor? }
   * 부위마다 하나씩 받아서, 아직 없는 옷은 한꺼번에 사고(코인 차감) 모두 입는다. 하나라도 안 되면 아무것도 바꾸지 않는다.
   * 머리 색도 여기서 같이 저장한다 (hairColor가 없으면 그대로, null이면 기본 색).
   * 상점에서 입어 보고 [저장하기]를 누르지 않고 나가면 아무것도 남지 않는다 (2026-10-13 사용자 결정)
   */
  .post("/save-look", async (c) => {
    const { userId } = c.get("viewer");
    const body = await readJson(c);
    const hairColor = "hairColor" in body ? (body.hairColor as unknown) : undefined;
    const raw = Array.isArray(body.itemIds) ? body.itemIds : [];
    const ids = [...new Set(raw.map(parseId))];
    if (ids.some((id) => id === null)) return c.json(fail(msg("입을 수 없는 아이템이 있어요")), 400);
    if (ids.length > AVATAR_SLOTS.length || (!ids.length && hairColor === undefined)) return c.json(fail(msg("입어 본 옷이 없어요")), 400);
    if (hairColor !== undefined && hairColor !== null && !isHairColor(hairColor)) return c.json(fail(msg("고를 수 없는 색이에요")), 400);
    const itemIds = ids as number[];

    try {
      const result = await db.transaction(async (tx): Promise<SaveLookResult> => {
        await lockUser(tx, userId);
        // 머리 색은 옷 확인이 모두 끝난 뒤에 저장한다 (중간에 실패로 돌아가면 아무것도 바뀌지 않게). DB CHECK profiles_hair_color_check가 한 번 더 막는다
        const saveHairColor = async () => {
          if (hairColor !== undefined) await tx.update(profiles).set({ hairColor: hairColor as string | null }).where(eq(profiles.userId, userId));
        };
        if (!itemIds.length) return (await saveHairColor(), { ok: true, bought: 0 });
        const rows = await tx.select().from(items).where(inArray(items.id, itemIds));
        if (rows.length !== itemIds.length || rows.some((i) => i.type !== "avatar" || !i.slot)) return fail(msg("입을 수 없는 아이템이 있어요"));
        if (new Set(rows.map((i) => i.slot)).size !== rows.length) return fail(msg("한 부위에는 옷 하나만 입을 수 있어요"));

        const owned = new Set(
          (await tx
            .select({ itemId: userItems.itemId })
            .from(userItems)
            .where(and(eq(userItems.userId, userId), inArray(userItems.itemId, itemIds)))).map((r) => r.itemId),
        );
        const toBuy = rows.filter((i) => !owned.has(i.id));
        // 가진 옷이 아니면 상점에서 파는 옷이어야 살 수 있다
        if (toBuy.some((i) => !isForSale(i))) return fail(msg("살 수 없는 아이템이 있어요"));

        const wallet = await getWallet(userId, tx);
        const locked = rows.find((i) => wallet.level < i.requiredLevel);
        // name은 아이템 이름(한국어). 화면이 이것도 보는 사람의 언어로 바꾼다
        if (locked) return fail(msg("{name}은(는) 레벨 {level}부터 입을 수 있어요"), { name: locked.name, level: locked.requiredLevel });
        const cost = toBuy.reduce((sum, i) => sum + i.price, 0);
        if (wallet.coins < cost) return fail(msg("코인이 {n}개 부족해요"), { n: cost - wallet.coins });

        await saveHairColor();
        for (const item of toBuy) {
          await tx.insert(userItems).values({ userId, itemId: item.id });
          await tx.insert(pointLedger).values({ userId, reason: "purchase", coinDelta: -item.price, refId: String(item.id) });
        }
        for (const item of rows) {
          await tx
            .insert(avatarEquips)
            .values({ userId, slot: item.slot!, itemId: item.id })
            .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId: item.id } });
        }
        return { ok: true, bought: toBuy.length };
      });
      return c.json(result, result.ok ? 200 : 400);
    } catch (err) {
      // 다른 탭에서 같은 옷을 막 샀을 때
      if (uniqueViolation(err) !== null) return c.json(fail(msg("이미 가지고 있는 아이템이에요")), 409);
      throw err;
    }
  });
