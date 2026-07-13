# Kairo (nnTime) — Development Roadmap (v2, post Codex review)

**Goal (full, non-negotiable):** Ship Kairo, a visual daily planner in the Tiimo
category, at **≥85% scripted feature parity with Tiimo** (source of truth:
`docs/plans/parity-checklist.md`, computed by `scripts/parity.mjs`; feature
inventory: `docs/research/tiimo-features.md`), as (1) a professional, visually
stunning web app for desktop + mobile at **https://time.neima.me**, and (2) a
**native SwiftUI iOS app** (Android later). Web and iOS parity are computed
separately; **each must independently reach ≥85%.** Design is owned by Fable and
specified in `docs/design/design-spec.md` — executors implement, they don't redesign.

**Deploy target:** Coolify public VPS (`cool.neima.me`). **Stack:** Next.js 16
(App Router, cacheComponents) · React 19 · Tailwind v4 · Postgres (Coolify) +
Drizzle ORM · Better Auth · versioned REST `/api/v1/*` defined by a committed
OpenAPI 3.1 spec (shared by web + iOS) · Anthropic API (claude-haiku-4-5) ·
Web Push · SwiftUI + XcodeGen + WidgetKit.

**Binding decision records (ADRs)** live in `docs/adr/`. They are contracts, not
suggestions; an executor who needs to deviate must stop and hand off:
- ADR-001 temporal model & recurrence · ADR-002 API + offline sync protocol ·
  ADR-003 native auth · ADR-004 background jobs & notifications ·
  ADR-005 security & privacy invariants.

## Execution model
Each phase is split into **numbered subphases sized for one agent session**.
Track every subphase separately: status, inputs, migrations, tests, evidence,
commit, deploy result, deviations, exact next step (in `docs/plans/progress.md`).
An agent executes **only the first unchecked subphase**. A parent phase is
complete only when all its subphases and the phase gate pass; a mid-subphase
handoff may never tick a box. Design-sensitive items require Fable/Opus-level
design work BEFORE the consuming subphase starts.

## Progress tracker
- [x] Phase 0 — Design system, mock screens, repo, live deploy (Fable, 2026-07-12)
- [ ] Phase 0.5 — Execution contracts (BLOCKS PHASE 1)
  - [x] 0.5a Parity checklist + scoring script (draft — verify before Phase 1)
  - [x] 0.5b ADRs 001–005 written
  - [x] 0.5c ALL pending designs produced by Fable (2026-07-12): editor sheet,
        To-do inbox + nav redesign, AI co-planner, month view, Review Today,
        stats + mood, templates, timeline-states addendum, onboarding, iOS
        adaptation doc — see design-spec "Screen designs — COMPLETE"
  - [x] 0.5d Gate: `node scripts/parity.mjs` reproduces ≥85% planned coverage —
        web 88.46%, iOS 86.52% (2026-07-12, after itemizing month view/extend/
        checklist-in-focus/high-contrast/Apple Health into phases)
- [ ] Phase 1 — Data foundation
  - [x] 1A Domain + API contract (OpenAPI 3.1, schema invariants, sync semantics)
  - [ ] 1B Infra safety: staging, CI, backups+restore drill, migrations runbook,
        security headers, rate-limit framework
  - [x] 1C Auth + DB + CRUD with per-resource authorization + negative tests
  - [x] 1D UI wiring: Today, editor sheet, Anytime, To-do inbox route
  - [x] 1E Release: deploy, live verification, parity checklist update
        (auth UI + prod migration heal; real account verified live 2026-07-13)
- [ ] Phase 2 — Scheduling core
  - [x] 2A Recurrence engine (series/override model, edit scopes, DST tests)
  - [x] 2B Routine materializer (durable idempotent job)
  - [x] 2C Timeline interactions (drag/resize/create, collisions, keyboard)
  - [x] 2D Week + month views, Review Today flow, carry-over
- [ ] Phase 3 — Focus & time
  - [x] 3A Focus-session state machine (server-authoritative)
  - [x] 3B Notification scheduler + Web Push (incl. installed-iPhone-PWA test)
  - [x] 3C Time UX: live now-line, auto-start policy, overtime, ambient sounds,
        streaks, custom reminder timing/sounds, daily/weekly review
