# Kairo (nnTime) — Development Roadmap

**Goal (full, non-negotiable):** Ship Kairo, a visual daily planner in the Tiimo
category, at **≥85% feature parity with Tiimo** (parity source of truth:
`docs/research/tiimo-features.md`, areas A–N), as (1) a professional, visually
stunning web app for desktop + mobile at **https://time.neima.me**, and (2) a
**native SwiftUI iOS app** (Android later). Design is owned by Fable and already
specified in `docs/design/design-spec.md` — executors implement, they don't redesign.

**Deploy target:** Coolify public VPS (`cool.neima.me`, apps on `*.neima.me`).
**Stack:** Next.js 16 (App Router, cacheComponents) · React 19 · Tailwind v4 ·
Postgres (Coolify) + Drizzle ORM · Better Auth · REST `/api/v1/*` (zod-validated,
shared by web + iOS) · Anthropic API (claude-haiku-4-5) for AI features ·
Web Push · SwiftUI + XcodeGen + WidgetKit for iOS.

## Progress tracker
- [x] Phase 0 — Design system, mock screens, repo, live deploy pipeline (Fable, 2026-07-12)
- [ ] Phase 1 — Data foundation: schema, auth, CRUD, real Today screen
- [ ] Phase 2 — Scheduling core: recurrence, routines, drag-and-drop, week view
- [ ] Phase 3 — Focus & time: live now-line, real timer, notifications
- [ ] Phase 4 — AI co-planner: breakdown, natural-language add, plan-my-day
- [ ] Phase 5 — Calendar import, personalization, stats, templates
- [ ] Phase 6 — Onboarding, PWA, polish, QA → **85% web parity milestone**
- [ ] Phase 7 — iOS app (SwiftUI): core planner + timer
- [ ] Phase 8 — iOS widgets/Live Activities + hardening + launch

Executors: tick boxes, append a dated note to `docs/plans/progress.md` after each
phase (what shipped, evidence links, deviations).

---

## Phase 0 — Foundation & design (DONE — Fable, this session)
Design tokens (`src/app/globals.css`), app shell, and reference screens
(landing, `/app/today`, `/app/focus`, `/app/week`, `/app/routines`,
`/app/settings`) with deterministic mock data (`src/lib/mock.ts`). Verified in
browser desktop + mobile. Private repo `neima3/nnTime`, deployed to
time.neima.me via Coolify (see `docs/DEPLOYMENT.md`).

---

## Phase 1 — Data foundation *(cheap-subagent friendly, except activity editor UI)*
**Objective:** Replace mock data with a real persisted planner for one user account.

Tasks:
1. Infra: `drizzle-orm` + `postgres` deps; Drizzle config + migrations. Postgres
   database provisioned on Coolify (same project as app); `DATABASE_URL` in Coolify
   env + `.env.local`.
2. Schema: `users`, `categories` (6 defaults seeded per user), `activities`
   (title, emoji, start ts, duration min, category, energy, notes, done_at,
   all_day, source enum manual/routine/calendar), `checklist_items`,
   `tasks` (untimed "Anytime" items), `routines` + `routine_steps`,
   `user_settings` (JSON prefs). Recurrence: `rrule` string column on activities
   + `routine_schedules`.
3. Better Auth: email+password and magic-link. Session middleware for `/app/*`;
   sign-in/sign-up pages styled per design spec (copy patterns from settings screen).
4. REST API `/api/v1/`: zod-validated route handlers — CRUD for activities, tasks,
   checklists, routines, categories; `GET /day/:date` returns a fully resolved day
   (activities + expanded recurrences later). API must stay iOS-consumable
   (no server-action-only paths for core data).
5. Wire Today screen: server component fetch of real day; complete/uncomplete
   (optimistic), delete, checklist toggling.
6. **Activity editor sheet** (create/edit) — bottom sheet mobile / modal desktop.
   ⚠️ DESIGN-SENSITIVE: layout must be approved against design-spec §"screens to be
   designed"; implement with an Opus-level agent or request Fable design first.
7. Anytime panel wired: create/complete/schedule ("move to today at time").

**Verification / done-criteria:** create → edit → complete → delete an activity and
a checklist across two browsers (desktop + mobile viewport) with data surviving
reload; auth gate works; `pnpm lint && pnpm build` green; screenshots of real-data
Today desktop+mobile saved to `browser-qa/` (not committed); deployed and re-verified
on time.neima.me with a live test account.

---

## Phase 2 — Scheduling core *(mixed; DnD interaction polish needs strong model)*
**Objective:** Kairo plans days, not just displays them.

