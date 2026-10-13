"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, items, pointLedger, profiles, userItems } from "@/db/schema";
import { isHairColor, SLOT_ORDER } from "@/lib/art/avatar";
import { isForSale } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { getT } from "@/server/i18n";
import { getWallet, lockUser } from "@/server/points";

export type BuyResult = { ok: true; name: string } | { ok: false; error: string };

export async function buyItem(itemId: number): Promise<BuyResult> {
  const viewer = await requireMember();
  const t = await getT();

  try {
    const result = await db.transaction(async (tx): Promise<BuyResult> => {
      // 같은 회원의 다른 구매·보상과 겹치지 않게 잠그고 잔액을 계산한다
      await lockUser(tx, viewer.userId);

      const [item] = await tx.select().from(items).where(eq(items.id, itemId));
      // 기본 아이템, 상점에서 빠진 캐릭터(2026-10-06 결정), 없는 아이템은 살 수 없다
      if (!item || !isForSale(item)) return { ok: false, error: t("살 수 없는 아이템이에요") };

      const wallet = await getWallet(viewer.userId, tx);
      if (wallet.level < item.requiredLevel) return { ok: false, error: t("레벨 {level}부터 살 수 있어요", { level: item.requiredLevel }) };
      if (wallet.coins < item.price) return { ok: false, error: t("코인이 {n}개 부족해요", { n: item.price - wallet.coins }) };

      // 아이템 지급 (이미 있으면 기본 키 위반 → 전체 취소)
      await tx.insert(userItems).values({ userId: viewer.userId, itemId: item.id });
      // 0코인 아이템(헤어)은 원장에 남길 코인이 없다 (원장은 0인 줄을 막는다)
      if (item.price > 0) {
        await tx.insert(pointLedger).values({
          userId: viewer.userId,
          reason: "purchase",
          coinDelta: -item.price,
          refId: String(item.id),
        });
      }
      return { ok: true, name: item.name };
    });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, error: t("이미 가지고 있는 아이템이에요") };
    throw err;
  }
}

export type SaveLookResult = { ok: true; bought: number } | { ok: false; error: string };

/**
 * 미리 입어 본 모습을 저장하기 (SHOP-06, 2026-10-13): 부위마다 하나씩 받아서,
 * 아직 없는 옷은 한꺼번에 사고(코인 차감) 모두 입는다. 하나라도 안 되면 아무것도 바꾸지 않는다.
 * 머리 색도 여기서 같이 저장한다 (undefined면 그대로, null이면 기본 색).
 * 상점에서 입어 보고 [저장하기]를 누르지 않고 나가면 아무것도 남지 않는다 (2026-10-13 사용자 결정)
 */
export async function saveTriedLook(itemIds: number[], hairColor?: string | null): Promise<SaveLookResult> {
  const viewer = await requireMember();
  const t = await getT();
  const ids = [...new Set(itemIds)].filter(Number.isInteger);
  if (ids.length > SLOT_ORDER.length || (!ids.length && hairColor === undefined)) return { ok: false, error: t("입어 본 옷이 없어요") };
  if (hairColor != null && !isHairColor(hairColor)) return { ok: false, error: t("고를 수 없는 색이에요") };

  try {
    const result = await db.transaction(async (tx): Promise<SaveLookResult> => {
      await lockUser(tx, viewer.userId);
      // 머리 색은 옷 확인이 모두 끝난 뒤에 저장한다 (중간에 실패로 돌아가면 아무것도 바뀌지 않게). DB CHECK profiles_hair_color_check가 한 번 더 막는다
      const saveHairColor = async () => {
        if (hairColor !== undefined) await tx.update(profiles).set({ hairColor }).where(eq(profiles.userId, viewer.userId));
      };
      if (!ids.length) return (await saveHairColor(), { ok: true, bought: 0 });
      const rows = await tx.select().from(items).where(inArray(items.id, ids));
      if (rows.length !== ids.length || rows.some((i) => i.type !== "avatar" || !i.slot)) return { ok: false, error: t("입을 수 없는 아이템이 있어요") };
      if (new Set(rows.map((i) => i.slot)).size !== rows.length) return { ok: false, error: t("한 부위에는 옷 하나만 입을 수 있어요") };

      const owned = new Set(
        (await tx
          .select({ itemId: userItems.itemId })
          .from(userItems)
          .where(and(eq(userItems.userId, viewer.userId), inArray(userItems.itemId, ids)))).map((r) => r.itemId),
      );
      const toBuy = rows.filter((i) => !owned.has(i.id));
      // 가진 옷이 아니면 상점에서 파는 옷이어야 살 수 있다
      if (toBuy.some((i) => !isForSale(i))) return { ok: false, error: t("살 수 없는 아이템이 있어요") };

      const wallet = await getWallet(viewer.userId, tx);
      const locked = rows.find((i) => wallet.level < i.requiredLevel);
      if (locked) return { ok: false, error: t("{name}은(는) 레벨 {level}부터 입을 수 있어요", { name: t(locked.name), level: locked.requiredLevel }) };
      const cost = toBuy.reduce((sum, i) => sum + i.price, 0);
      if (wallet.coins < cost) return { ok: false, error: t("코인이 {n}개 부족해요", { n: cost - wallet.coins }) };

      await saveHairColor();
      for (const item of toBuy) {
        await tx.insert(userItems).values({ userId: viewer.userId, itemId: item.id });
        await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "purchase", coinDelta: -item.price, refId: String(item.id) });
      }
      for (const item of rows) {
        await tx
          .insert(avatarEquips)
          .values({ userId: viewer.userId, slot: item.slot!, itemId: item.id })
          .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId: item.id } });
      }
      return { ok: true, bought: toBuy.length };
    });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    // 다른 탭에서 같은 옷을 막 샀을 때
    if (uniqueViolation(err) !== null) return { ok: false, error: t("이미 가지고 있는 아이템이에요") };
    throw err;
  }
}
