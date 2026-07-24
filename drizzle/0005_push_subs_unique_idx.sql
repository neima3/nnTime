-- The subscribe upsert uses ON CONFLICT (user_id, endpoint), which needs a
-- matching unique index. Prod's table was missing it (drift), so every insert
-- failed. Create it idempotently. (No live subscriptions exist yet, so there
-- are no duplicates to collide.)

CREATE UNIQUE INDEX IF NOT EXISTS "push_subs_user_endpoint_idx" ON "push_subscriptions" ("user_id", "endpoint");
