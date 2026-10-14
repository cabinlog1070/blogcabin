// 받은 선물 보기 (관리자 선물, 2026-10-13): 받은 선물 화면과 다음 화면의 선물 팝업
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { animalSpecies, giftItems, giftPets, gifts, items, notifications, profiles } from "../db/schema";

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
