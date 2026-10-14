-- 펫 색 6가지 더하기 (2026-10-13): 주황·민트·하늘·보라·회색·초록
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_color_check";--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_color_check" CHECK ("user_animals"."color" IN ('default', 'brown', 'yellow', 'red', 'black', 'white', 'pink', 'orange', 'mint', 'sky', 'purple', 'gray', 'green'));