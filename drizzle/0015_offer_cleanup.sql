ALTER TABLE "offer" DROP CONSTRAINT "offer_category_id_budget_category_id_fk";
--> statement-breakpoint
ALTER TABLE "offer" ALTER COLUMN "prospect_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "vendor_name";--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "availability";--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "available";--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "contact";