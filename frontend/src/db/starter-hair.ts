// 처음 고른 주민의 머리를 헤어 아이템으로 준다 (2026-10-13).
// 짧은 머리 주민은 "짧은 머리", 긴 머리 주민은 "긴 머리"를 갖고 입은 채로 시작한다. 다른 머리는 상점에서 0코인에 받는다.
// 가입(onboarding), 관리자 계정 만들기, 아이템 시드(헤어가 생기기 전에 가입한 주민 채우기)가 함께 쓴다. 여러 번 불러도 안전하다.
import { sql, type SQL } from "drizzle-orm";

/** 주민 캐릭터 → 그 주민이 처음 갖는 헤어 아이템 코드 */
export const STARTER_HAIR: Record<string, string> = { "char.boy": "av_hair_short", "char.girl": "av_hair_long" };

type Exec = { execute: (query: SQL) => Promise<unknown> };

/** userId가 없으면 모든 주민에게 */
export async function giveStarterHair(db: Exec, userId?: string): Promise<void> {
  const pairs = sql.join(
    Object.entries(STARTER_HAIR).map(([asset, code]) => sql`(${asset}, ${code})`),
    sql`, `,
  );
  const who = userId ? sql`AND p.user_id = ${userId}` : sql``;
  const starter = sql`
    SELECT p.user_id, h.id AS item_id
    FROM profiles p
    JOIN items c ON c.id = p.character_item_id
    JOIN (VALUES ${pairs}) AS s(asset_key, code) ON s.asset_key = c.asset_key
    JOIN items h ON h.code = s.code
    WHERE TRUE ${who}`;
  await db.execute(sql`INSERT INTO user_items (user_id, item_id) SELECT user_id, item_id FROM (${starter}) x ON CONFLICT DO NOTHING`);
  // 헤어를 아직 안 입었으면 입혀 둔다 (다른 헤어를 입었으면 그대로)
  await db.execute(sql`INSERT INTO avatar_equips (user_id, slot, item_id) SELECT user_id, 'hair', item_id FROM (${starter}) x ON CONFLICT DO NOTHING`);
}
