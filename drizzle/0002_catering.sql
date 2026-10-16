CREATE TABLE "catering_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"pax_source" text DEFAULT 'tamu' NOT NULL,
	"manual_pax" integer DEFAULT 0 NOT NULL,
	"buffer_percent" integer DEFAULT 10 NOT NULL,
	"price_per_pax" bigint DEFAULT 0 NOT NULL,
	"ingredient_per_pax" bigint DEFAULT 0 NOT NULL,
	"cooks" integer DEFAULT 0 NOT NULL,
	"cook_wage" bigint DEFAULT 0 NOT NULL,
	"cook_days" integer DEFAULT 1 NOT NULL,
	"equipment_cost" bigint DEFAULT 0 NOT NULL,
	"extras" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catering_plan" ADD CONSTRAINT "catering_plan_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catering_wedding_idx" ON "catering_plan" USING btree ("wedding_id");