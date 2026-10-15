import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, roomFurniture, userItems } from "@/db/schema";

// 모습 키(입은 꾸미기를 붙인 캐릭터 키)는 서버(읽기 API)와 같은 코드를 쓴다
export { lookSql } from "@backend/blog/look";

export type PlacedFurniture = { itemId: number; assetKey: string; x: number; y: number };

/** 미니룸에 놓인 가구 (SHOP-05) */
export async function getRoomFurniture(userId: string): Promise<PlacedFurniture[]> {
  return db
    // 고른 색은 가구 키 뒤에 붙인다 ("furn.chair@pink", src/lib/art/furniture.ts의 paintedFurnitureKey)
    .select({ itemId: roomFurniture.itemId, assetKey: sql<string>`${items.assetKey} || COALESCE('@' || ${userItems.color}, '')`, x: roomFurniture.x, y: roomFurniture.y })
    .from(roomFurniture)
    .innerJoin(items, eq(items.id, roomFurniture.itemId))
    .innerJoin(userItems, and(eq(userItems.userId, roomFurniture.userId), eq(userItems.itemId, roomFurniture.itemId)))
    .where(eq(roomFurniture.userId, userId))
    .orderBy(asc(roomFurniture.y));
}
