-- Pindahkan mahar lama (satu baris per pernikahan) menjadi item mahar.
INSERT INTO "mahar_item" ("id", "wedding_id", "name", "value", "status", "keeper", "note", "sort_order")
SELECT gen_random_uuid()::text, "wedding_id", "description", "value", "status", "keeper", "note", 0
FROM "mahar"
WHERE trim("description") <> '';
--> statement-breakpoint
DROP TABLE "mahar" CASCADE;
