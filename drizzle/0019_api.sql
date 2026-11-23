CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "guest" SET "code" = substr(md5(random()::text || "id"), 1, 8);--> statement-breakpoint
ALTER TABLE "guest" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "rsvp" text;--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "rsvp_pax" integer;--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "rsvp_message" text;--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "rsvp_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wedding" ADD COLUMN "invitation_url" text;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_wedding_idx" ON "api_key" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_wedding_code_uq" ON "guest" USING btree ("wedding_id","code");