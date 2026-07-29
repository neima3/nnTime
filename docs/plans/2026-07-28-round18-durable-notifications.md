# Round 18 Durable Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Kairo's duplicate-prone placeholder notification events with
durable, idempotent Postgres jobs, honest delivery state, and scheduler-lag
health.

**Architecture:** A dedicated `notification_jobs` table owns computed work and
an append-only `scheduler_runs` table owns operational evidence. Pure policy and
payload modules keep recurrence/fire-time and privacy-copy behavior testable;
Postgres services own compute, atomic claim, retry, and run transitions. The
existing authenticated Coolify cron remains the trigger, but now returns
success only after every scheduler stage completes.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Drizzle ORM, PostgreSQL 17,
Vitest, web-push, Swift/OpenAPI contract gates, Coolify.

**Binding design:**
`docs/plans/2026-07-28-round18-durable-notifications-design.md`

---

## File map

- `drizzle/0009_durable_notification_jobs.sql` — forward-only production
  tables, enums, constraints, and indexes.
- `src/server/db/schema.ts` — Drizzle representation and exported job/run
  types.
- `src/server/services/notification-policy.ts` — pure preference, fire-time,
  expiry, retry, and payload rules.
- `src/server/services/notification-policy.test.ts` — deterministic pure rule
  coverage.
- `src/server/services/notifications.ts` — recurrence-aware desired-job
  computation, upsert, and cancellation.
- `src/server/services/notifications.integration.test.ts` — ephemeral
  Postgres dedup, recurrence, cancellation, and concurrency proof.
- `src/server/services/push.ts` — structured per-user Web Push outcomes; no job
  lookup or silent failure.
- `src/server/services/push.test.ts` — mocked Web Push outcome classification.
- `src/server/services/notification-delivery.ts` — atomic claim and durable
  delivery state transitions.
- `src/server/services/notification-delivery.integration.test.ts` — ephemeral
  Postgres exactly-once claim, retry, expiry, and suppression proof.
- `src/server/services/scheduler-runs.ts` — start/succeed/fail/retention helpers
  and health snapshot.
- `src/server/services/scheduler-runs.integration.test.ts` — run ledger and lag
  proof.
- `src/app/api/v1/jobs/tick/route.ts` and `.test.ts` — fail-closed orchestration.
- `src/app/api/health/route.ts` and `.test.ts` — real scheduler state and lag.
- `src/server/db/migrations.test.ts` and
  `src/server/db/schema-invariants.test.ts` — schema contract updates.
- `docs/plans/2026-07-12-kairo-roadmap.md`,
  `docs/plans/parity-checklist.md`, and `docs/plans/progress.md` — truthful
  completion evidence.
- `docs/plans/2026-07-28-round18-durable-notifications-prompt.md` — immutable
  executor handoff.

### Task 1: Durable job and run schema

**Files:**

- Create: `drizzle/0009_durable_notification_jobs.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/migrations.test.ts`
- Modify: `src/server/db/schema-invariants.test.ts`

- [x] **Step 1: Write the failing migration assertions**

Add `notification_jobs` and `scheduler_runs` to the expected table list, add
the four new enum names to the enum list, and add tests that query
`pg_indexes`/`information_schema` for:

```ts
expect(indexNames).toContain("notification_jobs_dedup_idx");
expect(indexNames).toContain("notification_jobs_due_idx");
expect(indexNames).toContain("notification_jobs_user_entity_idx");

await db.insert(notificationJobs).values(job);
await expect(
  db.insert(notificationJobs).values({ ...job, id: uuidv7() }),
).rejects.toThrow();
```

Add a cascade test that inserts a user, job, and run; deleting the user must
remove the job while the operational run remains.

- [x] **Step 2: Run the schema tests to prove RED**

Run:

```bash
pnpm vitest run src/server/db/migrations.test.ts src/server/db/schema-invariants.test.ts
```

Expected: failures naming the missing tables/enums/exports.

