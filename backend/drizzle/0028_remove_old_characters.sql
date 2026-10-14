-- 예전 상점 캐릭터 9종을 없애고, 가진 주민에게는 캐릭터마다 그 동물 펫이 나오는 알을 관리자 선물로 준다 (2026-10-13 사용자 결정).
-- 2026-10-06부터 팔지 않던 모험가·고양이·강아지·토끼·여우·판다·로봇·드래곤·유니콘.
-- 짝이 되는 펫: 모험가→강아지, 고양이→고양이, 강아지→강아지, 토끼→토끼, 여우→여우, 판다→곰, 로봇→공룡, 드래곤→드래곤, 유니콘→유니콘
-- 이 캐릭터를 쓰던 주민은 기본 주민으로 돌린다: 긴 머리 헤어를 입고 있으면 긴 머리 주민, 아니면 짧은 머리 주민.
CREATE TEMP TABLE old_characters AS
  SELECT i.id, s.id AS species_id
  FROM (VALUES
    ('char_human', 'puppy'), ('char_cat', 'cat'), ('char_dog', 'puppy'), ('char_rabbit', 'bunny'), ('char_fox', 'fox'),
    ('char_panda', 'bear'), ('char_robot', 'dino'), ('char_dragon', 'dragon'), ('char_unicorn', 'unicorn')
  ) AS m(item_code, species_code)
  JOIN items i ON i.code = m.item_code
  LEFT JOIN animal_species s ON s.code = m.species_code;
--> statement-breakpoint
-- 가진 주민마다 관리자 선물 하나 (보낸 사람 없음): 함께 보낸 말 + 펫 알 (선물 팝업·받은 선물 화면·알림함에 보인다)
CREATE TEMP TABLE character_gifts AS
  SELECT DISTINCT ui.user_id, NULL::integer AS gift_id
  FROM user_items ui JOIN old_characters o ON o.id = ui.item_id;
--> statement-breakpoint
UPDATE character_gifts c SET gift_id = g.id
  FROM (SELECT user_id, nextval(pg_get_serial_sequence('gifts', 'id')) AS id FROM character_gifts) g
  WHERE g.user_id = c.user_id;
--> statement-breakpoint
INSERT INTO gifts (id, recipient_id, message) OVERRIDING SYSTEM VALUE
  SELECT gift_id, user_id, '예전 캐릭터가 없어지면서, 가지고 있던 캐릭터와 같은 동물이 태어나는 펫 알을 대신 드려요. 동물 농장 둥지에서 부화시켜 보세요!'
  FROM character_gifts;
--> statement-breakpoint
-- 판다·로봇·모험가처럼 같은 동물이 겹치면(강아지) 알은 캐릭터마다 하나씩, 선물 목록에는 한 번
INSERT INTO gift_pets (gift_id, species_id)
  SELECT DISTINCT c.gift_id, o.species_id
  FROM user_items ui JOIN old_characters o ON o.id = ui.item_id JOIN character_gifts c ON c.user_id = ui.user_id
  WHERE o.species_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO user_animals (user_id, source, egg_species_id)
  SELECT ui.user_id, 'gift', o.species_id
  FROM user_items ui JOIN old_characters o ON o.id = ui.item_id
  ORDER BY ui.user_id, o.id;
--> statement-breakpoint
INSERT INTO notifications (user_id, kind, ref_id) SELECT user_id, 'gift', gift_id::text FROM character_gifts;
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
DROP TABLE character_gifts;
--> statement-breakpoint
DROP TABLE old_characters;
