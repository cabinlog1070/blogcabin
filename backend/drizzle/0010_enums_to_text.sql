-- PostgreSQL enum 타입 12개를 text + CHECK로 바꾼다 (Crowfoot ERD가 enum 타입을 다루지 못해서, 2026-10-08).
-- 값은 그대로 두고 타입만 바꾼다. enum 값을 쓰는 기본값·CHECK·부분 인덱스·외래 키는 타입을 바꾸기 전에 지웠다가 다시 만든다.
ALTER TABLE "posts" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "accessory" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_slot_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_level_check";--> statement-breakpoint
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_species_check";--> statement-breakpoint
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_pet_check";--> statement-breakpoint
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_carried_check";--> statement-breakpoint
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_level_check";--> statement-breakpoint
ALTER TABLE "avatar_equips" DROP CONSTRAINT "avatar_equips_item_slot_fk";--> statement-breakpoint
DROP INDEX "notifications_level_up_uq";--> statement-breakpoint
DROP INDEX "notifications_pet_level_up_uq";--> statement-breakpoint
DROP INDEX "user_animals_starter_uq";--> statement-breakpoint
DROP INDEX "user_animals_level_uq";--> statement-breakpoint
ALTER TABLE "animal_cares" ALTER COLUMN "action" SET DATA TYPE text USING "action"::text;--> statement-breakpoint
ALTER TABLE "avatar_equips" ALTER COLUMN "slot" SET DATA TYPE text USING "slot"::text;--> statement-breakpoint
ALTER TABLE "farm_items" ALTER COLUMN "kind" SET DATA TYPE text USING "kind"::text;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "slot" SET DATA TYPE text USING "slot"::text;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text USING "kind"::text;--> statement-breakpoint
ALTER TABLE "point_ledger" ALTER COLUMN "reason" SET DATA TYPE text USING "reason"::text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "visibility" SET DATA TYPE text USING "visibility"::text;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "source" SET DATA TYPE text USING "source"::text;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "gender" SET DATA TYPE text USING "gender"::text;--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "accessory" SET DATA TYPE text USING "accessory"::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "status" SET DEFAULT 'egg';--> statement-breakpoint
ALTER TABLE "user_animals" ALTER COLUMN "accessory" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_item_slot_fk" FOREIGN KEY ("item_id","slot") REFERENCES "public"."items"("id","slot") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_level_up_uq" ON "notifications" USING btree ("user_id","level") WHERE "notifications"."kind" = 'level_up';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_pet_level_up_uq" ON "notifications" USING btree ("user_id","ref_id","level") WHERE "notifications"."kind" = 'pet_level_up';--> statement-breakpoint
CREATE UNIQUE INDEX "user_animals_starter_uq" ON "user_animals" USING btree ("user_id") WHERE "user_animals"."source" = 'starter';--> statement-breakpoint
CREATE UNIQUE INDEX "user_animals_level_uq" ON "user_animals" USING btree ("user_id","source_level") WHERE "user_animals"."source" = 'level';--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_species_check" CHECK (("user_animals"."status" = 'egg') = ("user_animals"."species_id" IS NULL));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_pet_check" CHECK (("user_animals"."status" = 'egg') = ("user_animals"."name" IS NULL) AND ("user_animals"."name" IS NULL) = ("user_animals"."gender" IS NULL));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_carried_check" CHECK (NOT "user_animals"."carried" OR "user_animals"."status" <> 'egg');--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_level_check" CHECK (("user_animals"."source" = 'level') = ("user_animals"."source_level" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "animal_cares" ADD CONSTRAINT "animal_cares_action_check" CHECK ("animal_cares"."action" IN ('feed', 'water', 'pet'));--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_slot_check" CHECK ("avatar_equips"."slot" IN ('top', 'bottom', 'hat', 'shoes'));--> statement-breakpoint
ALTER TABLE "farm_items" ADD CONSTRAINT "farm_items_kind_check" CHECK ("farm_items"."kind" IN ('potion'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("items"."type" IN ('character', 'background', 'furniture', 'avatar'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_slot_value_check" CHECK ("items"."slot" IN ('top', 'bottom', 'hat', 'shoes'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_slot_check" CHECK (("items"."type" = 'avatar') = ("items"."slot" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" IN ('level_up', 'like', 'comment', 'reply', 'pet_level_up'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_level_check" CHECK (("notifications"."kind" IN ('level_up', 'pet_level_up')) = ("notifications"."level" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" IN ('signup', 'attendance', 'attendance_streak', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'potion_purchase', 'invite', 'invited'));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_visibility_check" CHECK ("posts"."visibility" IN ('public', 'private'));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_status_check" CHECK ("user_animals"."status" IN ('egg', 'growing', 'grown'));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_source_check" CHECK ("user_animals"."source" IN ('starter', 'level', 'shop'));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_gender_check" CHECK ("user_animals"."gender" IN ('male', 'female'));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_accessory_check" CHECK ("user_animals"."accessory" IN ('none', 'ribbon', 'flower', 'scarf'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('user', 'admin'));--> statement-breakpoint
DROP TYPE "public"."animal_gender";--> statement-breakpoint
DROP TYPE "public"."animal_status";--> statement-breakpoint
DROP TYPE "public"."avatar_slot";--> statement-breakpoint
DROP TYPE "public"."care_action";--> statement-breakpoint
DROP TYPE "public"."egg_source";--> statement-breakpoint
DROP TYPE "public"."farm_item_kind";--> statement-breakpoint
DROP TYPE "public"."item_type";--> statement-breakpoint
DROP TYPE "public"."ledger_reason";--> statement-breakpoint
DROP TYPE "public"."notification_kind";--> statement-breakpoint
DROP TYPE "public"."pet_accessory";--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
DROP TYPE "public"."visibility";
