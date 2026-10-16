ALTER TABLE "vendor" ADD COLUMN "package_name" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "package_price" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "include_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "addons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
-- Vendor dari penawaran: salin data paket terstruktur, dan kosongkan deskripsi panjang yang dulu dibuat otomatis.
UPDATE "vendor" v
SET "package_name" = o."package_name",
    "package_price" = o."price",
    "include_items" = o."include_items",
    "addons" = o."addons",
    "package_desc" = NULL
FROM "offer" o
WHERE v."offer_id" = o."id";
--> statement-breakpoint
-- Vendor manual: seluruh harga dianggap harga paket.
UPDATE "vendor" SET "package_price" = "total_price" WHERE "offer_id" IS NULL;
