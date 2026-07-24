-- The prod push_subscriptions table carries leftover NOT-NULL columns from a
-- much older schema (positions 4-6 in the physical row), which the ORM insert
-- never fills → 23502 NOT NULL violations on every subscribe. The table has no
-- real data (subscribe has never once succeeded), so the safe, complete fix is
-- to drop the drifted table and recreate it to match the current schema exactly.

DROP TABLE IF EXISTS "push_subscriptions" CASCADE;
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "keys" jsonb NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_subs_user_endpoint_idx" ON "push_subscriptions" ("user_id","endpoint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subs_user_idx" ON "push_subscriptions" ("user_id");
