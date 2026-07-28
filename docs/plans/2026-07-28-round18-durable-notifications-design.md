# Round 18 Durable Notifications and Scheduler Health — Design

**Status:** Accepted for autonomous execution under the standing production-
readiness goal.
**Owner:** Codex
**Date:** 2026-07-28

## Problem

Kairo's production cron calls `/api/v1/jobs/tick` every minute, but the current
notification implementation is only a placeholder behind production-looking
names:

- each tick inserts new random `planner_events` rows for the same future
  activity because the documented dedup key exists only inside JSON and has no
  unique constraint;
- recurring series are not expanded, occurrence overrides are ignored, and
  review jobs are never created;
- only `start` jobs are delivered; halfway, wrap-up, Review Today, and weekly
  review jobs remain inert;
- a job is marked sent even when zero subscriptions received it or the push
  service returned a retryable failure;
- delivery failures are swallowed and the cron route still reports
  `{ ok: true }`;
- `/api/health` calls the scheduler healthy when `CRON_SECRET` merely exists,
  without proving a successful tick or reporting lag;
- computed notification work is stored in append-only planner history using a
  fake `carryover` event, violating the separation between durable jobs and
  user action history in ADR-004.

This creates an active production risk: every minute can grow duplicate rows
while health and cron responses continue to look successful.

## Options considered

1. **Add a unique expression index to `planner_events`.** This would stop the
   duplicate flood quickly, but would preserve the wrong data model, provide no
   claim/retry state, keep notification work mixed into user history, and leave
   four notification types undeliverable.
2. **Dedicated Postgres notification jobs and scheduler runs — selected.**
   This implements ADR-004 directly with durable state, deterministic dedup,
   atomic claiming, bounded retry/backoff, cancellation, and observable runs.
   It adds no infrastructure beyond the existing production Postgres and
   minute cron.
3. **Adopt Redis or an external queue service.** A separate queue could work,
   but it adds deployment, backup, monitoring, and failure modes that Kairo
   does not otherwise need. ADR-004 already selects Postgres rows guarded by an
   advisory lock.

## Data model

### `notification_jobs`

One row represents one computed delivery attempt for one user-visible reminder.

- `id` UUID primary key;
- `user_id` owner with cascade deletion;
- `entity_type`: `activity` or `review`;
- `entity_id`: activity series ID for activity jobs, null for review jobs;
- `occurrence_key`: stable activity occurrence identity, null for review jobs;
- `type`: `start`, `halfway`, `wrap-up`, `review-today`, or `weekly-review`;
- `fire_at` and `expires_at` timestamps;
- `dedup_key` text with a database unique index;
- `state`: `pending`, `processing`, `retry`, `sent`, `suppressed`,
  `expired`, or `cancelled`;
- `attempts`, `next_attempt_at`, `last_error`, `claimed_at`, `claim_token`,
  `delivered_at`, `created_at`, and `updated_at`;
- a small JSON payload containing only delivery copy metadata needed after the
  source entity changes.

The canonical activity dedup key is:

`userId:activity:seriesId:occurrenceKey:type:fireAt`

Review keys use the user's planning-zone date or week start instead of an
entity ID. The database unique index, not application exception handling, is
the final duplicate barrier.

Due-work and user/entity indexes support bounded scheduling, cancellation, and
claim scans. Jobs are operational data, not sync entities: they do not enter
`change_log`, planner export, stats, or native incremental sync.

### `scheduler_runs`

Each authenticated cron invocation writes one bounded observability row:

- `id`, `started_at`, `finished_at`;
- `state`: `running`, `succeeded`, or `failed`;
- JSON summary counts;
- sanitized `last_error`.

Runs older than 30 days are pruned after a successful tick. This is operational
retention, not user planner history.

## Scheduling contract

One tick performs the following sequence:

1. create a `running` scheduler-run row;
2. run routine materialization;
3. under the existing notification advisory lock, compute desired jobs for the
   next 24 hours;
4. insert desired jobs with `ON CONFLICT (dedup_key) DO NOTHING`;
5. cancel still-pending/retry jobs within the recompute horizon that no longer
   match a live activity occurrence or an enabled preference;
6. atomically claim a bounded due batch;
7. deliver or transition every claimed job;
8. finish the run as `succeeded`, or mark it `failed` and return HTTP 500 if a
   scheduler stage throws.

Activity scheduling expands recurrence in the series timezone using the same
temporal engine as day resolution. It overlays materialized occurrence changes,
does not schedule cancelled/skipped/completed occurrences, and uses the stable
occurrence key even when an override moves the displayed start time.

Default fire times are:

- start: occurrence start;
- halfway: start plus half the effective duration;
- wrap-up: five minutes before the effective end, omitted when that would not
  be later than the start;
- Review Today: 20:00 in the user's planning zone;
- weekly review: 18:00 on the user's configured week-ending day.

The current `startNudges: false` preference disables start jobs. New flat
preferences `halfwayNudges`, `wrapUpNudges`, `reviewTodayNudges`, and
`weeklyReviewNudges` follow the same explicit-false rule, preserving the
existing default-on behavior. Settings exposes all five controls, per-activity
timing offsets, lock-screen title privacy, and a sound preference without
changing the established visual language. Quiet hours are checked at delivery
so a setting change takes effect immediately. The free-form settings JSON
remains backward compatible.

