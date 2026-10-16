CREATE TABLE "mahar_item" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'belum' NOT NULL,
	"keeper" text,
	"purchase_url" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mahar_item" ADD CONSTRAINT "mahar_item_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mahar_item_wedding_idx" ON "mahar_item" USING btree ("wedding_id");