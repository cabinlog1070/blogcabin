-- 펫 색 고르기 (2026-10-12): default = 동물마다 정해진 색
ALTER TABLE "user_animals" ADD COLUMN "color" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_color_check" CHECK ("user_animals"."color" IN ('default', 'brown', 'yellow', 'red', 'black', 'white', 'pink'));