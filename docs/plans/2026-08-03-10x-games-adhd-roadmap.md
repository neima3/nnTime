# 10× Push — New Games + ADHD Features + Parity + Polish (2026-08-03)

Goal (full objective, never shrink): keep developing Kairo like a 10x lead
developer — add more brain games (starting with a text-editing game where you
find errors in passages), add more ADHD-support features, keep web and iOS at
full feature/functionality parity, keep the app visually stunning and
production-ready. Every phase ships: gates green, committed, pushed, deployed
to time.neima.me, live-verified, documented in `docs/plans/progress.md`.

Grounding (repo state when written): Round 76 shipped. Arcade = 15 games on
both platforms (quick-tap, number-hunt, odd-one-out, color-clash, green-light,
emoji-match, memory-trail, digit-span, pattern-tiles, grammar-snap,
spell-check, letter-soup, time-feel, steady-breath, night-sky), pure logic in
`src/lib/games.ts` mirrored by `ios/App/Features/Play/PlayArcadeLogic.swift`
(both unit-pinned). Web 1,183 tests / iOS 379. Parity 89.74% web / 86.93% iOS
(`node scripts/parity.mjs`). Deploys via Coolify webhook on push to main;
verify exact-SHA CI + deployment drain + live `/api/health`.

## Progress tracker

- [x] Phase 1: "Proof It" editing game — web (shipped R77)
- [x] Phase 2: "Proof It" — iOS parity (shipped R78)
- [x] Phase 3: "Number Ladder" mental-math game — web + iOS (shipped R79; placed in "Hold it in mind" for section balance)
- [ ] Phase 4: Daily Three — choice-paralysis-free arcade rotation (web + iOS)
- [ ] Phase 5: Estimate Reality — time-blindness insight (web + API)
- [ ] Phase 6: Estimate Reality — iOS parity
- [ ] Phase 7: Hyperfocus guard — gentle overtime nudge (web + iOS)
- [ ] Phase 8: Visual polish sweep over everything new (DESIGN-SENSITIVE)
- [ ] Phase 9: Full QA + accessibility sweep, parity recompute, checklist
- [ ] Phase 10: Consolidation release — docs, handoff, release audit

## Phase 1 — "Proof It" editing game (web)

The user-requested game: each round shows one sentence in which exactly one
word is wrong (homophone, typo, tense slip, doubled word). Tap the wrong word.
8 rounds; score /8; feedback shows the fix and a one-line memory hook, in the
gentle GrammarSnap voice. No red-pen shaming — copy stays kind.

- Tasks: `PROOF_BANK` (40+ entries `{text, errorIndex, fix, why}` — every
  sentence must have exactly ONE defensibly wrong word; review each) + seeded
  round-selection logic in `src/lib/games.ts`; unit tests in
  `src/lib/games.test.ts` (bank integrity: errorIndex in range, fix differs
  from error word, no duplicate texts; seeded selection deterministic).
  Component `src/components/games/ProofIt.tsx` (GameShell + word-chip tap
  targets, celebrate() on new best, recordResult high /8), lazy-loaded card in
  `PlayClient.tsx` Wordplay section.
- Evidence: seeded-RNG browser play-through on :3456 (stub Math.random) —
  open game, tap wrong word, see feedback, finish a run; screenshots to
  `browser-qa/`. Full web gates. Ship + live-verify a round opens on prod.
- Done: game playable live; tests green; progress.md entry.

## Phase 2 — "Proof It" iOS parity

- Tasks: mirror bank + selection in `PlayArcadeLogic.swift` (transcription is
  cheap-subagent-friendly; verify by diff-count + seeded-parity unit tests in
  `PlayArcadeLogicTests.swift`); SwiftUI game view following the existing
  wave files' GameChrome pattern; card in `PlayView.swift` (bests key
  "proofit"); tour fixture coverage.
- Evidence: app-hosted unit tests (trust "Executed N tests"), main-thread
  gate, XCUITest tour or fixture screenshots. FULL web gates too — web
  contract tests grep iOS sources. Ship + docs.
- Done: 16/16 games both platforms; parity row updated if applicable.

## Phase 3 — "Number Ladder" (web + iOS)

Quick mental-math chain for the Sharp & fast mood: start at a seed number,
apply 6 shown steps (+7, ×2, −9…) one at a time against a 3-option choice
each rung; climb as far as you can. Short, dopamine-friendly, no time
pressure by default.

- Tasks: seeded ladder generator in `games.ts` (answers always unambiguous,
  options plausible ±small deltas, no negatives below zero unless flagged);
  tests; `NumberLadder.tsx`; iOS mirror + view + tests; cards both platforms.
- Evidence: seeded browser play + iOS gates as Phase 1/2. Ship + docs.
- Done: 17/17 games both platforms.

## Phase 4 — Daily Three (web + iOS)

