CREATE TYPE "public"."avatar_slot" AS ENUM('top', 'bottom', 'hat', 'shoes');--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'avatar';--> statement-breakpoint
CREATE TABLE "avatar_equips" (
	"user_id" text NOT NULL,
	"slot" "avatar_slot" NOT NULL,
	"item_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_equips_user_id_slot_pk" PRIMARY KEY("user_id","slot")
);
--> statement-breakpoint
CREATE TABLE "room_furniture" (
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_furniture_user_id_item_id_pk" PRIMARY KEY("user_id","item_id"),
	CONSTRAINT "room_furniture_x_check" CHECK ("room_furniture"."x" BETWEEN 0 AND 100),
	CONSTRAINT "room_furniture_y_check" CHECK ("room_furniture"."y" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "slot" "avatar_slot";--> statement-breakpoint
-- avatar_equips의 (item_id, slot) 외래 키보다 먼저 만들어야 한다
ALTER TABLE "items" ADD CONSTRAINT "items_id_slot_uq" UNIQUE("id","slot");--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_item_slot_fk" FOREIGN KEY ("item_id","slot") REFERENCES "public"."items"("id","slot") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_furniture" ADD CONSTRAINT "room_furniture_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_furniture" ADD CONSTRAINT "room_furniture_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_slot_check" CHECK (("items"."type"::text = 'avatar') = ("items"."slot" IS NOT NULL));