# ADR-004 — Background jobs, focus timer, notifications

Status: **Accepted** (2026-07-12). Binding.

## Job runner
- One durable scheduler: a dedicated worker process in the app container
  (node, `node-cron`-style tick every minute) guarded by a Postgres
  **advisory-lock lease** so exactly one instance runs work even with
  replicas/restarts. Coolify cron hitting an authenticated endpoint is the
  fallback if the worker proves unreliable — decision recorded here either way.
- Jobs table: (id, type, run_at, unique dedup key, attempts, last_error,
  state). Retries with backoff; expiry; observability = job log rows +
  `/api/health` reporting scheduler lag.
- **Never** page-load/app-open checks as the scheduler.

## Routine materialization (Phase 2B)
- Unique key `(routine_schedule_id, occurrence_key)` — retries and double
  runs cannot duplicate. Horizon: materialize 48h ahead; missed-run backfill
  window 24h; schedule edits cancel/regenerate pending rows; pause supported.

## Focus sessions (Phase 3A)
- Server-authoritative state machine:
  `running | paused | completed | skipped | cancelled`.
- Row: user_id, activity_occurrence ref (nullable for ad-hoc), started_at,
  target_duration_min, accumulated_pause_sec, current_interval_started_at,
  revision, completion_reason.
- **Partial unique index: one session per user in (running|paused).**
- Transitions are idempotent, validated, and use server time. Clients derive
  remaining time from the row; they never persist countdowns.
- Defined behaviors: reload/navigation (rehydrate from server), two devices
  (second device adopts session; first detects revision change and yields),
  sleep/wake (recompute from timestamps), clock skew (server time wins),
  offline (transition queued per ADR-002; conflict → server state), overtime
  (state stays running; UI overtime treatment; wrap-up notification),
  activity edited (session keeps its captured target; banner offers update),
  activity deleted (session auto-cancels with event).

## Notifications
- Notification jobs are computed rows (type: start, halfway, wrap-up,
  review-today, weekly-review), created/cancelled/rescheduled by the same
  worker whenever activities, timers, or settings change; dedup key
  `(user, entity, type, fire_at)`.
- Channels kept distinct:
  1. **Web Push** (VAPID) for browsers + installed PWA. Subscription CRUD is
     authenticated + user-scoped; endpoints treated as secrets; stale (410)
     subscriptions pruned; lock-screen privacy toggle (title-only mode);
     quiet hours; per-user reminder offsets + sound.
  2. **iOS local notifications** (Phase 7E): scheduled on-device from the
     cached day; reconciled on each foreground sync.
  3. **APNs remote**: only if server-driven native delivery becomes necessary;
     out of current scope, revisit in Phase 8.
- iOS PWA push requires installed Home-Screen app + user-gesture permission
  (WebKit requirements); Phase 3B verification matrix includes a physical
  iPhone installed-PWA test.
