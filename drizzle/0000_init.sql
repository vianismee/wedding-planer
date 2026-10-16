CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_category" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"allocation" bigint DEFAULT 0 NOT NULL,
	"need" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"person" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'belum' NOT NULL,
	"file_id" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'lainnya' NOT NULL,
	"date" date,
	"start_time" text,
	"location" text,
	"estimated_guests" integer,
	"status" text DEFAULT 'persiapan' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category_id" text,
	"description" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"funding_source_id" text,
	"receipt_file_id" text,
	"payment_term_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"kind" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_source" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"side" text DEFAULT 'pengantin' NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"category" text DEFAULT 'Keluarga' NOT NULL,
	"side" text NOT NULL,
	"session" text DEFAULT 'Sesi 1' NOT NULL,
	"pax" integer DEFAULT 2 NOT NULL,
	"delivery" text DEFAULT 'diantar' NOT NULL,
	"status" text DEFAULT 'belum_kirim' NOT NULL,
	"vip" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"token" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mahar" (
	"wedding_id" text PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'belum' NOT NULL,
	"keeper" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category_id" text NOT NULL,
	"vendor_name" text NOT NULL,
	"package_name" text,
	"price" bigint DEFAULT 0 NOT NULL,
	"includes" text,
	"dp_percent" integer DEFAULT 30 NOT NULL,
	"availability" text,
	"available" boolean DEFAULT true NOT NULL,
	"notes" text,
	"contact" text,
	"attachment_file_id" text,
	"status" text DEFAULT 'dibandingkan' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_term" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"label" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" date,
	"reminded_h7" boolean DEFAULT false NOT NULL,
	"reminded_h1" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rundown_item" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"event_id" text NOT NULL,
	"time" text NOT NULL,
	"activity" text NOT NULL,
	"pic" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seserahan_item" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'belum' NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"pic" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"title" text NOT NULL,
	"pic" text,
	"assignee_member_id" text,
	"offset_days" integer NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category_id" text,
	"offer_id" text,
	"name" text NOT NULL,
	"package_desc" text,
	"contact" text,
	"total_price" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding" (
	"id" text PRIMARY KEY NOT NULL,
	"groom_name" text NOT NULL,
	"bride_name" text NOT NULL,
	"akad_date" date NOT NULL,
	"city" text NOT NULL,
	"akad_template" text NOT NULL,
	"resepsi_template" text NOT NULL,
	"religion" text DEFAULT 'islam' NOT NULL,
	"office_name" text,
	"accent" text DEFAULT '#D6F06B' NOT NULL,
	"quota_groom" integer DEFAULT 300 NOT NULL,
	"quota_bride" integer DEFAULT 300 NOT NULL,
	"payment_status" text DEFAULT 'free' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_category" ADD CONSTRAINT "budget_category_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_budget_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_funding_source_id_funding_source_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."funding_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_receipt_file_id_file_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_source" ADD CONSTRAINT "funding_source_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest" ADD CONSTRAINT "guest_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mahar" ADD CONSTRAINT "mahar_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_category_id_budget_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_attachment_file_id_file_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_term" ADD CONSTRAINT "payment_term_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_term" ADD CONSTRAINT "payment_term_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_item" ADD CONSTRAINT "rundown_item_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_item" ADD CONSTRAINT "rundown_item_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seserahan_item" ADD CONSTRAINT "seserahan_item_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_member_id_member_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_category_id_budget_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_offer_id_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding" ADD CONSTRAINT "wedding_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_category_wedding_idx" ON "budget_category" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "document_wedding_idx" ON "document" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "event_wedding_idx" ON "event" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "expense_wedding_idx" ON "expense" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "file_wedding_idx" ON "file" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "funding_wedding_idx" ON "funding_source" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "guest_wedding_idx" ON "guest" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "invite_wedding_idx" ON "invite" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_wedding_user_uq" ON "member" USING btree ("wedding_id","user_id");--> statement-breakpoint
CREATE INDEX "offer_wedding_idx" ON "offer" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "term_wedding_idx" ON "payment_term" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "term_due_idx" ON "payment_term" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "rundown_event_idx" ON "rundown_item" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "seserahan_wedding_idx" ON "seserahan_item" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_wedding_idx" ON "task" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "vendor_wedding_idx" ON "vendor" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");