- [x] **Step 3: Add the exact Drizzle enums and tables**

Define:

```ts
export const notificationJobType = pgEnum("notification_job_type", [
  "start",
  "halfway",
  "wrap-up",
  "review-today",
  "weekly-review",
]);
export const notificationJobState = pgEnum("notification_job_state", [
  "pending",
  "processing",
  "retry",
  "sent",
  "suppressed",
  "expired",
  "cancelled",
]);
export const notificationEntityType = pgEnum("notification_entity_type", [
  "activity",
  "review",
]);
export const schedulerRunState = pgEnum("scheduler_run_state", [
  "running",
  "succeeded",
  "failed",
]);
```

Define `notificationJobs` with the design's exact columns. Use:

```ts
uniqueIndex("notification_jobs_dedup_idx").on(t.dedupKey),
index("notification_jobs_due_idx").on(t.state, t.nextAttemptAt, t.fireAt),
index("notification_jobs_user_entity_idx").on(
  t.userId,
  t.entityType,
  t.entityId,
  t.occurrenceKey,
),
```

Define `schedulerRuns` without `user_id`, because it is aggregate operational
state. Export `DbNotificationJob` and `DbSchedulerRun`. Add only
`notification_jobs` to `userOwnedTables`.

- [x] **Step 4: Add the forward SQL migration**

Create the matching four enums, two tables, FK, checks, and indexes. Include:

```sql
CONSTRAINT "notification_jobs_entity_check"
CHECK (
  ("entity_type" = 'activity' AND "entity_id" IS NOT NULL AND "occurrence_key" IS NOT NULL)
  OR
  ("entity_type" = 'review' AND "entity_id" IS NULL AND "occurrence_key" IS NULL)
)
```

Use statement breakpoints between independently applied statements. Do not
update or delete `planner_events`.

- [x] **Step 5: Run the schema tests to GREEN**

Run the focused command from Step 2. Expected: all tests pass with a local
Postgres; migration failures must fail rather than skip.

- [x] **Step 6: Commit the schema slice**

```bash
git add drizzle/0009_durable_notification_jobs.sql src/server/db/schema.ts \
  src/server/db/migrations.test.ts src/server/db/schema-invariants.test.ts
git commit -m "feat: add durable notification job schema"
```

### Task 2: Pure notification policy

**Files:**

- Create: `src/server/services/notification-policy.ts`
- Create: `src/server/services/notification-policy.test.ts`

- [x] **Step 1: Write failing table-driven policy tests**

Cover explicit-false preference behavior, quiet hours, effective occurrence
start/duration, short activities, all five payloads, expiry, and retry. The
expected retry sequence is 1, 5, 15, and 30 minutes, capped at 30:

```ts
expect(retryDelayMs(1)).toBe(60_000);
expect(retryDelayMs(2)).toBe(300_000);
expect(retryDelayMs(3)).toBe(900_000);
expect(retryDelayMs(9)).toBe(1_800_000);
```

The 8-minute activity expectation is start + halfway only; wrap-up is omitted
because five minutes before end is not meaningfully after its start.

- [x] **Step 2: Run RED**

```bash
pnpm vitest run src/server/services/notification-policy.test.ts
```

Expected: import failure for the missing policy module.

- [x] **Step 3: Implement typed pure policy**

Export:

```ts
export type NotificationType =
  | "start" | "halfway" | "wrap-up"
  | "review-today" | "weekly-review";

export interface CandidateFire {
  type: NotificationType;
  fireAt: Date;
  expiresAt: Date;
}

export function activityFireTimes(
  startAt: Date,
  durationMin: number,
): CandidateFire[];
export function notificationTypeEnabled(
  prefs: unknown,
  type: NotificationType,
): boolean;
export function retryDelayMs(attempt: number): number;
export function buildPushPayload(
  type: NotificationType,
  input: { title?: string; emoji?: string; entityId?: string },
): PushPayload;
```

