CREATE TABLE "gift_pets" (
	"gift_id" integer NOT NULL,
	"species_id" integer NOT NULL,
	CONSTRAINT "gift_pets_gift_id_species_id_pk" PRIMARY KEY("gift_id","species_id")
);
--> statement-breakpoint
ALTER TABLE "user_animals" DROP CONSTRAINT "user_animals_source_check";--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "egg_species_id" integer;--> statement-breakpoint
ALTER TABLE "gift_pets" ADD CONSTRAINT "gift_pets_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_pets" ADD CONSTRAINT "gift_pets_species_id_animal_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."animal_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_egg_species_id_animal_species_id_fk" FOREIGN KEY ("egg_species_id") REFERENCES "public"."animal_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_source_check" CHECK ("user_animals"."source" IN ('starter', 'level', 'shop', 'gift'));