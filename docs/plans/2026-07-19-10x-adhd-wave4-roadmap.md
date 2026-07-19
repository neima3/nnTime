# 10× ADHD Program — Wave 4: First-run & Frictionless (2026-07-19)

**Goal:** the app is feature-rich but the first five minutes and the
hundredth-day frictions are under-built. Wave 4: an onboarding that builds
your first real day in under a minute, a command palette for zero-friction
everything, guilt-free inbox aging, one-tap scheduling, and hardening
(PWA shortcuts, a11y, perf). Research: existing docs
(`adhd-features-2026.md`: onboarding over-configuration is a top complaint;
capture friction must be near-zero; decision-free actions beat options).

## Progress tracker
- [x] Phase 1: Onboarding 2.0 — build a real first day in <60s (DESIGN, Fable)
- [x] Phase 2: Command palette (⌘K) — nav + actions, fuzzy (DESIGN, Fable)
- [x] Phase 3: Inbox gardening — guilt-free aging + weekly tend
- [x] Phase 4: Editor friction — free duration entry + start-time chips
- [x] Phase 5: Focus checklist — tick steps mid-session (linked activity)
- [x] Phase 6: PWA shortcuts + manifest polish (subagent)
- [x] Phase 7: "Slot it" — one-tap schedule into the next free gap
- [x] Phase 8: A11y sweep of wave 1–4 surfaces (subagent + accesslint)
- [x] Phase 9: Perf check — Lighthouse ≥90 mobile on / and /app/today (subagent)
- [x] Phase 10: QA, gates, ship, live verify

## Phase 1 — Onboarding 2.0
Replace the mock 4-step with 3 real steps, ≤60 s total, zero configuration
dumps: (1) name + auto-detected timezone confirm; (2) "pick your anchors" —
6 starter-block cards (Morning reset ☀️, Meds+breakfast 💊, Deep work 🎨,
Lunch 🍜, Move 🏃, Wind-down 🌙) with preset times, tap to toggle, one
Create builds real activities for TODAY via POST /activities (daily rrule
for morning/wind-down); (3) the three superpowers card (`c` capture, Pick
for me, brain breaks) → "See your day" → /app/today. Skippable at every
step; signed-out users get sign-up first.
Evidence: fresh account onboards → today shows chosen blocks; screenshots.

## Phase 2 — Command palette
`⌘K`/`Ctrl+K` overlay: fuzzy across navigation (all app routes), actions
(New activity, Quick capture, One thing, Pick for me→today, Start focus,
Play a brain break, Review day, Toggle low-battery), and games. Keyboard
up/down/enter, Esc, recent-first. Client-only, tokens, focus-trapped.
Evidence: open from 3 routes, fuzzy "cap" → Quick capture fires; keyboard
only run.

## Phase 3 — Inbox gardening
Inbox items age without shame: >7 d old get a soft "resting here N days"
chip (butter, not red). When ≥3 items are >7 d, a "Tend your inbox" card
offers a one-by-one review-style flow: Keep (fresh date), Schedule
(→ editor), Let it go (delete with undo toast). Uses existing createdAt +
endpoints.
Evidence: seed old tasks via API (created_at backdate through SQL if
needed — dev DB only), chip + tend flow round-trips.

## Phase 4 — Editor friction
Duration: replace fixed <select> with chips (15/25/45/60/90) + free minute
input (5–480). Start-time quick chips: Now, +30 min, Tonight 20:00. Keep
layout calm.
Evidence: create via "Now"+custom 35 min → lands correctly.

## Phase 5 — Focus checklist ticks
When a session is linked to an activity, steps render as checkable buttons
(reuse checklistOverride PATCH pattern from TodayTimeline). Optimistic,
If-Match, conflict toast.
Evidence: start linked focus, tick a step, verify persisted via API.

## Phase 6 — PWA shortcuts (subagent)
manifest.json: `shortcuts` (New activity, Quick capture→/app/today?capture=1,
Focus, Brain breaks) with 96px icons (reuse existing), correct start_url,
theme_color per scheme via meta tags check. QuickCapture opens when
`?capture=1`. Verify manifest parses (Chrome Application tab / curl + jq).

## Phase 7 — "Slot it"
AnytimeRail (and Tend flow) gain "Slot it" — client computes the first gap
≥ task-ish 30 min between now and 22:00 from the day's activities and
creates the activity there directly (toast + undo via delete). Zero
decisions.
Evidence: with a busy afternoon seeded, Slot it lands in the real first
gap; empty day → slots at next quarter-hour.

## Phase 8 — A11y sweep (subagent)
accesslint audit_live on /, /app/today (authed not possible for tool —
signed-out ok), /app/play + manual keyboard pass notes on new overlays;
fix criticals in our surfaces (labels, roles, focus traps, contrast).

## Phase 9 — Perf (subagent)
Lighthouse mobile on / and /app/today signed-out; record scores in
progress.md; apply cheap wins only (defer heavy work).

## Phase 10 — Ship
Gates (lint/typecheck/test/build), roadmap+progress updates, commit, push,
Coolify deploy, live verify onboarding + palette + slot-it.

Rules: tokens only, no red, forgiving copy, browser evidence per phase;
design phases (1, 2, 7 UI) on Fable; 6, 8, 9 cheap-subagent friendly.