- [x] Phase 4 — AI co-planner (breakdown, NL/voice add, plan-my-day,
      disruption re-planning, priority grouping — per AI safety contract)
- [ ] Phase 5 — Surround features
  - [x] 5A Calendar: Google OAuth import + ICS subscribe (SSRF controls,
        token encryption, update/delete reconciliation)
  - [x] 5B Personalization (theme, reduced stimulation, dyslexia font, etc.)
  - [x] 5C Stats/insights on the event-history table + mood check-ins
  - [x] 5D Templates + personal routine library (search/filter/favorites/pause)
  - [x] 5E Privacy surface: data export, account deletion cascade
- [ ] Phase 6 — Product quality → **85% WEB PARITY GATE**
  - [x] 6A Onboarding (designs first)
  - [x] 6B PWA offline (enable the ADR-002 protocol; user-scoped caches)
  - [x] 6C Accessibility audit + fixes (WCAG AA, keyboard, screen reader flows)
  - [x] 6D Performance (Lighthouse ≥90 mobile)
  - [x] 6E Dogfood QA sweep, P0/P1 fixes
  - [x] 6F Scripted parity audit — web ≥85% with per-row evidence
- [ ] Phase 7 — iOS app
  - [x] 7A Contract proof (Swift OpenAPI toolchain compiles in CI)
  - [x] 7B Native auth on device (Sign in with Apple, Keychain, deep links)
  - [x] 7C Data/sync (shared revision/cursor protocol, offline, logout purge)
  - [ ] 7D Planner UI (Today/editor/Anytime → Week/Routines; VoiceOver/Dynamic Type)
  - [ ] 7E Focus + local notifications (background-safe reconstruction)
  - [ ] 7F Release preflight + TestFlight
- [ ] Phase 8 — iOS surfaces + launch → **85% iOS PARITY GATE**
  - [ ] 8A Interactive widgets + Live Activity/Dynamic Island
  - [ ] 8B Google sign-in (web+iOS), Apple Reminders import decision executed
  - [ ] 8C Ongoing hardening: repeated restore drill, E2E suite in CI, monitoring
  - [ ] 8D App Store privacy labels, review prep, launch

---

## Phase 0 — Foundation & design (DONE — Fable, 2026-07-12)
Design tokens, app shell, reference screens (landing, today, focus, week,
routines, settings) on deterministic mock data; verified desktop+mobile.
Private repo `neima3/nnTime`; deployed and live-verified at time.neima.me.
Known Phase-0 facts that later phases must replace (not copy): mock stores
minutes-from-midnight; timeline is fixed 07:00–23:00; shell has no To-do route.

## Phase 0.5 — Execution contracts (BLOCKS PHASE 1)
1. **Parity baseline:** `docs/plans/parity-checklist.md` — one row per researched
   feature: stable ID, area, platform applicability (web/ios/both), planned
   phase, status, credit, acceptance evidence. Exclusions from the denominator
   only for rows the research marks unverified/reported-gap or pure pricing
   policy, each with a written reason. Partial credit = 0.5 only when its
   acceptance criteria are written on the row. Every deferred feature stays in
   the denominator and scores 0 — no unweighted "15% loss budget."
   `node scripts/parity.mjs` must reproduce the web and iOS percentages.
2. **ADRs 001–005** (see above) reviewed and marked Accepted.
3. **Design debt cleared ahead of consumers:** activity editor sheet, To-do
   inbox screen, AI breakdown/plan-my-day UI (needed by Phases 1/4); stats,
   onboarding, template gallery before Phases 5/6; iOS adaptations before 7D.
**Gate (0.5d):** planned coverage ≥85% for web AND iOS per the script, with the
phase map updated until it does.

## Phase 1 — Data foundation
### 1A — Domain + API contract *(strong model recommended; no UI)*
- Drizzle schema per **ADR-001/002**: every user-owned row has `user_id`, UUID
  PK, `created_at`/`updated_at`, monotonic `revision`, ownership indexes.
  Instants stored UTC with explicit IANA zone where wall-clock semantics matter;
  date-only values (Anytime/all-day) are DATE columns, never midnight UTC.
  Recurrence = `activity_series` + occurrence overrides/exclusions (ADR-001),
  not an rrule string on a mutable row. Append-only `planner_events` history
  table (complete, uncomplete, skip, reschedule, focus intervals, energy edits)
  — stats and streaks read this, not mutable flags. Tombstones, client mutation
  idempotency keys, and per-user sync cursor tables exist from day one.
