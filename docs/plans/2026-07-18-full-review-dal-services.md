# Full review — DAL, services, temporal, offline sync

**Date:** 2026-07-18  
**Scope:** Schema, DAL, domain services, temporal/recurrence, offline queue  
**Mode:** Read-only code review (no code changes)  
**Contracts:** ADR-001, ADR-002, ADR-004, ADR-005 SEC-01

## Summary

The data layer has a solid **contract skeleton**: user-scoped queries in the DAL, soft-delete + revision columns, change_log hooks, DST-aware zone math with good unit tests, and focus partial-unique index for one active session. Production risk is concentrated in a few **correctness holes**: day views do not expand RRULEs; routine materialization cannot meet ADR-004 dedupe/`nextRunAt` semantics; focus pause accounting is inverted; optimistic concurrency is check-then-write without atomic `WHERE revision = ?`; `change_log` is best-effort outside the mutation transaction; migrations run fire-and-forget and can race first queries.

Overall: **usable for single-user dogfood of one-offs/tasks**, not yet safe for multi-device offline sync or recurring series as the primary planner surface.

---

## Issues

### 1. Day resolution never expands recurrence (critical)

- **File:** `src/server/services/day.ts:52–68`
- **Description:** `getResolvedDay` loads all series and filters only those whose **series `dtstartLocal`** falls on the target calendar date. It never calls `expandSeries`. A daily/weekly series therefore appears only on its start day (or not at all for later days). Occurrence overrides are keyed by `seriesId` only (`occurrenceStatusBySeries[occ.seriesId] = occ.status`), so multiple instances of the same series collapse to one status.
- **Suggestion:** For each non-deleted series, expand with `expandSeries` over `[bounds.start, bounds.end)`, merge materialized/overridden `activity_occurrences` by `(seriesId, occurrenceKey)`, and return **occurrence-level** rows (not series-level) with per-key status. Filter anytime tasks by date as today.
- **Status:** open

### 2. Routine materializer does not implement ADR-004 dedupe or advance (critical)

- **File:** `src/server/services/routine-materializer.ts:29–137`, `src/server/db/schema.ts:205–243`
- **Description:**
  1. Comments claim uniqueness on `(routine_schedule_id, occurrence_key)` / `onConflictDoNothing` on occurrences; code inserts **new `activity_series` rows** every tick with only a bare `try/catch`. There is **no unique index** on `(source, source_ref, dtstart_local)` (or equivalent). Double runs **duplicate** series.
  2. Expansion uses `to: horizon` (exclusive). Then `futureOccs = occurrences.filter(o => o.startAt > horizon)` is always empty, so **`nextRunAt` never advances** — schedules reprocess the same window forever (once fixed, still broken).
  3. `extractLocalFields` uses **UTC** components of `nextRunAt` as wall-clock in `sched.tz` — wrong for non-UTC zones.
  4. No lower bound on `nextRunAt` vs backfill window; `nextRunAt IS NULL` schedules never match `lte(nextRunAt, horizon)`.
  5. Materialized rows use hard-coded `durationMin: 30`; routine steps are ignored.
- **Suggestion:** Persist materialization as series+occurrence (or occurrence under a stable series) with unique `(source_ref, occurrence_key)` (schedule id + key). Expand past horizon solely to compute next run; write `nextRunAt` to first occurrence **after** last materialized. Derive wall fields via `instantToDateStr` / zone helpers in series `tz`. Sum step durations.
- **Status:** open

### 3. Focus pause accounting inverted; remaining time wrong while paused (critical)

- **File:** `src/server/services/focus.ts:116–121`, `180–192`
- **Description:** On `running → paused`, code adds the **running interval** into `accumulatedPauseSec` (comment says “pause time”). `getRemainingSec` always uses wall `now - startedAt - accumulatedPauseSec` and **does not freeze** when `state === "paused"`. After pause, remaining first jumps (running time treated as pause), then **continues to decay while paused** as `now` advances without adding more pause credit until resume.
- **Suggestion:** On pause: set `currentIntervalStartedAt = null` and **do not** add running time to pause. On resume: add `(now - pauseStarted)` — store pause start in `currentIntervalStartedAt` while paused, or keep a dedicated column. In `getRemainingSec`, if `state === "paused"`, treat elapsed as frozen at last pause instant.
- **Status:** open

### 4. Optimistic concurrency is TOCTOU, not conditional UPDATE (high)

