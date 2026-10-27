CREATE TABLE "savings_deposit" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"side" text DEFAULT 'pengantin' NOT NULL,
	"target" bigint DEFAULT 0 NOT NULL,
	"frequency" text DEFAULT 'bulanan' NOT NULL,
	"start_date" date NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "savings_deposit" ADD CONSTRAINT "savings_deposit_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_deposit" ADD CONSTRAINT "savings_deposit_goal_id_savings_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."savings_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "savings_deposit_goal_idx" ON "savings_deposit" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "savings_goal_wedding_idx" ON "savings_goal" USING btree ("wedding_id");