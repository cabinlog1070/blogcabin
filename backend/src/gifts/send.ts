// 관리자 선물 (2026-10-13): 관리자가 주민을 골라 코인·아이템을 보내고, 보낼 때마다 함께 보낼 말을 적는다.
// 받은 주민은 알림(gift)과 다음 화면의 선물 팝업으로 알고, 선물은 보내는 순간 그 주민 것이 된다. 보내기 주소는 POST /api/v1/admin/gifts.
// 펫은 그 펫이 태어나는 알로 보낸다 (농장 둥지에 들어가고, 둥지가 꽉 차 있어도 넣는다).
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { giftItems, giftPets, gifts, notifications, pointLedger, profiles, userAnimals, userItems } from "../db/schema";
import { lockUser, type Tx } from "../game/points";

export type GiftInput = { senderId: string; recipientIds: string[]; message: string; coins: number; itemIds: number[]; speciesIds: number[] };

export type GiftSendResult = {
  sent: { userId: string; nickname: string; items: number; pets: number; coins: number }[];
  /** 아이템을 이미 다 갖고 있고 코인·펫 알도 없어서 아무것도 못 받은 주민 */
  skipped: { userId: string; nickname: string }[];
};

/**
 * 받는 주민마다 선물 하나를 만든다 (주민마다 따로 트랜잭션: 한 명이 실패해도 앞사람 선물은 남는다).
 * - 코인: 원장 admin_gift, ref_id = 선물 ID (선물마다 ID가 달라서 같은 주민에게 여러 번 보내도 된다)
 * - 아이템: 이미 가진 것은 빼고 user_items에 넣는다. 받을 게 하나도 없으면 그 주민에게는 보내지 않는다
 * - 펫: 고른 종류마다 그 펫이 태어나는 알 하나 (user_animals, source = gift, egg_species_id). 이미 있는 펫이어도 보낸다
 * - 알림: kind = gift, ref_id = 선물 ID. 관리자가 자기에게 보내면 actor_id는 비운다 (자기 행동 CHECK)
 */
export async function sendGifts(input: GiftInput): Promise<GiftSendResult> {
  const result: GiftSendResult = { sent: [], skipped: [] };
  for (const userId of input.recipientIds) {
    await db.transaction(async (tx) => {
      const [member] = await tx.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, userId));
      if (!member) return;
      await lockUser(tx, userId);
      const newItemIds = await notOwned(tx, userId, input.itemIds);
      if (newItemIds.length === 0 && input.coins === 0 && input.speciesIds.length === 0) {
        result.skipped.push({ userId, nickname: member.nickname });
        return;
      }
      const [gift] = await tx
        .insert(gifts)
        .values({ senderId: input.senderId, recipientId: userId, message: input.message, coins: input.coins })
        .returning({ id: gifts.id });
      if (newItemIds.length) {
        await tx.insert(giftItems).values(newItemIds.map((itemId) => ({ giftId: gift.id, itemId })));
        await tx.insert(userItems).values(newItemIds.map((itemId) => ({ userId, itemId }))).onConflictDoNothing();
      }
      if (input.speciesIds.length) {
        await tx.insert(giftPets).values(input.speciesIds.map((speciesId) => ({ giftId: gift.id, speciesId })));
        await tx.insert(userAnimals).values(input.speciesIds.map((speciesId) => ({ userId, source: "gift" as const, eggSpeciesId: speciesId })));
      }
      if (input.coins > 0) {
        await tx.insert(pointLedger).values({ userId, reason: "admin_gift", coinDelta: input.coins, refId: String(gift.id) });
      }
      await tx.insert(notifications).values({
        userId,
        kind: "gift",
        actorId: userId === input.senderId ? null : input.senderId,
        refId: String(gift.id),
      });
      result.sent.push({ userId, nickname: member.nickname, items: newItemIds.length, pets: input.speciesIds.length, coins: input.coins });
    });
  }
  return result;
}

async function notOwned(tx: Tx, userId: string, itemIds: number[]) {
  if (!itemIds.length) return [];
  const owned = await tx
    .select({ itemId: userItems.itemId })
    .from(userItems)
    .where(and(eq(userItems.userId, userId), inArray(userItems.itemId, itemIds)));
  const ownedSet = new Set(owned.map((r) => r.itemId));
  return itemIds.filter((id) => !ownedSet.has(id));
}