- Tables: `users`, `user_settings` (typed columns for timezone, locale,
  week_start, hour_cycle, notification prefs, schema_version; JSON only for
  presentation extras), `categories` (6 seeded, immutable semantic key +
  user-editable label; delete = soft with fallback), `activity_series`,
  `activity_occurrences`/overrides, `tasks` (two buckets per ADR-001: `inbox`
  to-dos AND `anytime` day-attached, one table + `bucket` enum), `checklist_items`,
  `tags`, `priority` on tasks/activities, `routines`, `routine_steps`,
  `routine_schedules`, `focus_sessions`, `push_subscriptions`, `planner_events`.
- **OpenAPI 3.1 spec committed at `api/openapi.yaml` = the contract.** Standard
  error envelope, RFC 3339 instants + date-only formats, enums, cursor
  pagination, ETag/If-Match conditional writes, `Idempotency-Key` header, batch
  mutation endpoint with ordered results, incremental `/changes?cursor=` feed,
  tombstones. zod validators derived from/checked against it in CI; Swift-facing
  fixtures generated; CI fails on drift.
- Deterministic test matrix now: DST gap/fold, leap day, month-end recurrence,
  series split, timezone travel (ADR-001 scenarios).
**Done:** spec + migrations + passing contract/unit tests in CI. No UI change.

### 1B — Infra safety *(cheap-subagent friendly)*
- Staging app + staging Postgres on Coolify (`time-staging.neima.me`) with a
  synthetic tenant; destructive QA runs ONLY there (tooling refuses prod URL).
- CI on every push (GitHub Actions): lint, typecheck, unit, DB integration
  (ephemeral Postgres), API contract + authz tests, build, Playwright smoke.
  `pnpm test` script added.
- **Backups before real data:** automated encrypted Postgres backups on Coolify,
  off-host copy, retention + monitoring, and a PROVEN restore into an isolated
  DB (drill documented in `docs/DEPLOYMENT.md`).
- Migrations runbook: forward-only numbered migrations, expand/migrate/contract
  for breaking changes, predeploy backup, compatibility window for old clients,
  rollback/roll-forward steps. Coolify healthcheck endpoint `/api/health`,
  documented previous-image rollback.
- Security headers (CSP report-only → enforce, nosniff, frame-ancestors,
  Referrer-Policy, Permissions-Policy) verified on the LIVE URL; request-size
  limits; per-endpoint rate-limit middleware (shared store) ready for 1C.
**Done:** CI green on a PR; restore drill evidence; headers verified live.

### 1C — Auth + CRUD *(cheap-subagent friendly with ADRs in hand)*
- Better Auth per **ADR-003**: email+password (verification + reset) and
  magic link (single-use, 15-min expiry, no account enumeration), rotating
  bounded sessions, secure/HttpOnly/SameSite cookies, canonical origin, CSRF
  origin checks for cookie-authenticated mutations, logout + revoke-all.
  Rate limits on signup/login/reset/magic-link (IP + account).
- Route handlers implement the 1A spec. **Middleware is UX only — every handler
  authenticates and scopes every query by session `user_id` in the same
  predicate (SEC-01); client-supplied owner IDs ignored; nested resources check
  parent ownership.** User responses `private, no-store`; DAL is server-only
  (`server-only` import), no DB/auth imports in Client Components, no
  cacheComponents caching of user data unless keyed per user.
- Negative tests for every resource: cross-user read/write denied,
  unauthenticated denied, CSRF/origin rejected, idempotent retry, revision
  conflict (409 + server state).
**Done:** contract + authz suites green in CI; staging deploy verified.

### 1D — UI wiring *(design-sensitive; editor + inbox designs from 0.5c required)*
- Today reads the real resolved day via the shared server-side service (same
  code path the route handler uses — no self-HTTP). Complete/uncomplete
  (optimistic + revision conflict rollback + undo), delete (tombstone + undo).
- Activity editor sheet per approved design: title, emoji, category, date/time,
  duration, repeat (ADR-001 scopes), checklist, energy, tags, priority, notes.
