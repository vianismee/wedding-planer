CREATE TABLE "wedding_role" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"perms" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "perms" jsonb;--> statement-breakpoint
ALTER TABLE "wedding_role" ADD CONSTRAINT "wedding_role_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wedding_role_key_uq" ON "wedding_role" USING btree ("wedding_id","key");