CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"vocab_level" text,
	"vocab_field" text,
	"vocab_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vocab_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" text NOT NULL,
	"term_key" text NOT NULL,
	"definition" text NOT NULL,
	"example" text DEFAULT '' NOT NULL,
	"part_of_speech" text DEFAULT '' NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"times_wrong" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_terms" ADD CONSTRAINT "vocab_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entries_user_created" ON "journal_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_terms_user_term_key" ON "vocab_terms" USING btree ("user_id","term_key");--> statement-breakpoint
CREATE INDEX "vocab_terms_user_status" ON "vocab_terms" USING btree ("user_id","status");