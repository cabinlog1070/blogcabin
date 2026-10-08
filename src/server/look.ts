import "server-only";
import { asc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { avatarEquips, items, roomFurniture } from "@/db/schema";

/**
 * 모습 키 (SHOP-06): 캐릭터 asset_key 뒤에 입은 꾸미기 asset_key를 +로 붙인 문자열.
 * 예) char.boy+avatar.hat.straw. 캐릭터를 그리는 모든 곳(헤더, 광장, 미니룸, 댓글)이 이 값을 그대로 쓴다.
 * 그림은 src/lib/art/characters.ts의 characterSvg가 키를 풀어 겹쳐 그린다.
 */
export function lookSql(characterAsset: AnyColumn, userId: AnyColumn): SQL<string> {
  return sql<string>`(${characterAsset} || COALESCE((
    SELECT string_agg('+' || wi.asset_key, '' ORDER BY ae.slot)
    FROM ${avatarEquips} ae JOIN ${items} wi ON wi.id = ae.item_id
    WHERE ae.user_id = ${userId}
  ), ''))`;
}

export type PlacedFurniture = { itemId: number; assetKey: string; x: number; y: number };

/** 미니룸에 놓인 가구 (SHOP-05) */
export async function getRoomFurniture(userId: string): Promise<PlacedFurniture[]> {
  return db
    .select({ itemId: roomFurniture.itemId, assetKey: items.assetKey, x: roomFurniture.x, y: roomFurniture.y })
    .from(roomFurniture)
    .innerJoin(items, eq(items.id, roomFurniture.itemId))
    .where(eq(roomFurniture.userId, userId))
    .orderBy(asc(roomFurniture.y));
}
