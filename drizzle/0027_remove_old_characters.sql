-- 예전 상점 캐릭터 9종을 없앤다 (2026-10-13 사용자 결정: 가진 주민에게서도 없애고 꾸미기의 캐릭터 칸도 없앤다).
-- 2026-10-06부터 팔지 않던 모험가·고양이·강아지·토끼·여우·판다·로봇·드래곤·유니콘.
-- 이 캐릭터를 쓰던 주민은 기본 주민으로 돌린다: 긴 머리 헤어를 입고 있으면 긴 머리 주민, 아니면 짧은 머리 주민.
CREATE TEMP TABLE old_characters AS
  SELECT id FROM items WHERE code IN ('char_human', 'char_cat', 'char_dog', 'char_rabbit', 'char_fox', 'char_panda', 'char_robot', 'char_dragon', 'char_unicorn');
--> statement-breakpoint
CREATE TEMP TABLE character_moves AS
  SELECT p.user_id,
    (SELECT id FROM items WHERE code = CASE WHEN EXISTS (
      SELECT 1 FROM avatar_equips e JOIN items h ON h.id = e.item_id
      WHERE e.user_id = p.user_id AND e.slot = 'hair' AND h.code = 'av_hair_long'
    ) THEN 'char_girl' ELSE 'char_boy' END) AS starter_id
  FROM profiles p WHERE p.character_item_id IN (SELECT id FROM old_characters);
--> statement-breakpoint
-- 기본 주민을 갖게 하고(장착은 가진 아이템만 된다) 그 주민으로 바꾼다
INSERT INTO user_items (user_id, item_id) SELECT user_id, starter_id FROM character_moves WHERE starter_id IS NOT NULL ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE profiles p SET character_item_id = m.starter_id FROM character_moves m WHERE m.user_id = p.user_id AND m.starter_id IS NOT NULL;
--> statement-breakpoint
-- 헤어가 없던 주민에게는 그 주민의 기본 헤어를 주고 입힌다
INSERT INTO user_items (user_id, item_id)
  SELECT m.user_id, h.id FROM character_moves m JOIN items c ON c.id = m.starter_id
  JOIN items h ON h.code = CASE c.code WHEN 'char_girl' THEN 'av_hair_long' ELSE 'av_hair_short' END
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO avatar_equips (user_id, slot, item_id)
  SELECT m.user_id, 'hair', h.id FROM character_moves m JOIN items c ON c.id = m.starter_id
  JOIN items h ON h.code = CASE c.code WHEN 'char_girl' THEN 'av_hair_long' ELSE 'av_hair_short' END
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 선물 기록·보유 목록에서 지우고 아이템 자체를 지운다
DELETE FROM gift_items WHERE item_id IN (SELECT id FROM old_characters);
--> statement-breakpoint
DELETE FROM user_items WHERE item_id IN (SELECT id FROM old_characters);
--> statement-breakpoint
DELETE FROM items WHERE id IN (SELECT id FROM old_characters);
--> statement-breakpoint
DROP TABLE character_moves;
--> statement-breakpoint
DROP TABLE old_characters;
