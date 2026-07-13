# Progress log

## 2026-07-13 — Phase 1A complete: domain + API contract (no UI change)

**Subphase:** 1A — Domain + API contract (OpenAPI 3.1, schema invariants, sync
semantics). **No UI change** (roadmap 1A is explicit). **No deploy** — no data
layer to verify live yet; route handlers ship in 1C.

**Shipped:**
- **Drizzle schema** (`src/server/db/schema.ts`, 16 tables) per ADR-001/002/004:
  `users`, `user_settings` (typed columns, not JSON), `categories` (6 seeded,
  immutable semantic key), `tags`, `activity_series` (recurrence master with tz,
  dtstart_local, rrule, exdate/rdate, template fields), `activity_occurrences`
  (keyed by stable `(series_id, occurrence_key)`), `tasks` (one table,
  `bucket ∈ {inbox, anytime}`), `checklist_items`, `routines`/`routine_steps`/
  `routine_schedules`, `focus_sessions` (ADR-004 state machine + **partial
  unique index** = one active session per user), `push_subscriptions`,
  `planner_events` (append-only history), `idempotency_keys` (48h TTL),
  `change_log` (bigint identity, per-user change sequence for `/changes?cursor=`).
  Every owned row: UUIDv7 PK, `user_id`, `revision`, `created_at`/`updated_at`,
  `deleted_at` tombstone. DB barrel imports `server-only`.
- **Migrations** (`drizzle/`): `0000_initial.sql` (all tables/enums/indexes/
  FK cascade/partial unique), `0001_seed_categories.sql` (6 canonical category
  keys matching the design tokens). Forward-only, journal-tracked.
- **OpenAPI 3.1 contract** (`api/openapi.yaml`, ~1730 lines): error envelope,
  Idempotency-Key, If-Match/ETag, cursor pagination, closed enums, RFC 3339
  instants + date-only, UUIDv7. Paths: `/day/{date}`, CRUD for activities (with
  `editScope: this|this_and_future|all`), tasks (+`/schedule` conversion),
  checklist-items, tags, routines (+steps/schedules), focus-sessions, settings,
  categories, `POST /batch` (ordered ops/results), `GET /changes?cursor=`.
  Validated with `@redocly/cli lint` (48 nullable→3.1-form fixes applied).
  `cookieAuth` security scheme (Better Auth session).
- **zod validators** (`src/server/schemas/`, 16 files): hand-written, one per
  resource, matching the DB schema exactly. Closed enums mirror the pgEnums.
  `responseSchemaRegistry` in `index.ts` keyed by OpenAPI component name.
- **Temporal helpers** (`src/server/temporal/`): `zone.ts` (IANA validation,
  DST-safe `wallClockToInstant` with gap-shift-forward + fold-first rules,
  `resolveDayBounds` for `[start,end)` day windows); `recurrence.ts`
  (wall-clock expansion in series tz → instants, custom N-day intervals,
  EXDATE/RDATE, COUNT/UNTIL, occurrence_key derivation).
- **vitest** configured: `pnpm test` / `test:watch` / `typecheck` scripts added;
  ephemeral-DB-per-run test utilities; `server-only` stubbed in tests.

**Migrations IDs:** `0000_initial`, `0001_seed_categories`.

**Tests added (68 passing):**
- `temporal.test.ts` (25) — ADR-001 deterministic matrix: DST gap
  (spring-forward shift), DST fold (fall-back first/second), leap day, month-end
  recurrence (Jan 31→Feb 29 clamp), weekly BYDAY, custom N-day interval, UNTIL,
  EXDATE, planning-zone change (wall-time preserved), series-split
  occurrence_key stability.
- `migrations.test.ts` (5) — ephemeral Postgres: all tables/enums present,
  change_log bigint identity, **ADR-004 partial unique index rejects a 2nd
  active focus session** (completed/other-user allowed), FK cascade on user
  delete.
- `schema-invariants.test.ts` (29) — every soft-deletable table has the full
  ADR-002 column set; append-only tables (planner_events, change_log) have no
  updated_at/deleted_at; singleton (user_settings) keyed by user_id; all PKs
  uuid; sync infra tables present.
- `contract-parity.test.ts` (9) — **ADR-002 CI drift gate**: every zod registry
  entry ↔ OpenAPI component matches; spec is valid 3.1.0; /changes, /batch,
  /day, Idempotency-Key all defined.

**Evidence:** all gates green locally: `pnpm lint && pnpm typecheck && pnpm test
&& pnpm build`. DB integration tests run against ephemeral local Postgres
(Homebrew pg@17, DB created/dropped per run). No browser evidence this phase
(no UI change).

**Live-verification result:** N/A — 1A ships no route handlers or UI; nothing
to observe on time.neima.me. First live verification is 1C (CRUD handlers) /
1E (release).

**Parity numbers:** `node scripts/parity.mjs` → web 88.46%, iOS 86.52%
(unchanged — 1A ships no end-user feature; rows stay planned).

**Deviations:**
- Added `yaml` dev dependency (tiny, standard for OpenAPI tooling) to parse the
  spec in the contract-parity test. Not a runtime dependency.
- Contract-parity test uses a directional parity model: every zod resource must
  have an OpenAPI component (zod→spec), and OpenAPI-only enum/primitive
  components (HourCycle, Revision, etc.) are allowed without a zod key — this
  reflects that OpenAPI legitimately needs more named schemas than zod. The
  `OPENAPI_ONLY_ALLOWED` set in the test documents which are exempt and why.
- Schema-invariants test caught a real bug during development:
  `push_subscriptions` was missing `revision` — fixed and migration regenerated.