- **File:** `src/server/dal/index.ts:119–128` (pattern repeated for tasks, tags, routines, settings, series delete, etc.); `src/server/services/focus.ts:130–134`
- **Description:** Flow is `SELECT` → compare `revision` in JS → `UPDATE … SET revision = n+1 WHERE id AND user_id` **without** `AND revision = ifMatch`. Two concurrent writers with the same If-Match can both succeed; last write wins silently and revisions skip the conflict path ADR-002 requires.
- **Suggestion:** Single statement: `UPDATE … SET revision = revision + 1, … WHERE id = ? AND user_id = ? AND revision = ? RETURNING *`; zero rows → re-fetch and `ConflictError`. Same for focus transitions.
- **Status:** open

### 5. `change_log` is non-transactional and failures are swallowed (high)

- **File:** `src/server/dal/index.ts:814–836`
- **Description:** Mutations write the entity, then separately `appendChangeLog`, which `try/catch`es and only `console.error`s. Crash/commit between write and log, or insert failure, leaves **sync clients permanently missing** that mutation until full resync (not implemented). ADR-002 treats the changes feed as the offline/sync spine.
- **Suggestion:** Append change_log **inside the same DB transaction** as the entity write; fail the mutation if log insert fails (or outbox pattern with a hard guarantee). Add integration tests that assert log row count == mutations.
- **Status:** open

### 6. Series split (`this_and_future`) does not copy master template fields (high)

- **File:** `src/server/services/recurrence.ts:172–221`
- **Description:** New series insert only sets `tz`, `dtstartLocal`, `rrule`, and `...patch`. Required NOT NULL columns (`title`, `durationMin`) and template fields (emoji, category, energy, checklist, tags, notes, source) are **not copied from the old series**. Partial patches (title-only) will fail or produce incomplete masters. Occurrence move update does not bump occurrence `revision` or write change_log rows for moved overrides. Truncate path does not append change_log for the old series revision bump.
- **Suggestion:** `INSERT … SELECT` / spread full series row then apply patch; move overrides with revision bump + change_log; log old series upsert after truncate. Keep entire split in one transaction (already partially done).
- **Status:** open

### 7. Scoped delete has authz / revision / sync gaps (high)

- **File:** `src/server/services/recurrence.ts:245–277`
- **Description:**
  - `scope === "this"`: calls `editThisOccurrence` **without** verifying series ownership or If-Match (parent `deleteSeriesOccurrence` does not load series for this branch).
  - `scope === "all"`: `UPDATE` by `seriesId` only — **no `userId` predicate**, no real revision check against loaded row, no change_log, no occurrence tombstones.
  - Soft-delete series in DAL (`deleteActivitySeries`) also does not tombstone child occurrences (hard FK cascade only on hard delete).
- **Suggestion:** Always load series with `userId`; enforce revision; scope `all` = soft-delete series + related pending occurrences + change_log; `this` = cancel override after ownership check.
- **Status:** open

### 8. Offline queue omits If-Match and has weak conflict replay (high)

- **File:** `src/lib/offline-queue.ts:54–167`
- **Description:** `QueuedMutation` has method/path/body/idempotencyKey but **no `If-Match` / expected revision**. `executeMutation` never sends concurrency headers used everywhere else in the app. Replays after concurrent edits will 428/409 or apply incorrectly. Terminal 4xx marks the op terminal but **continues** the queue (can apply dependent ops on stale state). Concurrent `flushQueue` (online event + enqueue) can interleave. Server **idempotency store** exists in schema but is not wired in route handlers (only batch passes the header through).
- **Suggestion:** Persist `ifMatch` (and optional base snapshot) per mutation; stop the queue on terminal conflict and surface rebase UI; single-flight flush mutex; implement server idempotency middleware with 48h TTL per ADR-002.
- **Status:** open

### 9. Migrations: fire-and-forget + partial apply risk (high)

- **File:** `src/server/db/index.ts:17–19`, `src/server/db/migrate-on-startup.ts:15–79`
- **Description:** `ensureMigrated()` is not awaited on module load; first requests can hit a half-migrated schema. On failure, catch sets `migratePromise = Promise.resolve()` so later imports believe migrations succeeded while tables may be missing. SQL files are applied statement-by-statement **outside a transaction**; “already exists” is ignored then the whole file is marked applied — dangerous for non-idempotent statements. Custom `__migrations` table diverges from drizzle-kit journal.
- **Suggestion:** Block readiness until migrate finishes (or fail health); wrap each migration file in a transaction; do not mark applied on partial failure; prefer official drizzle migrator in deploy; never swallow failed migrate as success.
- **Status:** open

### 10. Missing uniqueness / FK for materialization & refs (medium)

