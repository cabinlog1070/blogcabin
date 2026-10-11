CREATE TABLE "social_link_rewards" (
	"provider_id" text NOT NULL,
	"account_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_link_rewards_provider_id_account_hash_pk" PRIMARY KEY("provider_id","account_hash")
);