ADHD choice-paralysis fix for a 17-game arcade: a "Today's three" strip atop
/app/play — three games picked deterministically from the date (seeded, all
moods represented over time), with a one-line reason ("a sharp one, a steady
one, a wordy one"). Purely local; no streaks, no guilt copy.

- Tasks: date-seeded pick function in `games.ts` (deterministic per local
  date, covers all games over a cycle, no repeats within a day) + tests;
  strip UI in PlayClient (DESIGN-SENSITIVE styling); same logic + strip in
  PlayView.swift via ArcadeLogic mirror + tests.
- Evidence: unit tests pin the rotation; browser + simulator screenshots of
  the strip; gates; ship + docs.
- Done: both platforms show the same three games for the same date/zone.

## Phase 5 — Estimate Reality (web + API)

Time-blindness support: Stats gains an "estimates vs reality" module — for
completed focus sessions, compare the activity's planned `durationMin` with
actual focus time; show the gentle pattern ("Writing usually takes you about
1.6× what you plan — plan 25, expect 40"), never as failure. Data exists in
planner_events/focus sessions; add a `/api/v1/stats` extension (zod) so iOS
can consume the same numbers.

- Tasks: server aggregation in stats service + schema + route tests; Stats
  page module (DESIGN-SENSITIVE); empty/low-data states ("not enough data
  yet — plan a few focus sessions").
- Evidence: route contract tests; browser screenshots (desktop + mobile,
  light/dark); gates; ship + live verify the module renders with real
  account data or honest empty state.
- Done: module live on /app/stats; API documented in schema.

## Phase 6 — Estimate Reality — iOS parity

- Tasks: consume the extended stats endpoint in the iOS Stats feature; same
  gentle copy; unit tests for the presentation math; fixture for tours.
- Evidence: iOS gates + simulator screenshot; full web gates (contract
  greps); ship + docs.
- Done: same numbers, same kindness, both platforms.

## Phase 7 — Hyperfocus guard (web + iOS)

Optional focus-session companion: when a running session passes a threshold
over its planned duration (default 2×, configurable in Settings → Focus),
show one calm, dismissible nudge ("You've been at this a while — still on
purpose?" with Continue / Wrap up). Off by default? No — ON by default with
one-tap disable, since unnoticed hyperfocus is the point; never interrupts
with sound in quiet hours.

- Tasks: web focus client timer check + nudge UI + setting + tests; iOS
  FocusView equivalent + setting + tests; setting syncs via the shared
  notificationPrefs blob both platforms already read.
- Evidence: unit tests on the threshold logic (pure, both platforms);
  browser play-through with a short fake duration; iOS fixture; gates;
  ship + docs.
- Done: nudge fires once per session at threshold on both platforms.

## Phase 8 — Visual polish sweep (DESIGN-SENSITIVE — Fable/Opus only)

- Tasks: review every surface this push touched (3 new game UIs, Daily Three
  strip, Stats module, hyperfocus nudge) against the design spec: tokens
  only, both themes, high-contrast + reduced-stimulation + dyslexia-font
  modes, mobile viewport, empty states, motion discipline. Fix everything
  found. NEVER delegate to cheap models.
- Evidence: before/after screenshots desktop + 390px mobile, light + dark +
  high-contrast; contrast probe on any new token pair; gates; ship + docs.
- Done: no raw hex, no off-spec spacing/type, all modes verified.

## Phase 9 — QA + accessibility sweep, parity recompute (cheap-subagent-friendly checks)

- Tasks: full-surface pass over the new features (keyboard nav, focus
  states, VoiceOver labels on iOS, reduced-motion, error paths, offline
  behavior where relevant); fix findings; update
  `docs/plans/parity-checklist.md` rows + `node scripts/parity.mjs`;
  update AGENTS.md if commands/structure changed.
- Evidence: findings list with repro + fix commits; recomputed parity ≥
  current (89.74/86.93); all gates; ship + docs.
- Done: zero known a11y regressions; checklist current.

## Phase 10 — Consolidation release

- Tasks: final exact-SHA CI green, deploy drained, live health + spot-check
  every new feature on time.neima.me (and simulator for iOS); progress.md
  round entry summarizing the whole push; refresh
  `docs/plans/kairo-agent-prompt.md` pointers if stale; leave handoff notes.
- Evidence: live URLs exercised; screenshots; the tracker above fully
  ticked.
- Done: everything above shipped and provable, or explicitly documented as
  blocked with reason (only user-gated items may remain: 7B/8B).

## Execution rules (bind all phases)

- Each phase runs the FULL web gates (`pnpm lint && pnpm typecheck &&
  pnpm test && pnpm build`) — web contract tests grep iOS sources — plus
  iOS gates (`./scripts/ios-main-thread-gate.sh`, xcodegen after adding
  Swift files) when iOS changed. Trust "Executed N tests", not SUCCEEDED.
- Ship = commit (Co-Authored-By trailer) + push + exact-SHA CI green +
  Coolify drain + live verification + progress.md entry.
- Design/visual work: Fable in main loop (or Opus subagent if session isn't
  Fable). Mechanical work (bank transcription, test scaffolds, QA checklists):
  cheap subagents, verified by the main loop before ticking boxes.
- Tokens only (`src/app/globals.css`); no Inter; no pure #fff/#000. Prod DB
  is real — no destructive tests against prod.