- **To-do inbox route** (new nav destination per updated design spec) distinct
  from Anytime: brain-dump list with tags/priority; "promote to Anytime/today".
- Anytime panel wired (schedule = move with history per ADR-001).
**Done:** create→edit→complete→delete + checklist flows verified in browser
desktop+mobile on staging; screenshots in `browser-qa/`.

### 1E — Release
Prod migration (with predeploy backup), deploy, live verification on
time.neima.me with a real account, parity checklist rows updated with evidence,
progress note. **Phase gate:** all 1A–1E boxes + CI green + live evidence.

## Phase 2 — Scheduling core
### 2A — Recurrence engine *(strong model; ADR-001 binding)*
This occurrence (override, master untouched) / this-and-future (transactional
series split, stable occurrence identity preserved) / all (master update with
explicit override-survival rule). Delete scopes ditto. Completed past
occurrences immutable by series edits. Deterministic tests: DST fold/gap, leap
day, month-end, split-then-edit, concurrent edit conflict. Custom intervals
(every N days/weeks) included — deliberate Tiimo-beating feature.
### 2B — Routine materializer *(cheap-subagent friendly)*
Durable Coolify scheduled job (NOT page-load checks): DB advisory-lock lease,
unique `(routine_schedule_id, occurrence_key)` for retry-safe dedup, missed-run
backfill window, cancellation on schedule edit, run logging. Pause-recurrence
supported. Verification: forced double-run produces zero duplicates; backfill
test; 1-min-ahead schedule materializes (latency check only, not the test).
### 2C — Timeline interactions *(strong model for feel; ADR notes on conflicts)*
Drag move / resize (15-min snap), tap-empty-slot create, defined collision
layout (side-by-side lanes for overlaps — design-spec addendum), locked
imported blocks non-draggable, mobile long-press-then-drag vs scroll
arbitration, keyboard alternative + ARIA, optimistic writes with revision
conflict handling. Timeline extends beyond 07:00–23:00: full 24h scrollable,
overnight activities render split at midnight (design-spec addendum).
### 2D — Week + month + review *(cheap-subagent friendly)*
Week wired to real data; **month view** (compact dots/counts per day →
day drill-in); `/app/day/[date]` route; guided **Review Today** flow
(complete/skip/reschedule each unfinished item, powered by planner_events) and
carry-over as one action inside it; undo (delayed-commit, 8s, per ADR-002).