Start expires after 30 minutes; halfway/wrap-up after 45 minutes; review jobs
after 4 hours. Payload bodies must not include notes, checklist text, user
names, or timestamps. Map keys exactly:

```ts
const PREF_KEY = {
  start: "startNudges",
  halfway: "halfwayNudges",
  "wrap-up": "wrapUpNudges",
  "review-today": "reviewTodayNudges",
  "weekly-review": "weeklyReviewNudges",
} as const;
```

- [x] **Step 4: Run GREEN**

Run the focused command from Step 2. Expected: all policy cases pass.

- [x] **Step 5: Commit the policy slice**

```bash
git add src/server/services/notification-policy.ts \
  src/server/services/notification-policy.test.ts
git commit -m "feat: define notification delivery policy"
```

### Task 3: Recurrence-aware job computation

**Files:**

- Rewrite: `src/server/services/notifications.ts`
- Create: `src/server/services/notifications.integration.test.ts`
- Modify: `src/server/services/notification-policy.ts`
- Modify: `src/server/services/notification-policy.test.ts`

- [x] **Step 1: Write failing integration fixtures**

Use `createEphemeralDb`, `insertUser`, fixed UUIDs, fixed `now`, and settings
rows. Prove:

1. two consecutive computes create one set of jobs;
2. a daily recurring series creates jobs for each occurrence in the 24-hour
   horizon;
3. an occurrence override moves fire times but retains the stable occurrence
   key in dedup;
4. completed/skipped/cancelled overrides create no pending jobs;
5. soft delete and explicit-false preferences cancel only future
   pending/retry jobs;
6. two concurrent computes produce no duplicates;
7. Review Today and weekly review use the planning timezone and `weekStart`.

Assert database rows and states, not only returned counters.

- [x] **Step 2: Run RED**

```bash
pnpm vitest run src/server/services/notifications.integration.test.ts
```

Expected: old code writes `planner_events`, lacks deterministic `now`, and
cannot satisfy any job-table assertion.

- [x] **Step 3: Add deterministic desired-job builders**

Extend the policy module with:

```ts
export interface DesiredNotificationJob {
  userId: string;
  entityType: "activity" | "review";
  entityId: string | null;
  occurrenceKey: Date | null;
  type: NotificationType;
  fireAt: Date;
  expiresAt: Date;
  dedupKey: string;
  payload: Record<string, unknown>;
}

export function activityDedupKey(input: {
  userId: string;
  seriesId: string;
  occurrenceKey: Date;
  type: NotificationType;
  fireAt: Date;
}): string;
```

Use ISO timestamps in UTC. Add focused unit expectations for stable key output.

- [x] **Step 4: Implement compute/upsert/cancel**

Use the signature:

```ts
export async function computeNotificationJobs(opts: {
  db?: Db;
  now?: Date;
  horizonHours?: number;
} = {}): Promise<{
  desired: number;
  created: number;
  cancelled: number;
  lockAcquired: boolean;
}>;
```

Inside one transaction:

- acquire advisory lock `8947232`;
- select live settings, series whose recurrence could intersect the horizon,
  and live occurrence overrides;
- reuse `expandActivitiesForDay`-compatible recurrence logic without calling an
  authenticated service;
- generate activity and review desired rows;
- insert with `onConflictDoNothing({ target: notificationJobs.dedupKey })`;
- cancel pending/retry rows in the same recompute window whose dedup keys are
  absent from the desired set.

Use one SQL anti-membership update for cancellation; if the desired list is
empty, cancel all eligible rows in the bounded window. Never catch general
insert errors as duplicates.

- [x] **Step 5: Run focused unit and integration GREEN**

```bash
pnpm vitest run src/server/services/notification-policy.test.ts \
  src/server/services/notifications.integration.test.ts
```

Expected: deterministic passing results including the concurrent double-run.

- [x] **Step 6: Prove planner history is untouched**

Add an assertion that the compute tests leave
`SELECT count(*) FROM planner_events` at zero. Run the focused suite again.