Tasks:
1. Recurrence engine: `rrule` lib; repeating activities render on correct days;
   edit scopes (this event / all future). Custom intervals (every N days) — Tiimo
   gap we intentionally beat.
2. Routines: CRUD screens (design exists), one-tap "add to today", scheduled
   auto-materialization (daily cron via Coolify scheduled task or app-level check).
3. Timeline interactions: drag to move (15-min snap), resize duration, tap-empty-slot
   to create prefilled. Keyboard alternative (move via editor) for accessibility.
4. Week view wired to real data; day columns navigate to that day (`/app/day/:date`
   supersedes hardcoded today).
5. Undo toast for destructive/move actions (8s window).
6. Past-day view + "carry over unfinished to today" affordance.

**Verification:** recurring activity appears across week correctly after edits;
drag/resize persists after reload; routine materializes on schedule (test with a
1-min-ahead schedule); undo restores; gates green; deployed + live-verified.

---

## Phase 3 — Focus & time awareness *(cheap-subagent friendly except sound design)*
**Objective:** The app feels alive in time — Tiimo's core emotional value.

Tasks:
1. Live now-line + auto-scroll to now on open; current activity ring state updates
   in real time (client component with 30s tick; no hydration mismatch — mount-gated).
2. Focus timer for real: start (from block, Up-next card, or focus tab), pause,
   +10 min extend, skip, complete-with-confetti-restraint (subtle success moment).
   Timer survives navigation + reload (server-persisted `focus_sessions` row).
3. Overtime state: ring turns `--now`-tinted, gentle "wrap up or extend?" prompt.
4. Web Push notifications (VAPID): activity start, wrap-up (5 min before end),
   optional halfway nudge — per-user toggles from Settings (wire the existing UI).
   In-app fallback banners when permission denied.
5. Ambient sounds: 3–4 loops (rain, brown noise, café, lo-fi) — sourced royalty-free,
   volume control, keeps playing across app navigation.
