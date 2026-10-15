import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { avatarEquips, items, profiles } from "../db/schema";

/**
 * 모습 키 (SHOP-06): 캐릭터 asset_key 뒤에 입은 꾸미기 asset_key를 +로 붙인 문자열.
 * 예) char.boy+avatar.hat.straw. 머리 색을 골랐으면 헤어 키 뒤에 @색을 붙인다 (avatar.hair.long@blonde). 캐릭터를 그리는 모든 곳(헤더, 광장, 미니룸, 댓글)이 이 값을 그대로 쓴다.
 * 그림은 화면 frontend/src/lib/art/characters.ts의 characterSvg가 키를 풀어 겹쳐 그린다.
 */
export function lookSql(characterAsset: AnyColumn, userId: AnyColumn): SQL<string> {
  return sql<string>`(${characterAsset} || COALESCE((
    SELECT string_agg('+' || wi.asset_key || CASE WHEN ae.slot = 'hair'
      THEN COALESCE('@' || (SELECT hp.hair_color FROM ${profiles} hp WHERE hp.user_id = ae.user_id), '') ELSE '' END, '' ORDER BY ae.slot)
    FROM ${avatarEquips} ae JOIN ${items} wi ON wi.id = ae.item_id
    WHERE ae.user_id = ${userId}
  ), ''))`;
}