## Phase 3 — Focus & time
### 3A — Focus-session state machine *(strong model)*
Server-authoritative per ADR-004: states running|paused|completed|skipped|
cancelled, `started_at`, accumulated pause, target duration, revision,
completion reason; **partial unique index = one active session per user**;
idempotent transitions on server time; UI derives remaining time. Defined:
reload/navigation, two-device contention (second device adopts, first yields),
sleep/wake reconstruction, clock changes, offline actions queue, overtime
state, activity edited/deleted while focused. Auto-start policy per user
setting (scheduled activities can auto-begin focus). Manual finish + drag-
to-complete equivalent. **Quick-extend controls (+1/+5/+10 min) on the live
timer** (the focus screen's extend button, made granular). **The running-focus
UI shows the activity's checklist live; items can be checked off inside the
timer** (per the Phase 0 focus screen's Steps card).
### 3B — Notification scheduler + Web Push *(cheap-subagent friendly + ADR-004)*
Durable job computes/cancels/dedupes start, halfway, wrap-up, daily Review
Today, and weekly review notifications when activities/timers change; retry +
expiry. Web Push: authenticated user-scoped subscription CRUD, endpoints
treated as secrets, stale-subscription pruning, lock-screen content-privacy
toggle, quiet hours, custom per-user reminder offsets and sound choice.
Service worker + manifest land HERE (moved from Phase 6) because iOS PWA push
requires them. **Verification matrix: desktop Chrome, Android Chrome, macOS
Safari, and an INSTALLED iPhone Home-Screen PWA (permission after user
gesture)** — per WebKit's Web Push requirements. Native iOS notifications
remain a separate Phase 7 contract.
### 3C — Time UX *(mixed; sounds/design touches = Fable/Opus)*
Live now-line + auto-scroll (mount-gated, no hydration mismatch); current-
activity ring; overtime prompt; ambient loops (named royalty-free sources +
licenses recorded in `docs/design/audio.md`, storage in repo `public/audio`,
gapless loop, volume, per-sound mute, keeps playing across navigation); soft
streaks (qualifying action = any planned item completed that day in user's
planning zone; 1-day grace; opt-out; no shame copy).

## Phase 4 — AI co-planner *(cheap-subagent friendly; AI safety contract binding)*
Safety contract (ADR-005 / SEC-05): AI endpoints have **no tools, no
credentials, no mutation authority**; minimum necessary user data, untrusted
fields delimited; strict zod output schema, length caps, unknown fields
rejected; output rendered as text and applied ONLY via per-item user
confirmation; atomic per-user daily quota + IP throttle; timeout/cancel;
prompts/outputs redacted from default logs; Anthropic retention noted in
privacy doc. Features:
1. **Break it down** — task → suggested steps → user edits/accepts → checklist.
2. **Natural-language add** — omnibox, typed AND voice (Web Speech API where
   available, graceful fallback) → structured draft chip → confirm.
3. **Plan my day** — Anytime+inbox tasks, current energy, free gaps → proposal,
   per-item accept. Never auto-commits. (Learning energy patterns over time =
   separate deferred row, scores 0 until shipped.)
4. **Disruption re-planning** — "running 40 min late" → shift/reschedule
   proposal with per-change confirmation.
5. **AI priority grouping** of the inbox + duration estimation chip.
Verification: all flows live with real key; adversarial titles/notes produce
schema-valid output only; quota exhaustion behavior; cost log reviewed.

## Phase 5 — Surround features
### 5A — Calendar *(strong model for sync correctness)*
Google OAuth (read-only scope, offline access): tokens envelope-encrypted with
key outside Postgres (ADR-005), rotation/expiry/revocation + disconnect UI +
delete cascade; incremental sync (syncToken) with update/delete/move
reconciliation and recurring-event mapping into read-only locked blocks
(outline style — design addendum, Fable/Opus). ICS subscribe with full SSRF
controls (http/https only, resolve-then-verify public IP on every redirect,
size/time caps, content validation, encrypted URL storage, redaction). Hourly
scheduled sync + manual refresh. Failure/re-auth UX. Verification includes
update, cancel, timezone, recurring, revoked-token, and duplicate-delivery cases.
### 5B — Personalization *(cheap-subagent friendly)*
Theme toggle wiring (.dark persistence), reduced-stimulation mode, **dedicated
high-contrast mode (strengthened ink/border tokens, WCAG AAA targets; honors
`prefers-contrast` and iOS Increase Contrast)**, dyslexia-friendly font
(Atkinson Hyperlegible), larger text, first-day-of-week, 12/24h, per-category
color/label editing within token constraints.
### 5C — Stats + mood *(stats screen design from 0.5c queue)*
Computed from `planner_events`: completion by day/week, focus minutes, energy
balance, streaks; timezone-bucketed in planning zone; deleted items retained in
aggregates; empty-state thresholds. **Mood check-ins** (morning/evening prompt,
1-tap scale + optional note → events table, shown in stats). Gentle framing.
### 5D — Templates + routine library *(cheap-subagent friendly)*
~15 built-in templates (stable IDs, versioned JSON, import = independent copy
with provenance field, duplicate-import allowed with suffix); personal routine
library: search, filter, favorites, pause. 
### 5E — Privacy surface
Data export (JSON zip of all user rows), account deletion cascade (OAuth
revocation, push unsubscribe, queued-job cancellation, backups expire per
retention), privacy page copy, log-redaction audit. (SEC-10)

## Phase 6 — Product quality → 85% WEB PARITY GATE
6A onboarding (designs first: welcome → planning-style quiz setting real
defaults → first template → notification opt-in). 6B PWA offline: enable
ADR-002 queue UI (cache scope user-keyed, purge on logout/account-switch, no
auth-response caching, SW update strategy). 6C accessibility (accesslint +
manual keyboard + screen-reader task flows for core loop). 6D performance
(Lighthouse ≥90 mobile landing+today; bundle audit). 6E dogfood QA sweep with
evidence; P0/P1 fixed. **6F scripted parity audit: `node scripts/parity.mjs`
web ≥85% with per-row evidence links — the gate.**

## Phase 7 — iOS app (subphases per Codex edit 10)
**7A Contract proof:** pin supported Swift OpenAPI toolchain (evaluate current
non-deprecated generator options; do NOT default to legacy swift5), generate +
compile client in CI from committed spec, golden decode/error/auth tests.
**7B Native auth:** ADR-003 on device — session transport, universal link /
custom scheme, magic-link deep link, Sign in with Apple (nonce, private-relay
email, account linking, duplicate policy), Keychain, refresh/revoke, logout
purge. **7C Data/sync:** shared revision/cursor/idempotency protocol,
protected local store (data-protection class), foreground sync, conflict UI,
offline tests. **7D Planner UI:** full web-planner feature
parity, itemized: Today timeline (drag/resize), editor sheet (tags, priority,
energy, repeat scopes), Anytime + To-do inbox, Week, **Month**, Routines,
checklists (including inside focus), AI flows (breakdown, NL add, plan-my-day
via the same API), personalization incl. high-contrast — token fidelity
reviewed by Fable/Opus; VoiceOver, Dynamic Type, reduced motion;
physical-device recordings. **7E Focus + notifications:** elapsed-time
reconstruction (no indefinite background), local notifications scheduled from
cached day, timer Live-Activity-ready. **7F Release preflight:** certificates,
bundle IDs, entitlements, privacy manifest, App Store Connect access verified
as a gate BEFORE build work claims done; CI archive; TestFlight.

## Phase 8 — iOS surfaces + hardening + launch → 85% iOS PARITY GATE
8A **interactive** widgets (complete-from-widget), timeline + next-up widgets,
Live Activity + Dynamic Island for focus; watchOS glance = stretch (separate
parity row, scores 0 if deferred). 8B Google sign-in on web+iOS; execute the
Apple Reminders import decision recorded in 0.5 checklist (ship or justified
exclusion); **Apple Health sync (HealthKit: write focus/mindful minutes,
read sleep schedule to inform wind-down suggestions; explicit user opt-in)**. 8C ongoing hardening: repeated restore drill, Playwright E2E in CI,
uptime monitoring, dependency audit. 8D App Store privacy labels + review prep;
final scripted parity audit for iOS ≥85%.

---

## Security & privacy contract (binding summary — full text ADR-005)
1. Authorization inside every handler (user-scoped predicates); middleware is
   defense-in-depth only; negative tests mandatory. (SEC-01)
2. Cookie/CSRF/session policy as in 1C. (SEC-02)
3. OAuth + ICS secrets envelope-encrypted, never logged; SSRF controls. (SEC-03/04)
4. AI: no capability, schema-bound, confirm-before-mutate, quota. (SEC-05)
5. Rate limits ship WITH each endpoint, not later. (SEC-06)
6. Backups + proven restore BEFORE first real data. (SEC-07)
7. Push endpoints/offline caches are personal data: scoped, pruned, purged. (SEC-08)
8. Security headers verified live from Phase 1. (SEC-09)
9. Export/delete/retention shipped in 5E; privacy labels before TestFlight. (SEC-10)

## Parity scoring (reproducible)
Equal weight per applicable checklist row (the old 60/40 area weighting is
retired). credit: shipped-with-evidence = 1, partial-with-written-criteria =
0.5, planned-but-unshipped/deferred = 0 (at audit time), excluded rows out of
the denominator only with a written reason. `scripts/parity.mjs` prints web,
iOS, and combined percentages; gates 0.5d, 6F, and 8D use it.

## Standing execution rules (all phases)
- Read `AGENTS.md`, the ADRs, and the design spec before coding. Design tokens
  are canonical (raw hex only inside `globals.css` token definitions).
- Gates before commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`;
  CI must be green before deploy.
- Staging first; production deploy per `docs/DEPLOYMENT.md` (predeploy backup on
  migrations), then LIVE verification with evidence. Report truthfully.
- Evidence in `browser-qa/` (git-ignored); progress notes per subphase.
- Secrets via 1Password `op` → `.env.local` (quoted!) + Coolify env; never committed.
- Production data is Neima's real planner after Phase 1E — destructive tests
  ONLY on staging/synthetic tenants.
