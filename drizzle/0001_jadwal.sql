CREATE TABLE "schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'lainnya' NOT NULL,
	"date" date NOT NULL,
	"start_time" text,
	"location" text,
	"vendor_id" text,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_wedding_idx" ON "schedule" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "schedule_date_idx" ON "schedule" USING btree ("date");