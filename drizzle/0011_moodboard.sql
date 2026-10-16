CREATE TABLE "moodboard" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"board" text NOT NULL,
	"data" jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moodboard" ADD CONSTRAINT "moodboard_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moodboard_wedding_board_idx" ON "moodboard" USING btree ("wedding_id","board");