CREATE TABLE "practice_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"mastered" integer DEFAULT 0 NOT NULL,
	"answers" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "practice_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "practice_days" ADD CONSTRAINT "practice_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;