-- Fix schema drift: push_subscriptions.revision was added to the schema
-- but may not exist in the prod DB if the initial migration was applied
-- from an earlier schema version. This migration adds it if missing.

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL;
