ALTER TABLE "avatar_equips" DROP CONSTRAINT "avatar_equips_slot_check";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_slot_value_check";--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_slot_check" CHECK ("avatar_equips"."slot" IN ('hair', 'top', 'bottom', 'hat', 'shoes'));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_slot_value_check" CHECK ("items"."slot" IN ('hair', 'top', 'bottom', 'hat', 'shoes'));