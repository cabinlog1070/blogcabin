CREATE TABLE "inquiries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inquiries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text,
	"guest_username" text,
	"contact_email" text,
	"topic" text NOT NULL,
	"content" text NOT NULL,
	"answer" text,
	"answered_by" text,
	"answered_at" timestamp with time zone,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_topic_check" CHECK ("inquiries"."topic" IN ('password', 'account', 'bug', 'other')),
	CONSTRAINT "inquiries_status_check" CHECK ("inquiries"."status" IN ('waiting', 'answered', 'closed')),
	CONSTRAINT "inquiries_sender_check" CHECK ("inquiries"."user_id" IS NOT NULL OR "inquiries"."contact_email" IS NOT NULL),
	CONSTRAINT "inquiries_content_check" CHECK (char_length("inquiries"."content") BETWEEN 1 AND 2000),
	CONSTRAINT "inquiries_answer_check" CHECK ("inquiries"."answer" IS NULL OR char_length("inquiries"."answer") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_status_created_idx" ON "inquiries" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inquiries_user_created_idx" ON "inquiries" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" IN ('level_up', 'like', 'comment', 'reply', 'pet_level_up', 'gift', 'mention', 'inquiry_answer'));