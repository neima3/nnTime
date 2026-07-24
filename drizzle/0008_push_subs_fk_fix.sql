-- 0007 rebuilt the table but hardcoded the FK to "users" (plural). The actual
-- better-auth user table is "user" (singular), so every insert failed the FK
-- (session userId lives in "user"). Rebuild once more with the correct FK.

DO $$
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS "push_subscriptions" CASCADE';
  EXECUTE 'CREATE TABLE "push_subscriptions" (
    "id" uuid PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "endpoint" text NOT NULL,
    "keys" jsonb NOT NULL,
    "revision" integer NOT NULL DEFAULT 1,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz
  )';
  EXECUTE 'CREATE UNIQUE INDEX "push_subs_user_endpoint_idx" ON "push_subscriptions" ("user_id","endpoint")';
  EXECUTE 'CREATE INDEX "push_subs_user_idx" ON "push_subscriptions" ("user_id")';
END $$;
