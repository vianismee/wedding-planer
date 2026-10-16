ALTER TABLE "offer" ADD COLUMN "include_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "addons" jsonb DEFAULT '[]'::jsonb NOT NULL;