-- Fix schema drift: push_subscriptions.keys (the p256dh/auth encryption keys
-- for Web Push) was in the schema but missing from the prod DB, so subscribe
-- and send both failed. Add it if missing. Existing rows (if any) get an empty
-- object; real subscriptions always overwrite it on register.

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "keys" jsonb NOT NULL DEFAULT '{}'::jsonb;
