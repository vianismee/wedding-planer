ALTER TABLE "moodboard" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "moodboard" ADD CONSTRAINT "moodboard_share_token_unique" UNIQUE("share_token");