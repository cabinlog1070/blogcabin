CREATE TABLE "social_link_rewards" (
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_link_rewards_provider_id_account_id_pk" PRIMARY KEY("provider_id","account_id")
);
--> statement-breakpoint
-- 이미 준 연동 보상(원장 ref_id = "kakao:회원번호")을 옮겨 둔다. 회원번호에 ':'가 있어도 첫 ':' 뒤 전부가 회원번호다
INSERT INTO "social_link_rewards" ("provider_id", "account_id", "created_at")
SELECT split_part("ref_id", ':', 1), substr("ref_id", strpos("ref_id", ':') + 1), "created_at"
FROM "point_ledger"
WHERE "reason" = 'social_link' AND strpos("ref_id", ':') > 0
ON CONFLICT DO NOTHING;
