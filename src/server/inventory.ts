import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { avatarEquips, blogs, items, profiles, userItems } from "@/db/schema";
import { getRoomFurniture } from "@/server/look";

/** 전체 아이템 + 내가 가졌는지 + 가진 회원 수(인기순 정렬, SHOP-01) */
export async function listItemsWithOwnership(userId: string) {
  return db
    .select({
      id: items.id,
      type: items.type,
      slot: items.slot,
      name: items.name,
      description: items.description,
      price: items.price,
      requiredLevel: items.requiredLevel,
      isStarter: items.isStarter,
      assetKey: items.assetKey,
      owned: sql<boolean>`${userItems.userId} IS NOT NULL`,
      ownerCount: sql<number>`(SELECT COUNT(*)::int FROM ${userItems} o WHERE o.item_id = ${items.id})`,
    })
    .from(items)
    .leftJoin(userItems, and(eq(userItems.itemId, items.id), eq(userItems.userId, userId)))
    .orderBy(asc(items.type), asc(items.requiredLevel), asc(items.price), asc(items.id));
}

/** 지금 장착 중인 캐릭터·배경, 부위별로 입은 꾸미기(SHOP-06), 미니룸 가구(SHOP-05) */
export async function getEquipped(userId: string) {
  const [[row], worn, furniture] = await Promise.all([
    db
      .select({ characterItemId: profiles.characterItemId, backgroundItemId: blogs.backgroundItemId })
      .from(profiles)
      .innerJoin(blogs, eq(blogs.ownerId, profiles.userId))
      .where(eq(profiles.userId, userId)),
    db.select({ slot: avatarEquips.slot, itemId: avatarEquips.itemId }).from(avatarEquips).where(eq(avatarEquips.userId, userId)),
    getRoomFurniture(userId),
  ]);
  return { ...row, worn, furniture };
}