- [x] **Step 7: Commit the compute slice**

```bash
git add src/server/services/notification-policy.ts \
  src/server/services/notification-policy.test.ts \
  src/server/services/notifications.ts \
  src/server/services/notifications.integration.test.ts
git commit -m "feat: compute idempotent notification jobs"
```

### Task 4: Structured Web Push outcomes

**Files:**

- Modify: `src/server/services/push.ts`
- Create: `src/server/services/push.test.ts`

- [x] **Step 1: Write failing Web Push classification tests**

Mock `webpush.sendNotification` and a minimal database. Assert:

```ts
expect(result).toEqual({
  subscriptions: 3,
  sent: 1,
  pruned: 1,
  retryableFailures: 1,
});
```

Cover 201 success, 404/410 tombstone, 429, 500, thrown network errors, no
subscriptions, and unconfigured VAPID. Verify endpoint values never appear in
logged or returned errors.

- [x] **Step 2: Run RED**

```bash
pnpm vitest run src/server/services/push.test.ts
```

Expected: the old `{ sent, pruned }` result cannot report retryable failures.

- [x] **Step 3: Narrow `push.ts` to transport responsibility**

Export:

```ts
export interface PushDeliveryResult {
  configured: boolean;
  subscriptions: number;
  sent: number;
  pruned: number;
  retryableFailures: number;
}

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  opts: {
    db?: Db;
    sendNotification?: typeof webpush.sendNotification;
  } = {},
): Promise<PushDeliveryResult>;
```

Remove `deliverDueNudges` and `markSent`. Treat 404/410 as prune; every other
failure increments `retryableFailures`. An unconfigured sender returns
`configured: false` without querying subscriptions.

- [x] **Step 4: Run GREEN**

Run the focused command from Step 2. Expected: all outcome cases pass.

- [x] **Step 5: Commit the transport slice**

```bash
git add src/server/services/push.ts src/server/services/push.test.ts
git commit -m "fix: surface web push delivery outcomes"
```

### Task 5: Atomic claims and durable delivery transitions

**Files:**

- Create: `src/server/services/notification-delivery.ts`
- Create: `src/server/services/notification-delivery.integration.test.ts`

- [x] **Step 1: Write failing state-machine integration tests**

Seed jobs and subscriptions in ephemeral Postgres. Inject a deterministic
`sendToUser` function. Cover:

- two concurrent delivery calls claim one row once;
- a claim older than five minutes is reclaimed;
- success becomes `sent`;
- disabled type, quiet hours, missing/deleted activity, unconfigured VAPID,
  and no subscriptions become `suppressed` with sanitized reason codes;
- retryable transport failure becomes `retry`, increments attempts, and sets
  the policy backoff;
- an expired or fifth-failed job becomes `expired`;
- all five types reach their expected payload builder;
- each claimed job exits `processing`.

- [x] **Step 2: Run RED**

```bash
pnpm vitest run src/server/services/notification-delivery.integration.test.ts
```

Expected: module import failure.

- [x] **Step 3: Implement one-statement atomic claim**

Use:

```ts
const claimed = await db.execute(sql`
  WITH due AS (
    SELECT id
    FROM notification_jobs
    WHERE (
      state IN ('pending', 'retry')
      AND next_attempt_at <= ${now}
      AND fire_at <= ${now}
    ) OR (
      state = 'processing'
      AND claimed_at <= ${staleBefore}
    )
    ORDER BY fire_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT ${limit}
  )
  UPDATE notification_jobs AS jobs
  SET state = 'processing', claimed_at = ${now}, updated_at = ${now}
  FROM due
  WHERE jobs.id = due.id
  RETURNING jobs.*
`);
```

Normalize the postgres-js/Drizzle result shape in one tested helper.

- [x] **Step 4: Implement transitions**

Export:

```ts
export async function deliverDueNotificationJobs(opts: {
  db?: Db;
  now?: Date;
  limit?: number;
  send?: typeof sendToUser;
} = {}): Promise<{
  considered: number;
  delivered: number;
  suppressed: number;
  retried: number;
  expired: number;
  pruned: number;
}>;
```

