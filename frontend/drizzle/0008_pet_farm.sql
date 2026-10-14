CREATE TYPE "public"."animal_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."farm_item_kind" AS ENUM('potion');--> statement-breakpoint
CREATE TYPE "public"."pet_accessory" AS ENUM('none', 'ribbon', 'flower', 'scarf');--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'potion_purchase';--> statement-breakpoint
CREATE TABLE "farm_items" (
	"user_id" text NOT NULL,
	"kind" "farm_item_kind" NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_items_user_id_kind_pk" PRIMARY KEY("user_id","kind"),
	CONSTRAINT "farm_items_quantity_check" CHECK ("farm_items"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "animal_species" ADD COLUMN "max_level" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "displayed_animal_id" integer;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "gender" "animal_gender";--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "accessory" "pet_accessory" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "carried" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_items" ADD CONSTRAINT "farm_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_user_id_uq" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_displayed_animal_owned_fk" FOREIGN KEY ("user_id","displayed_animal_id") REFERENCES "public"."user_animals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_pet_level_up_uq" ON "notifications" USING btree ("user_id","ref_id","level") WHERE "notifications"."kind" = 'pet_level_up';--> statement-breakpoint
CREATE UNIQUE INDEX "user_animals_carried_uq" ON "user_animals" USING btree ("user_id") WHERE "user_animals"."carried";--> statement-breakpoint
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_max_level_check" CHECK ("animal_species"."max_level" >= 2 AND "animal_species"."max_level" < "animal_species"."grow_exp");--> statement-breakpoint
-- 이미 부화한 동물: 이름은 종류 이름, 성별은 랜덤으로 채운다 (펫 정보 추가 전 데이터)
UPDATE "user_animals" ua SET "name" = s."name", "gender" = (CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END)::"animal_gender"
FROM "animal_species" s WHERE s."id" = ua."species_id" AND ua."status" <> 'egg';--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_pet_check" CHECK (("user_animals"."status" = 'egg') = ("user_animals"."name" IS NULL) AND ("user_animals"."name" IS NULL) = ("user_animals"."gender" IS NULL));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_name_check" CHECK (char_length("user_animals"."name") BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_carried_check" CHECK (NOT "user_animals"."carried" OR "user_animals"."status" <> 'egg');