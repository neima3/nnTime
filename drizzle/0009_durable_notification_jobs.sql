CREATE TYPE "public"."notification_job_type" AS ENUM('start', 'halfway', 'wrap-up', 'review-today', 'weekly-review');
--> statement-breakpoint
CREATE TYPE "public"."notification_job_state" AS ENUM('pending', 'processing', 'retry', 'sent', 'suppressed', 'expired', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."notification_entity_type" AS ENUM('activity', 'review');
--> statement-breakpoint
CREATE TYPE "public"."scheduler_run_state" AS ENUM('running', 'succeeded', 'failed');
--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" "notification_entity_type" NOT NULL,
	"entity_id" uuid,
	"occurrence_key" timestamp with time zone,
	"type" "notification_job_type" NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"dedup_key" text NOT NULL,
	"state" "notification_job_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"claim_token" uuid,
	"delivered_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_jobs_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
	CONSTRAINT "notification_jobs_entity_check"
		CHECK (
			("entity_type" = 'activity' AND "entity_id" IS NOT NULL AND "occurrence_key" IS NOT NULL)
			OR
			("entity_type" = 'review' AND "entity_id" IS NULL AND "occurrence_key" IS NULL)
		)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_jobs_dedup_idx" ON "notification_jobs" USING btree ("dedup_key");
--> statement-breakpoint
CREATE INDEX "notification_jobs_due_idx" ON "notification_jobs" USING btree ("state","next_attempt_at","fire_at");
--> statement-breakpoint
CREATE INDEX "notification_jobs_user_entity_idx" ON "notification_jobs" USING btree ("user_id","entity_type","entity_id","occurrence_key");
--> statement-breakpoint
CREATE TABLE "scheduler_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" "scheduler_run_state" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE INDEX "scheduler_runs_started_idx" ON "scheduler_runs" USING btree ("started_at");