- `category_seed` table (not user-owned) holds the canonical 6 categories;
  per-user category rows are created at signup in 1C.

**Next step:** 1B — Infra safety: staging app + DB on Coolify, CI (GitHub
Actions wrapping these tests with an ephemeral Postgres service), automated
encrypted backups + PROVEN restore drill, migrations runbook, security headers
verified live, rate-limit middleware framework. 1B is cheap-subagent friendly.

## 2026-07-12 — Phase 0.5c complete: all design work (Fable, session 1 cont.)
**Shipped (all as living reference screens, verified in browser desktop+mobile):**
- `/app/editor` — activity editor (modal/bottom-sheet, edit-scope prompt,
  energy/priority, steps with AI break-it-down, tags, notes).
- `/app/inbox` — To-do brain-dump bucket (quick-add, tag filters, priority
  flags, Anytime/Schedule promote actions, empty state). Nav redesigned:
  sidebar 7 items (adds Inbox, Stats); mobile 5 tabs with `/app/more`.
- `/app/planner` — AI co-planner: break-it-down review, plan-my-day proposal,
  disruption re-plan; per-item confirm affordances throughout.
- `/app/month` (+ week↔month toggle on `/app/week`), `/app/review` (Review
  Today flow + completion state), `/app/stats` (+ mood check-ins),
  `/app/templates`, `/app/timeline-states` (overlap lanes, overnight split,
  locked imported blocks, reduced-stimulation), `/onboarding` (4 steps).
- `docs/design/ios-adaptation.md` — SwiftUI tokens, components, interactive
  widget specs, Live Activity/Dynamic Island, native a11y gate.
- Fixes found during verification: month grid aligned to fictional
  Saturday-July-12; editor energy/priority stack on mobile.
**Gate note:** 0.5a/b/c/d all ticked — Phase 0.5 complete. Next: subphase 1A
(domain + API contract) per `docs/plans/kairo-agent-prompt.md`.
**Dev-env note:** port 3000 is held by the separate nn.suite dev server —
nnTime dev now pinned to port 3456 in `.claude/launch.json`. Do not kill
processes on :3000.

## 2026-07-12 — Codex review applied (Fable, session 1 cont.)
**Shipped:**
- Roadmap rewritten to v2: subphase execution model, Phase 0.5 contracts gate,
  Phase 1 split 1A–1E (contract → infra safety → auth/CRUD → UI → release),
  Phase 7 split 7A–7F, missing parity features mapped to phases, security
  contract section, scripted parity scoring (equal per-row weights, per-platform
  85% targets).
- Binding ADRs 001–005 written (`docs/adr/`): temporal/recurrence, API+offline
  sync, auth (web+native), jobs/timer/notifications, security/privacy.
- Parity checklist (98 rows) + `scripts/parity.mjs` (subagent-built; verified
  by running the script myself). First run: web 85.90% PASS, iOS 83.15% FAIL —
  fixed by strengthening the roadmap (not the credits): month view/extend/
  checklist-in-focus itemized for iOS, high-contrast added to 5B, Apple Health
  to 8B. Final: **web 88.46%, iOS 86.52% — gate 0.5d PASSED and ticked.**
- Executor prompt updated to subphase model; AGENTS.md reading order + gates.
- Design-token contradiction fixed: `--now-ink` token added, `text-white`
  removed from Today screen (verified in browser); design-spec token-
  canonicality section + pending-designs list with consuming subphases.
- Disposition record: `docs/plans/codex-review-response.md`.

**Next step:** Phase 0.5c — Fable/Opus designs for editor sheet, To-do inbox,
AI UI; then verify gate 0.5d (script ≥85% planned for web AND iOS); then 1A.

## 2026-07-12 — Phase 0 (Fable, session 1)
**Shipped:**
- Next.js 16 + Tailwind v4 scaffold (pnpm), package `nntime`, product name **Kairo**.
- Full design token system in `src/app/globals.css` (light + dark), fonts
  (Bricolage Grotesque / Onest / Spline Sans Mono), design spec at
  `docs/design/design-spec.md`.
- High-fidelity reference screens on deterministic mock data (`src/lib/mock.ts`):
  landing `/`, `/app/today` (proportional timeline, now-line, Anytime rail, FAB),
  `/app/focus` (ring timer), `/app/week`, `/app/routines`, `/app/settings`.
- Tiimo feature research: `docs/research/tiimo-features.md` (subagent, ~40 sources).
- Roadmap (8 phases), executor prompt, Codex review prompt in `docs/plans/`.

**Verified:** all six screens screenshotted in real browser, desktop (1600×900) and
mobile (375×812) viewports; layout, tab bar, FAB, timeline states all correct.
Dark-mode tokens defined but not yet toggleable in UI (Phase 5 wires it).

**Deployed:** Coolify app `kairo` (uuid `upovjycdksz4aoy98q4bpusg`, project `Kairo`)
on cool.neima.me, built from `neima3/nnTime@main` via Dockerfile (standalone).
Live-verified at https://time.neima.me (200, correct title, `/app/today` screenshot
confirmed in browser). First deploy failed on corepack's interactive pnpm download
prompt — fixed with `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` + pinned `packageManager`.

**Deviations/notes:**
- Product name Kairo chosen by Fable; original identity, no Tiimo assets used.
- create-next-app rejected capitalized dir name; scaffolded in temp dir and moved.

**Next step:** Phase 1 (data foundation) per `docs/plans/kairo-agent-prompt.md`.
Before Phase 1: Codex plan review (`docs/plans/codex-review-prompt.md`) — apply
its accepted edits to the roadmap first.
