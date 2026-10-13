CREATE TABLE "gift_items" (
	"gift_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	CONSTRAINT "gift_items_gift_id_item_id_pk" PRIMARY KEY("gift_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "gifts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gifts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sender_id" text,
	"recipient_id" text NOT NULL,
	"message" text NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gifts_coins_check" CHECK ("gifts"."coins" >= 0),
	CONSTRAINT "gifts_message_check" CHECK (char_length("gifts"."message") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "point_ledger" DROP CONSTRAINT "point_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gifts_recipient_created_idx" ON "gifts" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" IN ('level_up', 'like', 'comment', 'reply', 'pet_level_up', 'gift'));--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_reason_check" CHECK ("point_ledger"."reason" IN ('signup', 'attendance', 'attendance_streak', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'potion_purchase', 'invite', 'invited', 'admin_grant', 'admin_gift', 'social_link'));