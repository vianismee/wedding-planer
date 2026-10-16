-- Pindahkan isi paket lama (teks bebas) menjadi daftar item, dipecah per baris atau titik koma.
UPDATE "offer"
SET "include_items" = COALESCE(
  (SELECT jsonb_agg(trim(x)) FROM regexp_split_to_table("includes", E'[\n;]+') AS x WHERE trim(x) <> ''),
  '[]'::jsonb
)
WHERE "includes" IS NOT NULL AND trim("includes") <> '';
--> statement-breakpoint
ALTER TABLE "offer" DROP COLUMN "includes";
