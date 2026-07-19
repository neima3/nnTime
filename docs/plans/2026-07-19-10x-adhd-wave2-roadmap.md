# 10× ADHD Program — Wave 2 (2026-07-19)

**Goal:** wave 1 gave Kairo its ADHD nervous system (now-anchoring, capture,
reward, focus flow). Wave 2 closes the biggest remaining daily-driver gaps —
recurrence, routine execution, natural-language planning, day rituals — and
lifts the seams (stats truthfulness, mobile sheet motion, landing story).
Research stays `docs/research/adhd-features-2026.md`; wave 1 was
`docs/plans/2026-07-18-10x-adhd-roadmap.md`.

## Progress tracker
- [x] Phase 1: Repeat control in the editor (recurrence finally has UI)
- [x] Phase 2: Routine Player — step-by-step runner with per-step timers
- [x] Phase 3: Natural-language capture ("tue 3pm dentist 30m" → scheduled)
- [x] Phase 4: Day rituals — morning kickoff + evening shutdown cards
- [x] Phase 5: Low-battery mode — energy-aware day
- [x] Phase 6: Stats truth — zone-correct buckets + best-focus-hours strip
- [x] Phase 7: Mobile motion — editor bottom-sheet, modal Esc, press states
- [x] Phase 8: Offline/perf hardening — SW bump, fewer layout shifts
- [x] Phase 9: Landing page tells the ADHD story (DESIGN-SENSITIVE)
- [x] Phase 10: QA sweep, gates, ship, live verify

---

## Phase 1 — Repeat control in the editor · DESIGN-SENSITIVE (Fable)
The server has full RRULE support (ADR-001, split/edit scopes, tests); the
editor exposes none of it. A daily planner without "every morning" is broken
for ADHD routine-building.
- `ActivityEditor`: "Repeats" chip row — None · Daily · Weekdays · Weekly on
  {day} · Every N days (N stepper 2–14). Maps to RRULE strings
  (FREQ=DAILY / FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR / FREQ=WEEKLY;BYDAY=XX /
  FREQ=DAILY;INTERVAL=N). Edit mode shows current rrule parsed into the same
  chips; changing it PATCHes with editScope "this_and_future" (server
  contract) — surface a one-line scope note, no scary modal.
- Timeline blocks for recurring series get a tiny ↻ glyph in the meta line.
- **Evidence:** create "Morning pages, daily 8:00" → appears today AND
  tomorrow (day-nav); weekday rule skips Sunday; edit one occurrence leaves
  others; ↻ visible. Screenshots.
- **Done:** all five repeat options round-trip create + edit; gates green.

## Phase 2 — Routine Player · DESIGN-SENSITIVE (Fable)
Routinery's step-runner is the ADHD killer feature: externalized sequencing.
Kairo has routines + steps + "Use today" but no execution surface.
- `RoutinePlayer` (full-screen, like OneThing): shows current step emoji +
  label + per-step countdown ring (step.durationMin), auto-advances with a
  2 s "next up" interstitial; controls: pause, +1 min, skip step, exit.
  Finish state: "Routine done — N of M steps, X min" + celebration burst.
- Entry: "Play" button on each routine card (and from "Use today" activity?
  no — keep scope: routines page only this wave).
- Local-only state (no new server surface); logs one focus_stop-style
  planner_event via existing focus session? NO — keep honest: no fake
  sessions; just a `routine_played` payload on planner_events IF an events
  API exists, else skip logging entirely this wave.
- **Evidence:** run a 2-step routine (1-min steps) E2E in browser: step 1 →
  auto-advance → step 2 → done state. Screenshots of each state.
- **Done:** player runs a real routine's steps in order; pause/skip work;
  reduced-motion honored.

## Phase 3 — Natural-language capture (cheap-subagent OK for plumbing)
The parse endpoint (`POST /api/v1/ai/parse`, SEC-05 suggestion-only) is
unused by any UI. Zero-friction capture should understand time.
- QuickCapture: after typing, a subtle "✨ Schedule it" secondary action
  (only when AI healthy — probe once via /api/health checks.ai). It calls
  /ai/parse; response renders an inline confirm chip: "Tomorrow 15:00 · 30
  min · 🦷 Dentist — [Add to timeline] [Just inbox it]". Never auto-mutates
  (SEC-05); Enter still = plain inbox capture (unchanged reflex).
- Accept → POST /api/v1/activities (scheduled) or task with date.
- Graceful: AI down/timeout → quiet fallback to inbox with no error noise.
- **Evidence:** with ANTHROPIC_API_KEY in dev: "tomorrow 3pm dentist 30min"
  → confirm chip → activity lands tomorrow 15:00 (day-nav screenshot);
  AI-off path still captures to inbox.
- **Done:** both paths verified; no auto-mutation without explicit accept.

## Phase 4 — Day rituals: morning kickoff + evening shutdown · DESIGN-SENSITIVE (Fable)
ADHD days go sideways at the transitions. Two time-aware, dismissible cards
on Today (authed, viewing today only):
- **Morning kickoff** (before 11:00, day has < 2 activities): "Set up your
  day" card — three one-tap paths: Plan with AI (→ /app/planner), Start from
  a template (→ /app/templates), Copy yesterday (one-tap: clones yesterday's
  non-routine activities to today via existing POST, with toast+undo…
  simplest honest version: navigates through existing endpoints client-side).
