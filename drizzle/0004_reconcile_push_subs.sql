-- Fully reconcile push_subscriptions with the schema — the prod table predates
-- several column additions (keys, revision, timestamps, deleted_at) and only
-- some drift-fixes existed. Add every expected column idempotently so subscribe
-- and send stop 500'ing on missing columns.

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text NOT NULL DEFAULT '';
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "keys" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "revision" integer NOT NULL DEFAULT 1;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
