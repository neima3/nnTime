# 10× ADHD Program — Kairo (2026-07-18)

**Goal:** make Kairo the ultimate daily driver for people with ADHD — not by adding
noise, but by attacking the five ADHD core problems directly: time blindness,
task initiation, hyperfocus, working memory, and motivation collapse. Every phase
ships a complete, browser-verified slice on https://time.neima.me. The design bar
stays at the current Soft Focus level (tokens only, nothing ever turns red,
forgiveness-first copy).

**Research:** `docs/research/adhd-features-2026.md` (competitor mechanics +
pitfalls) and `docs/research/tiimo-features.md`.

## Progress tracker
- [x] Phase 1: Now Bar — persistent time anchor across the app
- [x] Phase 2: Celebration + reward loop (completion dopamine, all-clear state)
- [x] Phase 3: Quick capture everywhere (c = brain-dump from any screen)
- [x] Phase 4: Focus 10× — breaks, overtime guard, session flow
- [x] Phase 5: "Pick for me" — decision paralysis breaker
- [x] Phase 6: Time estimation calibration (planned vs actual)
- [x] Phase 7: Gentle reminders (client-side notifications, transition warnings)
- [x] Phase 8: Overwhelm tools — day-load meter + One Thing mode
- [x] Phase 9: Micro-interaction + mobile polish pass
- [x] Phase 10: QA sweep, a11y, parity, ship + live verification

---

## Phase 1 — Now Bar (time-blindness anchor) · DESIGN-SENSITIVE (Fable)
People with ADHD lose the thread of *now*. Kairo already auto-scrolls Today to
the now-line; this phase makes "now" ambient everywhere in the app.
- `NowBar` client component in AppShell (authed only): slim, fixed on desktop
  sidebar bottom + mobile above tab bar. Shows: current activity (emoji + title
  + "N min left") or, between activities, "Free until HH:MM · next: X".
  Data: light `GET /api/v1/day/{today}` fetch + 30 s refresh; hidden when
  day is empty or on /app/focus (the ring already owns "now" there).
- Tapping it → /app/today (scrolls to now).
- Document title on Today shows "· now: X" only if cheap (skip if noisy).
- **Evidence:** desktop + 375 px screenshots on ≥2 routes; countdown decrements.
- **Done:** bar live on all app routes, links to today, honest when day empty.

## Phase 2 — Celebration + reward loop · DESIGN-SENSITIVE (Fable)
Dopamine done adult: quick, physical, over in <1 s, never blocking.
- Completion burst: small confetti/starburst from the checkmark on timeline
  complete + review "I did it" (CSS/SVG particles, honors reduced motion +
  reduced stimulation = no animation, toast only).
- Progress ring milestone states: 50% ("Halfway"), 100% day header turns
  celebratory ("Day done — go be free").
- All-done empty state on Today when every activity is complete (distinct from
  "day is clear").
- **Evidence:** screen recordings/screenshots of burst + 100% state; reduced-
  motion check (emulate) shows no animation.
- **Done:** completing from timeline + review both celebrate; no layout shift.

## Phase 3 — Quick capture everywhere (working memory) 
Thought → captured in <3 s from anywhere, zero navigation.
- Global `QuickCapture` modal on `c` (and mobile: long-press FAB → capture
  sheet… fallback: small ✎ button beside FAB) mounted in AppShell.
- Free-text → POST /api/v1/tasks (inbox bucket). Show "Captured ✓ — it's in
  your inbox" toast with Undo. Stays open on Shift+Enter for chain-dumping.
- `?` help sheet updated; `n` (new activity) unchanged.
- **Evidence:** capture from /app/week + /app/stats; task appears in inbox;
  chain-capture 3 items; mobile sheet screenshot.
- **Done:** capture works from every app route, keyboard + touch.

## Phase 4 — Focus 10×: breaks, overtime guard, session flow · DESIGN-SENSITIVE (Fable)
Hyperfocus management + transition softening in FocusClient:
- Session end: ring completes → distinct "Session done" state with chime-free
  visual celebration, "Take a 5-min break" / "Keep going +10" / "Done for now".
- Break timer: lightweight local countdown (no server session) with soft
  "break's over — ready?" state; then offers restart.
- Overtime guard: when remaining hits 0 and user keeps going (no action), show
  gentle overtime banner "+N min over — wrap up or extend?" instead of silent
  00:00.
- Tab title shows mm:ss while running (glanceable from other tabs).
- **Evidence:** run a 1-min session E2E in browser: end state → break → ready;
  tab title tick; screenshots each state.
- **Done:** full loop session→break→next verified; server session states clean.

## Phase 5 — "Pick for me" (task initiation / decision paralysis)
One button that answers "what should I do right now?".
- On Today (empty-ish moments) + Inbox header: "Pick for me" → picks ONE item:
  preference order = current scheduled activity not done → overdue-today
  activity → highest-priority inbox/anytime task (tie: oldest). Pure client
  logic over already-loaded data; no AI key needed (AI plan-day stays separate).