- **File:** `src/server/db/schema.ts:205–290`, `447–482`, `334–356`
- **Description:** No unique constraint for routine materialization identity. `categoryId` on series/tasks/routines is not an FK (orphans, cross-user category ids possible at write time if not validated). `focus_sessions.activity_occurrence_id` has no FK. `checklist_items` has parent index but **no `user_id` index** (privacy export / user purge scans). `routines` table has **no `user_id` index**. Occurrence unique index `(series_id, occurrence_key)` is not soft-delete-aware — tombstoned key blocks re-insert.
- **Suggestion:** Add FKs where ownership allows; partial unique indexes for active rows; index `checklist_items(user_id)` and `routines(user_id)`; document occurrence cancel vs delete semantics.
- **Status:** open

### 11. WEEKLY `COUNT` under-counts when expanding partial windows (medium)

- **File:** `src/server/temporal/recurrence.ts:220–277`
- **Description:** WEEKLY path `continue`s past occurrences before `from` **without** incrementing `emitted`. Expanding a mid-series window with `COUNT` will emit more instances than the rule allows. DAILY path increments `emitted` even for pre-window hits (closer to correct). RDATE path does not respect COUNT/UNTIL.
- **Suggestion:** Separate “series ordinal” counter from “emitted in window”; always advance ordinal from dtstart; only push when in window.
- **Status:** open

### 12. Focus start cancel+insert not one transaction; pause math untested (medium)

- **File:** `src/server/services/focus.ts:38–78`
- **Description:** Yield of prior active session and insert of new session are separate statements — concurrent starts can race the partial unique index and throw. No test covers pause duration / remaining freeze (tests only happy-path transitions and extend).
- **Suggestion:** Single transaction; on unique violation retry adopt; add timed fake-clock tests for pause/resume remaining.
- **Status:** open

### 13. Day service loads entire user timeline into memory (medium)

- **File:** `src/server/services/day.ts:52–57`, `src/server/dal/index.ts:280–294`
- **Description:** `listActivitySeries` + `listUserOccurrences` fetch **all** non-deleted rows for the user every day view. Scales poorly as history grows; no start/end predicate on occurrences despite index `occurrences_user_start_idx`.
- **Suggestion:** Query series with rrule OR dtstart in expanded lookback; occurrences with `start_at`/`occurrence_key` in day bounds ± overnight duration; paginate changes feed already OK.
- **Status:** open

### 14. Settings / categories race on first access (medium)

- **File:** `src/server/dal/index.ts:426–459`, `475–492`
- **Description:** `getOrCreateSettings` and `listCategories` seed on empty with insert after select — concurrent first requests can hit unique PK / partial unique index failures. Category seed does not write change_log (sync clients miss seeded categories).
- **Suggestion:** `INSERT … ON CONFLICT DO NOTHING RETURNING` / re-select; seed categories at signup in one transaction; optionally emit change_log for seeds.
- **Status:** open

### 15. `deleteSeriesOccurrence` / edit “this” bypasses revision for occurrence overrides (medium)

- **File:** `src/server/services/recurrence.ts:135–164`, `src/server/dal/index.ts:296–327`
- **Description:** Occurrence upserts use `onConflictDoUpdate` with `revision + 1` but **no If-Match** on the occurrence row. Concurrent complete/skip/edit on same instance last-write-wins without 409.
- **Suggestion:** Conditional update by occurrence revision; on insert-only path revision=1.
- **Status:** open

### 16. Stats streak uses UTC calendar dates, not planning zone (medium)

- **File:** `src/server/services/stats.ts:108–141`
- **Description:** Event bucketing correctly uses `instantToDateStr(…, zone)`, but `computeStreak` compares `today`/`yesterday` via `toISOString().slice(0, 10)` (UTC). Users west of UTC near midnight get wrong current streak. Grace-day logic uses `Date` parsing of `YYYY-MM-DD` (UTC midnight) which is OK for day diffs but “today” is wrong.
- **Suggestion:** Pass planning-zone “today” from settings; compute yesterday via zone day arithmetic.
- **Status:** open

### 17. Soft-delete series leaves orphan logical state; no hard-delete retention job (low)

- **File:** `src/server/dal/index.ts:231–251`, schema soft-delete columns
- **Description:** ADR-002 requires tombstones retained ≥30 days then hard deletion via account cascade / retention. No purge job. Series soft-delete leaves occurrences active (still listed by `listUserOccurrences` if not filtered by series deleted_at).
- **Suggestion:** Join series deleted_at when listing occurrences; scheduled purge after 30 days for tombstones.
- **Status:** open

### 18. UUIDv7 claimed, v4 issued; schema comment invents `createId()` (low)

