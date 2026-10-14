// 관리자 선물 (2026-10-13): 관리자가 주민을 골라 코인·아이템을 보내고, 보낼 때마다 함께 보낼 말을 적는다.
// 받은 주민은 알림(gift)과 다음 화면의 선물 팝업으로 알고, 선물은 보내는 순간 그 주민 것이 된다.
// 펫은 그 펫이 태어나는 알로 보낸다 (농장 둥지에 들어가고, 둥지가 꽉 차 있어도 넣는다).
import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { animalSpecies, giftItems, giftPets, gifts, items, notifications, pointLedger, profiles, userAnimals, userItems } from "@/db/schema";
import { lockUser, type Tx } from "@/server/points";

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

export type GiftView = {
  id: number;
  notificationId: number | null;
  senderName: string | null;
  message: string;
  coins: number;
  items: { id: number; name: string; type: string; assetKey: string }[];
  /** 펫 알: 태어날 펫 종류 */
  pets: { id: number; name: string; assetKey: string }[];
  createdAt: Date;
};

const senderProfile = alias(profiles, "sender_profile");

/** 선물 ID 목록 → 화면에 보일 선물 (보낸 사람 이름, 함께 보낸 말, 코인, 아이템) */
async function giftViews(recipientId: string, where: ReturnType<typeof and>, limit: number, notificationIds?: Map<number, number>) {
  const rows = await db
    .select({
      id: gifts.id,
      senderName: senderProfile.nickname,
      message: gifts.message,
      coins: gifts.coins,
      createdAt: gifts.createdAt,
    })
    .from(gifts)
    .leftJoin(senderProfile, eq(senderProfile.userId, gifts.senderId))
    .where(and(eq(gifts.recipientId, recipientId), where))
    .orderBy(desc(gifts.createdAt), desc(gifts.id))
    .limit(limit);
  if (!rows.length) return [];
  const itemRows = await db
    .select({ giftId: giftItems.giftId, id: items.id, name: items.name, type: items.type, assetKey: items.assetKey })
    .from(giftItems)
    .innerJoin(items, eq(items.id, giftItems.itemId))
    .where(inArray(giftItems.giftId, rows.map((r) => r.id)))
    .orderBy(asc(items.type), asc(items.id));
  const petRows = await db
    .select({ giftId: giftPets.giftId, id: animalSpecies.id, name: animalSpecies.name, assetKey: animalSpecies.assetKey })
    .from(giftPets)
    .innerJoin(animalSpecies, eq(animalSpecies.id, giftPets.speciesId))
    .where(inArray(giftPets.giftId, rows.map((r) => r.id)))
    .orderBy(asc(animalSpecies.id));
  return rows.map<GiftView>((r) => ({
    ...r,
    notificationId: notificationIds?.get(r.id) ?? null,
    items: itemRows.filter((it) => it.giftId === r.id).map((it) => ({ id: it.id, name: it.name, type: it.type, assetKey: it.assetKey })),
    pets: petRows.filter((p) => p.giftId === r.id).map((p) => ({ id: p.id, name: p.name, assetKey: p.assetKey })),
  }));
}

/** 받은 선물 최신순 (받은 선물 화면) */
export async function listReceivedGifts(userId: string, limit = 50) {
  return giftViews(userId, undefined, limit);
}

/**
 * 아직 안 읽은 선물 알림의 선물 (다음 화면에서 팝업으로 하나씩 보여준다, 오래된 것부터).
 * 팝업을 닫으면 그 알림을 읽음으로 바꾼다 (seeGift)
 */
export async function getUnseenGifts(userId: string): Promise<GiftView[]> {
  const unseen = await db
    .select({ id: notifications.id, refId: notifications.refId })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "gift"), isNull(notifications.readAt)))
    .orderBy(asc(notifications.createdAt))
    .limit(10);
  if (!unseen.length) return [];
  const byGift = new Map(unseen.map((n) => [Number(n.refId), n.id]));
  const views = await giftViews(userId, inArray(gifts.id, [...byGift.keys()]), 10, byGift);
  return views.reverse();
}