Load each job's settings and activity with user-scoped predicates. Use reason
codes only (`preference-disabled`, `quiet-hours`, `source-missing`,
`push-unconfigured`, `no-subscriptions`, `retry-exhausted`) in `last_error`.
Clear `claimed_at` for every terminal/retry transition.

- [x] **Step 5: Run GREEN and inspect final rows**

Run the focused command from Step 2. Expected: every state-machine test passes
and no row remains `processing`.

- [x] **Step 6: Commit the delivery slice**

```bash
git add src/server/services/notification-delivery.ts \
  src/server/services/notification-delivery.integration.test.ts
git commit -m "feat: deliver notification jobs with durable retries"
```

### Task 6: Scheduler run ledger and fail-closed tick

**Files:**

- Create: `src/server/services/scheduler-runs.ts`
- Create: `src/server/services/scheduler-runs.integration.test.ts`
- Modify: `src/app/api/v1/jobs/tick/route.ts`
- Create: `src/app/api/v1/jobs/tick/route.test.ts`

- [x] **Step 1: Write failing scheduler-run integration tests**

Prove start, success, failure, sanitized error truncation, and deletion of runs
older than 30 days. Assert a failed run remains queryable and a success records
the exact aggregate counts passed to it.

- [x] **Step 2: Implement run helpers**

Export:

```ts
export async function startSchedulerRun(db: Db, now: Date): Promise<string>;
export async function succeedSchedulerRun(
  db: Db,
  id: string,
  now: Date,
  summary: Record<string, unknown>,
): Promise<void>;
export async function failSchedulerRun(
  db: Db,
  id: string,
  now: Date,
  error: unknown,
): Promise<void>;
export async function pruneSchedulerRuns(
  db: Db,
  now: Date,
  retentionDays?: number,
): Promise<number>;
```

Sanitize errors to one line and 500 characters. Run the integration suite to
GREEN.

- [x] **Step 3: Write failing route orchestration tests**

Mock materialization, compute, delivery, and run helpers. Assert:

- invalid cron secret returns 401 and calls nothing;
- missing production secret returns 503;
- full success calls stages in order and returns 200 with aggregate summary;
- an error in any stage records a failed run and returns 500 `{ ok: false }`;
- no nested catch converts scheduler failure to HTTP 200.

- [x] **Step 4: Run route RED**

```bash
pnpm vitest run src/app/api/v1/jobs/tick/route.test.ts
```

Expected: the existing route swallows notification and delivery errors.

- [x] **Step 5: Rewrite the route around one failure boundary**

Create the run only after cron authorization. Use one injected/default database
for run helpers. On success, record summary then prune old runs. On any thrown
stage, record failure and return 500. Do not return stack traces or raw push
errors.

- [x] **Step 6: Run scheduler and route GREEN**

```bash
pnpm vitest run src/server/services/scheduler-runs.integration.test.ts \
  src/app/api/v1/jobs/tick/route.test.ts
```

- [x] **Step 7: Commit the scheduler slice**

```bash
git add src/server/services/scheduler-runs.ts \
  src/server/services/scheduler-runs.integration.test.ts \
  src/app/api/v1/jobs/tick/route.ts \
  src/app/api/v1/jobs/tick/route.test.ts
git commit -m "feat: record fail-closed scheduler runs"
```

### Task 7: Truthful scheduler health

**Files:**

- Modify: `src/server/services/scheduler-runs.ts`
- Modify: `src/server/services/scheduler-runs.integration.test.ts`
- Modify: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

- [x] **Step 1: Write failing snapshot tests**

Use fixed `now` values to prove:

```ts
type SchedulerHealth =
  | { state: "unconfigured"; lagSeconds: null }
  | { state: "warming"; lagSeconds: null }
  | { state: "ok"; lagSeconds: number }
  | { state: "lagging"; lagSeconds: number | null }
  | { state: "failed"; lagSeconds: number | null };
```

