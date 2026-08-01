# Round 53 — Atomic Inbox task conversion

> **Status (2026-08-01):** implementation and local release gates complete;
> exact-SHA CI, Coolify deployment, and read-only live verification pending.

> **Executor:** implement this plan test-first in the isolated
> `codex/round53-inbox-conversion` worktree. ADR-001/002/005 and the existing
> OpenAPI operation are binding; this round does not redesign the Inbox or
> activity editor.

## Goal

Make Inbox **Schedule** a real task-to-activity conversion: one idempotent REST
mutation creates the edited activity, tombstones the source task, transfers its
checklist, records the identity transition, and prevents duplicate scheduling.

## Evidence and root cause

Authenticated synthetic dogfood reproduced the defect twice. Inbox currently
pushes only `title`, `date`, and `start` into the generic activity editor. The
editor then calls `POST /api/v1/activities`, so the source task identity never
reaches the server and remains active after the activity is saved.

The repository contract already specifies
`POST /api/v1/tasks/{id}/schedule`, but no route handler or DAL conversion
exists. Fixing local Inbox state would hide the duplicate without satisfying
the task, change-log, history, ownership, or idempotency contracts.

Evidence is stored in the git-ignored
`browser-qa/round53-dogfood/` report, screenshots, and repro video.

## Design

### Server transaction

Add a DAL `scheduleTask` operation that accepts the authenticated owner, source
task ID, and final `ActivitySeriesCreateRequest`. In one transaction it will:

1. claim the active source task with a conditional owner-scoped update;
2. create exactly one activity series using a pre-generated series ID;
3. set `tasks.converted_to`, `deleted_at`, `updated_at`, and the next revision;
4. merge active task checklist items into the final series checklist without
   duplicating labels already edited into the request;
5. re-parent those checklist rows to the new series and append their change-log
   entries;
6. append the activity upsert and task delete change-log entries; and
7. append one `reschedule` planner event whose payload records both identities.

A missing, cross-user, deleted, or already-converted source is indistinguishable
from not-found at the DAL boundary. The route's idempotency wrapper replays a
completed same-key response; a different key cannot create a second activity.
Any failed insert rolls back every side effect.

### REST handler

Implement the already-specified `POST /api/v1/tasks/{id}/schedule` route with:

- `requireSession()` ownership;
- the canonical activity-series zod schema;
- the exact per-resource idempotency path;
- the database passed by `withIdempotency`; and
- `201` with the created series.

No `If-Match` is added because the committed OpenAPI operation deliberately
uses source identity plus idempotency. The atomic active-task claim is the
concurrency guard.

### Editor handoff

Inbox passes `taskId` as well as date/start. The server-rendered editor loads
the owner-scoped source task and pre-fills title, emoji, category, priority,
energy, notes, and active checklist labels. `ActivityEditor` receives a
`sourceTaskId`; only that create mode posts to the schedule endpoint. Ordinary
activity creation keeps the existing replay-safe offline queue.

Task conversion is online-only because it is a multi-resource mutation, not a
replay-safe create. Network, auth, validation, and conflict failures stay in
the editor with actionable copy; no optimistic task removal occurs.

## Test-first execution

1. Add an ephemeral-Postgres DAL integration test for atomic conversion,
   metadata/checklist transfer, owner scoping, change-log/history evidence,
   rollback, and duplicate prevention. Run it red before DAL code exists.
2. Add a route unit test that pins auth, schema parsing, path-scoped
   idempotency, locked-DB propagation, and the `201` response. Run it red before
   adding the handler.
3. Add focused component/page contract tests for the `taskId` handoff,
   owner-scoped prefill, schedule endpoint selection, and absence of the generic
   offline-create path during conversion. Run them red before UI changes.
4. Add a Playwright flow that captures an Inbox task, schedules and saves it,
   observes the activity on Today, and verifies the task is absent from Inbox.
5. Run focused tests, lint, typecheck, all web tests, production build, API/iOS
   contract checks, native release gates, parity, and desktop/mobile browser
   proof.
6. Request independent review, fix every Critical/Important issue, commit and
   push to `main`, wait for exact-SHA CI, deploy through Coolify, and verify the
   unique conversion behavior live without mutating the real production
   planner.

## Non-goals

- No redesign, new scheduling policy, or offline queue class.
- No schema migration; required columns and enums already exist.
- No production planner mutation during verification.
- No claim that Phase 7B or 8B external provider/device evidence is complete.
