ALTER TYPE "public"."ledger_reason" ADD VALUE 'invite';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'invited';--> statement-breakpoint
CREATE TABLE "blog_visits" (
	"blog_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitor_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_visits_blog_id_date_visitor_key_pk" PRIMARY KEY("blog_id","date","visitor_key"),
	CONSTRAINT "blog_visits_visitor_key_check" CHECK ("blog_visits"."visitor_key" ~ '^(u:[A-Za-z0-9_-]{1,64}|b:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|w:[0-9a-f]{32})$')
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"login_key" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_failures_check" CHECK ("login_attempts"."failures" >= 0)
);
--> statement-breakpoint
CREATE TABLE "post_views" (
	"post_id" integer NOT NULL,
	"date" date NOT NULL,
	"viewer_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_views_post_id_date_viewer_key_pk" PRIMARY KEY("post_id","date","viewer_key"),
	CONSTRAINT "post_views_viewer_key_check" CHECK ("post_views"."viewer_key" ~ '^(u:[A-Za-z0-9_-]{1,64}|b:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|w:[0-9a-f]{32})$')
);
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "roof_color" text;--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- 초대 코드(GAME-09): 칸을 비운 채 더하고, 이미 온보딩을 마친 회원에게 코드를 하나씩 채운 뒤 NOT NULL을 건다
ALTER TABLE "profiles" ADD COLUMN "invite_code" text;--> statement-breakpoint
DO $$
DECLARE
  r record;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
BEGIN
  FOR r IN SELECT user_id FROM profiles WHERE invite_code IS NULL LOOP
    LOOP
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE invite_code = code);
    END LOOP;
    UPDATE profiles SET invite_code = code WHERE user_id = r.user_id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "invite_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "invite_rewarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blog_visits" ADD CONSTRAINT "blog_visits_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_invite_code_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_roof_color_check" CHECK ("blogs"."roof_color" IN ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown'));--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_check" CHECK ("comments"."author_id" IS NOT NULL OR "comments"."deleted_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_invite_code_check" CHECK ("profiles"."invite_code" ~ '^[A-HJ-NP-Z2-9]{6}$');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_invited_by_check" CHECK ("profiles"."invited_by" <> "profiles"."user_id");