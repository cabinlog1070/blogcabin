-- 글 예약 발행(POST-11)·관리자 글 광장 게시판 게시 시간 (2026-10-13)
-- 예약 글은 created_at에 올라갈 시각을 적는다 (칸을 따로 두지 않는다). 게시 시간은 지금까지의 고정값(7일 = 168시간)으로 채운다
ALTER TABLE "posts" ADD COLUMN "pin_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_pin_hours_check" CHECK ("posts"."pin_hours" BETWEEN 0 AND 720);--> statement-breakpoint
UPDATE "posts" SET "pin_hours" = 168
FROM "blogs", "users"
WHERE "blogs"."id" = "posts"."blog_id" AND "users"."id" = "blogs"."owner_id" AND "users"."role" = 'admin';