- **Evening shutdown** (after 19:00, ≥1 unfinished): "Close the day" card —
  review link + "carry the rest to tomorrow" (bulk move via existing PATCH
  loop) + tomorrow-preview line ("Tomorrow already has 3 things").
- Both dismiss per-day (localStorage `kairo-ritual-YYYY-MM-DD`).
- **Evidence:** freeze cases by seeding data (morning case needs a <11:00
  clock — verify by temporarily widening the window in dev? NO — component
  takes `nowMin` prop from server so both cards render in tests/screenshots
  honestly; verify copy-yesterday and carry-forward round-trips via API).
- **Done:** cards appear only in their windows, actions round-trip, per-day
  dismissal works.

## Phase 5 — Low-battery mode (energy-aware day)
Energy fields exist on activities; nothing consumes them.
- Today header: small battery toggle "Low-battery day" (client +
  localStorage per-day). When on: timeline blocks with energy=high get a
  soft "heavy" badge + 55% opacity (not hidden — honesty), PickForMe
  prefers low/medium energy (weight bump), and the day-load meter copy
  softens ("be gentle with today").
- PickForMe: accepts `lowBattery` prop; candidates carry energy.
- **Evidence:** toggle on → high-energy block dims + badge; pick prefers a
  low-energy item over a high-priority high-energy one; persists on reload.
- **Done:** toggle round-trips; all three consumers react.

## Phase 6 — Stats truth (cheap-subagent friendly)
- Fix the known week-bucketing bug: `getStats` buckets planner_events by
  UTC date; bucket by the user's planning zone (pass zone from settings;
  use the existing `instantToDateStr(date, zone)` temporal helper). Add a
  regression test with a 01:30Z event in America/New_York (lands previous
  day).
- "Your focus hours" mini-strip on Stats: 24-cell heat row from focus_stop
  events (count by zone-local start hour, last 30 d), copy "Focus lands
  most often around {peak}:00" — only with ≥5 sessions.
- **Evidence:** unit tests (bucketing + hour histogram); Stats screenshot.
- **Done:** tests green; this-week bars match the planning zone.

## Phase 7 — Mobile motion + interaction seams · DESIGN-SENSITIVE (Fable)
- Editor renders as a true bottom sheet on mobile: slides up
  (`kairo-sheet-up` keyframe, reduced-motion collapsed), drag-handle bar,
  rounded top corners, full-width buttons.
- Esc closes PickForMe + OneThing already; add Esc for QuickCapture (has),
  PickForMe (add), and focus-trap-lite: initial focus lands on the primary
  action in each overlay.
- Press states: `active:scale-[0.98]` on primary buttons app-wide (FAB,
  editor save, pick actions, capture save).
- **Evidence:** mobile screenshots (sheet), keyboard-only pass (tab order
  reaches primary in each overlay).
- **Done:** sheet animates on mobile, overlays all Esc-close + focus
  primary.

## Phase 8 — Offline/perf hardening (cheap-subagent friendly)
- Service worker: bump cache name (kairo-v3-wave2adhd), precache the new
  routes' shells, network-first for /api.
- NowProvider + SoftStreaks + AmbientSounds: audit for fetch waterfalls on
  Today; dedupe settings fetches (NowProvider + SettingsClient + editor all
  GET /api/v1/settings — add a tiny module-level memo with 60 s TTL used by
  all three).
- Fix any CLS from the load meter/banners (reserve heights where cheap).
- **Evidence:** network tab shows ≤1 settings fetch per page view; SW
  version visible in Application tab; Lighthouse mobile ≥ 90 perf on /
  and /app/today (signed out).
- **Done:** measurements recorded in progress.md.

## Phase 9 — Landing page tells the ADHD story · DESIGN-SENSITIVE (Fable)
The landing still sells generic "visual planning". Rewrite the narrative
around the five ADHD problems wave 1+2 actually solve, with real product
surface screenshots (styled frames, not raw pngs): time blindness → NowBar/
now-line; initiation → Pick for me; hyperfocus → overtime guard; working
memory → quick capture; overwhelm → One Thing. Keep the existing token
system and hero; replace/upgrade the feature sections + add a gentle
"built for ADHD brains" section with honest copy (no cure-claims).
- **Evidence:** full-page screenshot desktop + mobile, light + dark; copy
  reviewed against "no shame, no hype" bar.
- **Done:** landing communicates the ADHD positioning end-to-end.

## Phase 10 — QA, gates, ship
- Dogfood pass over phases 1–9 with the QA account (fresh where needed).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Update this tracker + progress.md; commit, push, Coolify deploy, verify
  marquee features on https://time.neima.me with screenshots.

## Execution rules
Same as wave 1 (`docs/plans/10x-adhd-agent-prompt.md`): tokens only, nothing
turns red, forgiving copy, browser evidence per phase, design-sensitive
phases (1, 2, 4, 7, 9) stay on Fable; phases 3 (plumbing), 6, 8 may use
cheaper subagents with orchestrator verification.
