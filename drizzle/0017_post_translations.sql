CREATE TABLE "post_translations" (
	"post_id" integer NOT NULL,
	"target_lang" text NOT NULL,
	"source_hash" text NOT NULL,
	"title" text NOT NULL,
	"content_html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_translations_post_id_target_lang_pk" PRIMARY KEY("post_id","target_lang"),
	CONSTRAINT "post_translations_target_lang_check" CHECK ("post_translations"."target_lang" IN ('ko', 'ja'))
);
--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;