Cases: no secret in development, no run within five-minute process grace,
recent success, success older than five minutes, latest failure newer than
success, and later success recovering from failure.

- [x] **Step 2: Implement `getSchedulerHealth`**

Query only the newest completed run and newest success. Accept `{ db, now,
configured, processStartedAt, maxLagMs }` so tests do not use wall-clock or
module-load timing.

- [x] **Step 3: Write failing health-route tests**

Mock migrations, DB connectivity, and scheduler health. Assert aggregate
response:

```json
{
  "status": "degraded",
  "checks": {
    "migrate": "ok",
    "db": "ok",
    "ai": "unconfigured",
    "scheduler": "lagging"
  },
  "schedulerLagSeconds": 601
}
```

`lagging`/`failed` must return 503; `unconfigured` is allowed only outside
production; `warming` returns 200 during grace.

- [x] **Step 4: Implement route health mapping**

Keep existing migration/DB/AI semantics. Add scheduler state and optional lag
without exposing run summary or errors.

- [x] **Step 5: Run GREEN**

```bash
pnpm vitest run src/server/services/scheduler-runs.integration.test.ts \
  src/app/api/health/route.test.ts
```

- [x] **Step 6: Commit the health slice**

```bash
git add src/server/services/scheduler-runs.ts \
  src/server/services/scheduler-runs.integration.test.ts \
  src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "feat: report scheduler lag in health"
```

### Task 8: Contract, regression, and executor evidence

**Files:**

- Modify: `src/server/db/migrations.test.ts`
- Modify: `src/server/db/schema-invariants.test.ts`
- Create: `src/server/services/notification-regression.test.ts`
- Verify: `docs/plans/2026-07-28-round18-durable-notifications-prompt.md`

- [x] **Step 1: Add static regression assertions**

Read scheduler sources as text and require:

- `notifications.ts` never references `plannerEvents`;
- `push.ts` exports no `deliverDueNudges`;
- tick route contains no nested notification/delivery catch;
- every notification enum value appears in policy payload tests;
- migration contains no `DELETE`, `TRUNCATE`, or `UPDATE planner_events`.

- [x] **Step 2: Add runtime history/sync isolation assertion**

In the compute integration test, create/deliver/cancel jobs and assert
`planner_events` and `change_log` counts do not change.

- [x] **Step 3: Run all scheduler-focused suites**

```bash
pnpm vitest run \
  src/server/db/migrations.test.ts \
  src/server/db/schema-invariants.test.ts \
  src/server/services/notification-policy.test.ts \
  src/server/services/notifications.integration.test.ts \
  src/server/services/push.test.ts \
  src/server/services/notification-delivery.integration.test.ts \
  src/server/services/scheduler-runs.integration.test.ts \
  src/server/services/notification-regression.test.ts \
  src/app/api/v1/jobs/tick/route.test.ts \
  src/app/api/health/route.test.ts
```

Expected: all pass with real PostgreSQL integration.

- [x] **Step 4: Verify the immutable executor prompt**

Confirm the committed prompt names the AGENTS guide, ADR-004, design, this
plan, TDD, production backup, no production planner mutation, exact-SHA
CI/deploy, and read-only live proof.

- [x] **Step 5: Commit the regression slice**

```bash
git add src/server/db/migrations.test.ts \
  src/server/db/schema-invariants.test.ts \
  src/server/services/notification-regression.test.ts \
  src/server/services/notifications.integration.test.ts \
  docs/plans/2026-07-28-round18-durable-notifications-prompt.md
git commit -m "test: lock durable notification contract"
```

### Task 9: Full verification, review, handoff, and production rollout

