-- 모든 주민이 관리자(공지사항 블로그)를 이웃으로 갖는다 (2026-10-12 요청).
-- 이미 가입한 주민(프로필이 있는 회원)에게 관리자 이웃을 넣는다. 새로 가입하는 주민은 온보딩에서 넣는다.
-- 이미 이웃이면 그대로 둔다(즐겨찾기 유지). 여러 번 실행돼도 결과가 같다.
INSERT INTO "follows" ("follower_id", "followee_id")
SELECT p."user_id", a."id"
FROM "profiles" p
CROSS JOIN "users" a
JOIN "blogs" b ON b."owner_id" = a."id"
WHERE a."role" = 'admin' AND p."user_id" <> a."id"
ON CONFLICT ("follower_id", "followee_id") DO NOTHING;