Review jobs are created only for users with settings rows. This prevents a
background scan from inventing planner state for dormant auth records.

## Claim and delivery state machine

Claiming uses one SQL update over a `FOR UPDATE SKIP LOCKED` selection so two
workers cannot own the same job. Every ownership change gets a UUID fencing
token; transitions compare-and-set both state and token, and the owner renews
the lease immediately before and once per minute throughout external delivery.
A stale `processing` claim becomes eligible again after five minutes.

Each claimed job reaches exactly one transition:

- `sent`: at least one live subscription accepted the payload;
- `suppressed`: its preference is disabled, it falls in quiet hours, the source
  activity is no longer valid, push is unconfigured, or no live subscriptions
  exist;
- `retry`: at least one subscription failed transiently and no delivery
  succeeded; `attempts` increments and `next_attempt_at` uses bounded
  exponential backoff;
- `expired`: the retry window or expiry passed;
- `cancelled`: recomputation proved the future job is no longer desired.

Push sending returns structured counts for sent, pruned, and retryable failures.
HTTP 404/410 subscriptions are tombstoned. Other errors are never swallowed.
Provider requests have a 30-second socket timeout, a four-request concurrency
pool, and a ten-live-subscription ceiling per account so one user cannot exhaust
the scheduler's sockets or memory.
A successful delivery to any live subscription is sufficient to mark the job
sent; failures on sibling subscriptions are reported in the run summary.

Payloads use calm, privacy-minimal copy and route to the relevant Kairo surface.
The job table never stores push endpoints or arbitrary activity notes.
Account preferences can hide activity names from lock-screen copy and shift
start, halfway, and wrap-up reminders by bounded per-type minute offsets. The
same preference parser is used during compute and delivery revalidation.
The sound preference maps to the Web Notification `silent` option at current
delivery time rather than trusting stale payload JSON.
Expiry, quiet-hours, delivery timestamps, and retry backoff use a fresh clock
reading for each claimed job rather than the batch-start timestamp.

## Failure and health semantics

The cron endpoint remains bearer-secret protected and `no-store`, but success
now means the entire tick completed. A failed stage returns HTTP 500 with
`ok: false` and a sanitized error while preserving the failed scheduler-run
record. Individual transient push outcomes remain successful scheduler work
because they are durably moved to `retry`.

`/api/health` reports:

- scheduler `unconfigured` outside production when no cron secret exists;
- scheduler `warming` during a short first-deploy grace window with no run;
- scheduler `ok` plus lag seconds when the latest successful run is recent;
- scheduler `lagging` and overall degraded when no successful run exists after
  the grace period or the lag exceeds five minutes;
- scheduler `failed` and overall degraded when the latest completed run failed
  after the latest success.

Health returns aggregate state and lag only, never job payloads, user IDs, or
push endpoints.

## Migration and production safety

Migration `0009` creates the new tables, enums, and indexes without rewriting or
deleting planner rows. Existing placeholder `planner_events` notification rows
become inert because no scheduler or delivery code reads them after deployment.
They are intentionally not deleted in this round: production planner history is
real user data, and cleanup would be irreversible without separate approval.

Because this round adds tables, deployment requires the documented predeploy
database backup and exact-SHA migration/health proof. No production activity,
settings, subscription, or notification mutation is used as a smoke test.

## Test strategy

Strict red/green coverage proves:

- migration shape, dedup uniqueness, due index, and user cascade;
- recurrence expansion and occurrence override handling;
- consecutive and concurrent computes create one logical set of jobs;
- edits, skips, deletes, and preference changes cancel pending jobs;
- all five notification types produce deterministic keys and fire times;
- atomic claims prevent double delivery and stale claims recover;
- claims stay leased throughout in-flight delivery, while provider fan-out and
  live subscriptions remain bounded;
- success, no-subscription, quiet-hours, disabled, stale-subscription,
  transient-failure, retry, and expiry transitions;
- the tick route returns 500 and records failure when any scheduler stage
  fails;
- health reports warming, recent, lagging, and failed scheduler states without
  leaking operational details;
- notification rows never affect planner-event stats or sync.

Full lint, typecheck, Vitest, build, OpenAPI/native contract, Swift package/app,
and production-mode browser gates remain required. Browser verification is
read-only for production and uses synthetic local data for any job transitions.

## Completion boundary

Round 18 is complete when:

- production computation can no longer create duplicate notification jobs;
- all ADR-004 notification types have durable computed rows;
- delivery has atomic ownership and honest sent/suppressed/retry/expired state;
- cron failures fail closed and health reflects real scheduler runs and lag;
- the forward migration is backed up and applied safely;
- the exact committed SHA passes CI, deploys through Coolify, and is verified
  healthy with read-only live evidence.

Native session/offline integrity, native widget/App Group auth, web email
verification, dependency remediation, migration-runner hardening, and calendar
reconciliation remain explicitly ranked follow-on production tranches. They
are not redefined as complete by this scheduler round.
