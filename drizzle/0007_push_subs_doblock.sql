-- Prior rebuild (0006) used split statements; the runner swallowed the CREATE's
-- "already exists" after the DROP didn't fully take, so the drifted table stuck.
-- A single DO block runs DROP then CREATE sequentially in one atomic statement,
-- so CREATE always sees a clean slate. The table is empty (subscribe never
-- succeeded), so nothing is lost.

DO $$
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS "push_subscriptions" CASCADE';
  EXECUTE 'CREATE TABLE "push_subscriptions" (
    "id" uuid PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
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