6. Day progress ring + streak counter (soft streak: "3 gentle days in a row",
   no shame on breaks — see research doc on Tiimo's anti-gamification stance).

**Verification:** timer runs, survives reload, fires start + wrap-up push
notifications on desktop Chrome and Android Chrome (mobile web); overtime prompt
appears; muted-browser video of a full 2-min focus session saved to `browser-qa/`;
deployed + live-verified.

---

## Phase 4 — AI co-planner *(cheap-subagent friendly — API work; review prompts carefully)*
**Objective:** Match Tiimo's AI pillar: unblock starting.

Tasks:
1. `ANTHROPIC_API_KEY` via env; server-only AI routes with per-user daily quota
   (protect cost); model `claude-haiku-4-5`.
2. **Break it down:** button on any task/activity → streamed step suggestions →
   user edits/accepts → becomes checklist. (UI per design-spec pending screens;
   get design sign-off.)
3. **Natural-language add:** omnibox in Today header ("dentist tue 3pm 45m") →
   structured activity draft chip → confirm. Falls back to plain title.
4. **Plan my day:** takes Anytime tasks + energy levels + free gaps, proposes a
   schedule the user can accept per-item. Never auto-commits.
5. AI time estimation on task creation (suggested duration chip).

**Verification:** each flow demoed end-to-end on live site with real API key;
malformed/prompt-injection inputs (task titled "ignore instructions…") produce safe
structured output only; quota enforced (test by exhausting a low test quota); gates
green; deployed + live-verified.

---

## Phase 5 — Calendar, personalization, stats, templates *(cheap-subagent friendly)*
**Objective:** The surround-features that push parity past 80%.

Tasks:
1. Google Calendar **one-way import** (OAuth, read-only scope): events appear as
   locked calendar blocks (distinct outline style — extend design tokens ONLY via
   Fable/Opus sign-off). Manual refresh + hourly sync. ICS-URL subscribe covers
   Apple/Outlook.
2. Personalization: light/dark/system theme (wire `.dark` toggle + persistence),
   reduced-stimulation mode (mutes fills to outlines, hides emoji/chips),
   dyslexia-friendly font toggle (Atkinson Hyperlegible via next/font), larger-text
   setting, first-day-of-week, 12/24h.
3. Stats screen (design pending — Fable/Opus): completion by day/week, focus minutes,
   energy balance, gentle framing (no red charts).
4. Template library: ~15 built-in routine templates (morning/evening/work/study/
   cleaning/self-care) seeded from JSON; browse + customize-on-import. (Beats Tiimo's
   lack of community gallery later; built-ins first.)
5. Family/shared profiles: **defer** (explicitly out of 85% scope — see parity math).

**Verification:** Google events visible on timeline within 1h of creation (test
manual refresh); every personalization toggle visibly changes UI and persists;
templates import correctly; deployed + live-verified with screenshots light/dark/
reduced-stim.

---

## Phase 6 — Onboarding, PWA, polish, QA → **85% WEB PARITY GATE** *(QA sweep cheap-friendly; onboarding design = Fable/Opus)*
**Objective:** From feature-complete to product-quality.

Tasks:
1. Onboarding: welcome → "how your brain likes to plan" quiz (sets defaults) →
   first-routine template pick → notification opt-in. Design sign-off required.
2. PWA: manifest, icons, service worker (next-pwa or hand-rolled), installable on
   iOS/Android home screen, offline read of today + queued mutations.
3. Empty states, loading skeletons, error boundaries for every screen.
4. Accessibility audit (run `accesslint` skill + manual keyboard pass) — fix to
   WCAG AA contrast, full keyboard nav.
5. Performance: Lighthouse ≥90 mobile on landing + today; bundle audit.
6. Full QA sweep (dogfood skill): scripted walkthrough of every parity feature,
   evidence in `browser-qa/`, bugs filed to `docs/plans/bugs.md`, all P0/P1 fixed.
7. **Parity audit:** walk `docs/research/tiimo-features.md` table, mark each feature
   shipped/partial/deferred in `docs/plans/parity-checklist.md`; computed parity must
   be ≥85% of applicable web features. If short, close gaps before declaring.

**Verification:** parity checklist ≥85% with evidence per line; Lighthouse report
saved; PWA installs on a real iPhone; QA report clean of P0/P1.

---

## Phase 7 — iOS app core *(SwiftUI: strong model for UI, cheap agents for API client/tests)*
**Objective:** Native iOS planner sharing the same account + API.

Tasks:
1. Repo `apps/ios` (XcodeGen project.yml, SwiftUI, min iOS 17). Design tokens
   translated to Swift (Color/Font extensions mirroring design-spec — Fable/Opus
   reviews fidelity).
2. API client (async/await, Codable models mirroring zod schemas; generate from a
   shared OpenAPI spec emitted by the web repo).
3. Auth (email/magic-link + Sign in with Apple), Keychain session.
4. Screens: Today timeline (vertical, drag/resize), editor sheet, Anytime, Week,
   Routines, Focus timer (background-safe), Settings.
5. Local notifications (start/wrap-up/halfway) scheduled from local day cache;
   offline-first cache with sync-on-foreground.

**Verification:** full create→schedule→focus→complete loop on a physical iPhone;
screen recordings; TestFlight build uploaded.

## Phase 8 — iOS widgets, Live Activities, hardening, launch
1. WidgetKit: today timeline widget (S/M/L), next-up lock-screen widget.
2. Live Activity + Dynamic Island for running focus timer.
3. watchOS companion (next-up + timer glance) — stretch, may defer.
4. Web+iOS hardening: Playwright E2E suite for critical paths, Sentry (or Coolify
   logs + uptime monitor), Postgres backup schedule on Coolify, rate limiting.
5. App Store assets/review prep; marketing landing final pass (Fable).

**Verification:** widgets + Live Activity on device recordings; E2E suite green in
CI; restore-from-backup drill documented; App Store submission checklist complete.

---

## Parity math (how 85% is scored)
Applicable Tiimo feature areas A–N in `docs/research/tiimo-features.md`, weighted
by area (timeline/tasks/routines/timer/AI = 60%; calendar/notifications/
personalization/templates/stats/accounts/accessibility/onboarding = 40%).
Explicitly deferred (counted against parity, budgeted within the 15%): family
profiles, Android app, watchOS (if deferred), community template sharing, courses/
learning content. Everything else ships.

## Standing execution rules (all phases)
- Read `AGENTS.md` + design spec before coding. Design tokens only; no new visual
  language without Fable/Opus sign-off.
- Gates before every commit: `pnpm lint && pnpm build` (plus `pnpm test` once vitest
  lands in Phase 1). Deploy via Coolify (see `docs/DEPLOYMENT.md`), then verify the
  LIVE URL and report truthfully what was and wasn't verified.
- Evidence for every phase: screenshots/video in `browser-qa/` (git-ignored).
- Update the progress tracker + `docs/plans/progress.md` after each phase.
- Secrets: 1Password CLI (`op`) → local `.env.local` only; never committed.
- PHI: none in this project; production data is Neima's personal planner — no
  destructive tests against prod DB.