**Files:**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-07-28-round18-durable-notifications.md`

- [x] **Step 1: Run full web and contract gates**

```bash
pnpm lint &&
pnpm typecheck &&
pnpm test &&
pnpm build &&
pnpm api:check-ios &&
node scripts/parity.mjs
```

Record exact test counts and parity output. Correct D10/G07 evidence only if
the implementation proves the stated user-visible behavior; do not change the
score merely for infrastructure.

- [x] **Step 2: Run native gates**

```bash
swift build --package-path ios/Kairo
swift test --package-path ios/Kairo
pnpm ios:generate
pnpm ios:contract
pnpm ios:main-thread
```

Use the repository's actual script names from `package.json`; if a listed
alias differs, record the exact equivalent command and result in progress.
Scan native output for Main Thread Checker diagnostics.

- [x] **Step 3: Run production-mode synthetic browser QA**

Start the production build with a synthetic local Postgres and local cron
secret. In a muted real browser at desktop and 390px mobile:

- sign in to the synthetic account;
- confirm Settings notification controls still render and persist;
- call one synthetic tick and inspect its 200 summary;
- call health and verify recent scheduler status/lag;
- force a failed synthetic tick and verify 500 plus degraded health;
- restore success and verify health recovery;
- capture screenshot, response, console, and failed-network evidence under
  `browser-qa/round18-durable-notifications/`.

Keep all captures git-ignored.

- [x] **Step 4: Run adversarial code review**

Use `superpowers:requesting-code-review`, address every verified finding with
`superpowers:receiving-code-review`, rerun focused and full gates, and record
the disposition in `docs/plans/progress.md`.

- [x] **Step 5: Update truthful handoff docs**

Add Round 18 hardening to the roadmap, correct notification parity evidence,
append exact verification and remaining ranked gaps to progress, and check
every completed task in this plan. The remaining order is:

1. shipping native session/offline integrity;
2. native widget/App Group auth and conditional mutation;
3. web email verification/revoke-all;
4. Next.js/action/dependency remediation;
5. migration-runner per-file transaction hardening;
6. calendar subscription reconciliation.

- [x] **Step 6: Run final precommit verification and commit**

Run the full commands from Steps 1–2 again after docs. Confirm `git diff
--check` and a clean intended diff. Commit the immutable Round 18 handoff.

- [x] **Step 7: Create the predeploy database backup**

Follow `docs/DEPLOYMENT.md` exactly. Store the backup outside the repository,
verify it is non-empty and readable with `pg_restore --list` or the matching
format command, and record only path/size/checksum—never credentials or planner
contents. This must precede the push because production auto-deploy is enabled.

- [x] **Step 8: Integrate and push**

Use `superpowers:finishing-a-development-branch`. Integrate into `main`
without discarding unrelated user changes, push `main`, and verify the exact
remote SHA.

- [x] **Step 9: Wait for exact-SHA CI**

Require every GitHub Actions job for the pushed SHA to pass. A passing earlier
SHA is not release evidence.

- [x] **Step 10: Deploy and verify exact live SHA**

Trigger the documented Coolify deployment. Wait for the deployment to report
the exact source SHA, `finished`, and `running:healthy`. Verify read-only:

- `/api/health` returns 200 with migrations/database/scheduler healthy and a
  recent scheduler lag;
- deployed revision equals the pushed SHA;
- security headers remain present;
- the signed-out landing and product auth boundary render at desktop/mobile;
- no production mutation endpoint is called.

If the first health check is `warming`, wait through the next authenticated
cron interval and require recovery to `ok`; do not relabel warming or lagging
as deployed success.

## Definition of done

- Duplicate notification computation is prevented by a database unique key.
- Recurring occurrences and all five ADR-004 types generate durable jobs.
- Delivery uses atomic claims and durable sent/suppressed/retry/expired states.
- Push failures are classified rather than swallowed.
- Cron stage failures return HTTP 500 and remain observable.
- Health reflects actual successful scheduler activity and lag.
- Existing planner history is untouched by migration and no longer used for
  jobs.
- Focused, full web, contract, native, synthetic-browser, review, CI, backup,
  exact-SHA deploy, and read-only live gates are all evidenced.
