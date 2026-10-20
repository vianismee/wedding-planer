CREATE TABLE "prospect" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"availability" text,
	"available" boolean DEFAULT true NOT NULL,
	"notes" text,
	"dp_type" text DEFAULT 'percent' NOT NULL,
	"dp_percent" integer DEFAULT 30 NOT NULL,
	"dp_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "prospect_id" text;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "dp_custom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect" ADD CONSTRAINT "prospect_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect" ADD CONSTRAINT "prospect_category_id_budget_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_wedding_idx" ON "prospect" USING btree ("wedding_id");--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_prospect_id_prospect_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospect"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Data lama: satu calon vendor per pernikahan, kategori, dan nama vendor (huruf kecil, spasi dirapikan).
-- Kontak, ketersediaan, dan DP diambil dari penawaran paling awal; id-nya juga, supaya hasilnya pasti.
INSERT INTO "prospect" ("id", "wedding_id", "category_id", "name", "contact", "availability", "available", "dp_type", "dp_percent", "dp_amount", "created_at")
SELECT DISTINCT ON (o."wedding_id", o."category_id", lower(regexp_replace(trim(o."vendor_name"), '\s+', ' ', 'g')))
  o."id", o."wedding_id", o."category_id", regexp_replace(trim(o."vendor_name"), '\s+', ' ', 'g'), o."contact", o."availability", o."available", o."dp_type", o."dp_percent", o."dp_amount", o."created_at"
FROM "offer" o
ORDER BY o."wedding_id", o."category_id", lower(regexp_replace(trim(o."vendor_name"), '\s+', ' ', 'g')), o."created_at", o."id";
--> statement-breakpoint
UPDATE "offer" o SET "prospect_id" = p."id"
FROM "prospect" p
WHERE p."wedding_id" = o."wedding_id"
  AND p."category_id" = o."category_id"
  AND lower(p."name") = lower(regexp_replace(trim(o."vendor_name"), '\s+', ' ', 'g'));
--> statement-breakpoint
-- Paket yang DP-nya berbeda dari calon vendornya tetap memakai DP-nya sendiri.
UPDATE "offer" o SET "dp_custom" = true
FROM "prospect" p
WHERE p."id" = o."prospect_id"
  AND (o."dp_type" <> p."dp_type"
    OR (o."dp_type" = 'percent' AND o."dp_percent" <> p."dp_percent")
    OR (o."dp_type" = 'nominal' AND o."dp_amount" <> p."dp_amount"));
