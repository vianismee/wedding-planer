ALTER TABLE "offer" ADD COLUMN "dp_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "dp_amount" bigint DEFAULT 0 NOT NULL;