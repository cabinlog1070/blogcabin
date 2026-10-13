ALTER TABLE "blogs" ADD COLUMN "room_char_x" real;--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "room_char_y" real;--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "room_pet_x" real;--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "room_pet_y" real;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_room_char_check" CHECK (("blogs"."room_char_x" IS NULL) = ("blogs"."room_char_y" IS NULL) AND "blogs"."room_char_x" BETWEEN 0 AND 100 AND "blogs"."room_char_y" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_room_pet_check" CHECK (("blogs"."room_pet_x" IS NULL) = ("blogs"."room_pet_y" IS NULL) AND "blogs"."room_pet_x" BETWEEN 0 AND 100 AND "blogs"."room_pet_y" BETWEEN 0 AND 100);