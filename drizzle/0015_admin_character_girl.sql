-- 관리자 캐릭터를 여자 주민(char_girl)으로 바꾼다 (2026-10-12 요청).
-- 이미 만들어진 관리자 계정에 여자 주민이 없으면 지급하고, 지금 쓰는 캐릭터를 여자 주민으로 바꾼다. 입은 꾸미기는 그대로 둔다.
-- 여러 번 실행돼도 결과가 같다.
INSERT INTO "user_items" ("user_id", "item_id")
SELECT u."id", i."id"
FROM "users" u
JOIN "profiles" p ON p."user_id" = u."id"
CROSS JOIN "items" i
WHERE u."role" = 'admin' AND i."code" = 'char_girl'
ON CONFLICT ("user_id", "item_id") DO NOTHING;--> statement-breakpoint
UPDATE "profiles" p
SET "character_item_id" = i."id"
FROM "users" u, "items" i
WHERE u."id" = p."user_id" AND u."role" = 'admin' AND i."code" = 'char_girl';