- Result card: "Just this: X" with [Start focus] [Done] [Shuffle] — commits to
  one thing, hides the rest (links into Focus with the task title).
- **Evidence:** browser click-through with seeded data; shuffle cycles;
  focus link carries title.
- **Done:** works on Today + Inbox, sensible order, zero-data state handled.

## Phase 6 — Time estimation calibration (cheap-subagent friendly: server + tests)
ADHD time estimates run 2–3× optimistic; show the gap kindly.
- Server: activity PATCH complete path enriches planner_events payload with
  {plannedMin, completedAt}; focus_stop already logs elapsed. New stats fields:
  average planned vs actual focus min last 14d, "estimate accuracy" per week.
- Stats UI: "Time truth" card — "Your 30-min plans actually take ~45 min.
  That's normal — plan 1.5×." (only shows with ≥5 data points; never shaming).
- Editor: subtle hint under duration when data exists ("similar blocks usually
  run ~Xm").
- **Evidence:** unit tests for the aggregate; seeded account shows card.
- **Done:** tests green; card + hint render with data, hidden without.

## Phase 7 — Gentle reminders (client-side, no cron dependency)
Web Push + server cron stays blocked on env (CRON_SECRET); ship the client path:
- Settings toggle "Transition warnings" (default off, one-tap on): while the
  app is open, browser Notification API + in-app toast at activity start and
  5 min before end ("Morning reset wraps up in 5").
- Powered by the NowBar's day data + a single interval scheduler in AppShell;
  respects reduced stimulation (in-app toast only, no system notification).
- Permission flow: ask only on toggle-on, never on load.
- **Evidence:** toggle on → grant → simulated boundary fires toast (shrink an
  activity to hit a real boundary in test); permission-denied path degrades.
- **Done:** no notification ever fires with toggle off; zero on signed-out.

## Phase 8 — Overwhelm tools: day-load meter + One Thing mode · DESIGN-SENSITIVE (Fable)
- Day-load meter: in Today header area, planned-minutes vs waking window
  ("5.5 h planned · feels full"). Three bands: light/comfortable/full — full
  band offers "move something to tomorrow" → review-style picker.
- One Thing mode: from NowBar or `f` shortcut — full-screen card of ONLY the
  current activity (emoji, title, time left, next step from checklist),
  everything else gone. Esc exits. It's Focus's calmer sibling (no timer
  mechanics, just "this is the only thing").
- **Evidence:** screenshots of all three load bands + One Thing mode desktop/
  mobile; move-to-tomorrow flow round-trips.
- **Done:** meter honest (uses real waking window 7–23), One Thing reachable
  from anywhere via NowBar.

## Phase 9 — Micro-interaction + mobile polish pass · DESIGN-SENSITIVE (Fable)
Sweep the seams the new features created + mobile daily-driver feel:
- Consistent press states (scale-98 taps), editor bottom-sheet slide-up on
  mobile, inbox swipe affordances if cheap (buttons acceptable), FAB no longer
  collides with install banner, dark-mode audit of every NEW surface from
  phases 1–8 (NowBar, celebration, capture, break, pick-card, meter, One Thing).
- **Evidence:** light+dark screenshot pairs of each new surface, mobile 375 px
  set, no horizontal scroll anywhere.
- **Done:** every new surface passes dark + mobile + reduced-motion.

## Phase 10 — QA, a11y, parity, ship (cheap-subagent friendly for the sweep)
- Full dogfood pass of every phase's feature with a fresh account.
- Keyboard-only walk of new flows; aria labels on all new controls; axe/
  accesslint pass on today/focus/inbox.
- Update `docs/plans/parity-checklist.md` + `node scripts/parity.mjs`,
  progress.md hand-off note.
- Gates: lint + typecheck + test + build. Commit, push, Coolify deploy,
  live-verify each phase's marquee feature on time.neima.me (screenshots).
- **Done:** all boxes above ticked, live URLs verified, progress note written.

---

## Execution rules
- Design-sensitive phases (1, 2, 4, 8, 9) are executed by Fable in the main
  loop — never delegated to cheap models. Phases 6 and 10's mechanical parts
  (server aggregates, tests, QA route sweep) may go to cheaper subagents.
- Tokens only — no new hex values. "Nothing here ever turns red" holds:
  overtime/full-day states use peach/butter, never danger.
- Every server mutation keeps If-Match/revision semantics; new REST surface
  (if any) gets zod + OpenAPI entries per ADR-002.
- Each phase: verify in real browser (desktop + 375 px) before ticking.
- Copy voice: gentle, forgiving, zero shame. No "overdue", no "failed",
  no guilt-red.