- **File:** `src/server/db/schema.ts:11–14`; all `crypto.randomUUID()` call sites in DAL/services
- **Description:** Invariants/docs say UUIDv7 / `createId()`; implementation uses random UUID v4 everywhere. Not a security break (still non-enumerable), but contract drift for OpenAPI “UUIDv7” and time-sortable ids.
- **Suggestion:** Shared `createId()` implementing UUIDv7, use in DAL only.
- **Status:** open

### 19. Checklist DAL missing despite schema + zod (low)

- **File:** `src/server/db/schema.ts:334–356`, `src/server/schemas/checklist-item.ts`; no CRUD in `src/server/dal/index.ts`
- **Description:** Table and API schemas exist; privacy export reads checklist rows; no DAL create/update/delete with user scoping, revision, change_log. Live checklist-in-focus (ADR-004) cannot be backed correctly.
- **Suggestion:** Add full checklist DAL mirroring tasks pattern + parent ownership checks.
- **Status:** open

### 20. Migration “already exists” skip can mark incomplete migrations applied (nit / medium in prod)

- **File:** `src/server/db/migrate-on-startup.ts:58–73`
- **Description:** Any statement matching `/already exists|duplicate|conflict/i` is skipped. A failed mid-file migration that later re-runs may skip creates and still `INSERT INTO __migrations`, hiding missing later objects if those errors also matched loosely.
- **Suggestion:** Only ignore specific SQLSTATE codes for the exact object being created; otherwise abort file.
- **Status:** open

---

## Strengths

1. **Tenant scoping habit is real** — DAL getters/lists consistently `eq(userId)` and nested resources call parent getters (`listOccurrences`, routine steps/schedules). Cross-user tests in `dal.test.ts` match ADR-005 SEC-01 (404 via `NotFoundError`).
2. **Schema invariants encoded** — soft-delete/revision columns, focus partial unique index, change_log cursor index, planner_events append-only shape are tested structurally (`schema-invariants.test.ts`) and partially with DB (`migrations.test.ts`, focus tests).
3. **Temporal core is serious** — `zone.ts` implements ADR-001 gap/fold rules with deterministic tests (NY spring/fall, 23h/25h day bounds, leap/month-end/expand cases in `temporal.test.ts`). Hand-rolled RRULE subset is small and testable.
4. **Edit-scope service exists** — `recurrence.ts` service structure matches ADR-001 this / this_and_future / all, with DB tests for basic split/title override paths.
5. **Focus one-active-per-user** — DB partial unique index + supersede-on-start matches ADR-004 two-device adoption story (even if transactionality is incomplete).
6. **Offline queue shape matches ADR-002 intent** — ordered per-user pending ops, idempotency key header, 429/5xx backoff, terminal 4xx event, purge on logout with user-prefixed storage keys.
7. **API routes share DAL/services** — day/activity/focus paths import server modules rather than self-HTTP (ADR-002).

---

## Test gaps

| Area | Gap |
|------|-----|
| Day resolution | No test that a `FREQ=DAILY` series appears on day N+1; no overnight split; no multi-occurrence status map |
| Routine materializer | No double-run zero-duplicate test (ADR-004 explicit); no `nextRunAt` advance; no pause skip; no backfill window |
| Focus pause/remaining | No test that remaining freezes while paused; no multi-pause accumulation; no concurrent start |
| Optimistic concurrency | No concurrent double-PATCH race (both with same revision); occurrence upserts without If-Match |
| change_log | No assert that failed log aborts mutation or that every entity type is logged; no settings/categories seed visibility |
| Series split | No assert full template copy; no occurrence move + change_log; no completed-past-immune-to-all-edit (ADR-001) |
| Scoped delete | No cross-user delete via series id; no `this` cancel ownership |
| Offline queue | No unit tests at all (IDB mocked); no If-Match replay; no single-flight flush |
| Idempotency store | Schema only — no handler tests for 48h replay |
| Checklist | No DAL tests (module missing) |
| Stats | Streak at timezone boundary; uncomplete after complete ordering (ADR-002 conflict policy) |
| expandSeries | WEEKLY COUNT mid-window; RDATE vs COUNT; EXDATE identity under DST fold |
| Migrations | No test that first query waits for migrate; no partial-failure non-marking |

**Suggested minimum gate before multi-device / recurring dogfood:** issues 1–5 and 8 fixed with tests; materializer (2) green on forced double-run; focus pause (3) with fake clock.

---

## Assumptions

- Review based on tree as of 2026-07-18 under `/Users/nn/Apps/nnTime`.
- Route handlers outside the listed paths were sampled (activities, focus, batch) only where they call into DAL/services.
- No runtime/DB probes; findings are static analysis + reading of existing tests.
