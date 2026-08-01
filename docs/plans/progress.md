# Progress log

## 2026-08-01 — Round 40: other-agent audit + release hardening (Codex)

- **Range independently reviewed.** Audited `a22fc59..73c89dd`: 80 files and
  8,787 insertions spanning R24–R39 web/native arcade work, accessibility
  preferences, dependency and DB-test hardening, authenticated widget actions,
  and Live Activity controls. The full baseline was green before edits.
- **Two production issues fixed.** Green Light now rejects taps during its
  blank inter-stimulus gap instead of scoring them against an expired signal.
  Timeline activities are labelled focusable groups rather than ARIA buttons
  containing other buttons, so checklist/focus/complete actions remain distinct
  to assistive technology while keyboard drag/resize/edit remains intact.
- **Tracker truth repaired.** The Phase 8A and D07 text now reflects R38/R39's
  server-confirmed widget completion and app-process Live Activity controls;
  it no longer claims those mutations are blocked.
- **Evidence.** Release details, exact test counts, CI/deploy SHA, and live
  probes are recorded in the Round 40 plan and release postscript once the
  push and production rollout complete.
- **CI contract follow-up.** The first push (`8056d55`, run `30696976599`)
  correctly failed because `calibration-hint.spec.ts` still looked for the old
  timeline `button` role. Its retry then exposed a second weakness: failed
  assertions skipped probe cleanup and created duplicate text. The E2E now
  asserts the new `group` role, names and scopes each probe per attempt, and
  deletes it in `finally`; the complete local Playwright suite passed 12/12.

## 2026-08-01 — Round 39: Live Activity pause/complete controls (Fable)

- **H04 unblocked.** The Focus Live Activity's "Open Kairo to adjust"
  links became real controls: Pause/Resume + Done on the lock-screen
  banner, the same pair plus a compact open-app link on the Dynamic
  Island's expanded bottom. `LiveActivityIntent` runs in the **app
  process**, so the buttons remote-control the exact focus machinery the
  Focus screen uses — no widget-side transport at all.
- **Architecture.** `ToggleFocusIntent`/`CompleteFocusIntent` (Shared)
  dispatch through `FocusIntentBridge`, a handler registry the app fills
  at launch and the render-only widget process leaves empty.
  `FocusRemoteControl` (App) hydrates cookies from the keychain envelope
  when a background launch skipped scene bootstrap, fetches the active
  session, no-ops stale taps (`command(forState:desiredPaused:)` returns
  nil when the session is already where the button wanted it), transitions
  with the session's revision, then reconciles every
  `Activity<FocusAttributes>` for that session — update on pause/resume,
  end on complete, mindful minutes recorded exactly like the in-app
  button. Failures change nothing; an on-screen FocusView re-hydrates via
  `kairoFocusMutatedExternally`.
- **Contract kept honest.** The glance audit now requires ≥2 focus-intent
  buttons on the Live Activity, LiveActivityIntent conformance, bridge
  dispatch, and no transport in intent files (6 contract tests). The
  manual-API adoption gate caught an untyped `session` binding in the new
  executor before push — full local web gates on an iOS round, exactly
  the R38 lesson.
- **Evidence.** 377 iOS unit tests (3 new: intent→bridge dispatch and the
  stale-tap policy matrix), main-thread gate, web 1016 tests + lint +
  typecheck + build. Parity: H04 0.5 → 1.0, iOS 86.36% → **86.93%**.

## 2026-08-01 — Round 38: complete-from-widget via a secure session bridge (Fable)

- **H03 unblocked.** The Next Up widget's done button had been withheld
  until the extension could authenticate its own writes. The Better Auth
  cookie envelope now lives in the `group.me.neima.kairo` keychain access
  group (app-group ids are valid keychain groups on iOS — no new
  entitlements or signing changes); legacy default-group items migrate on
  first read so no one re-signs-in. `SessionCookieRules` in `Shared/` is
  now the single definition of cookie filtering + scope hashing for app
  and widget.
- **Network-first by contract.** `WidgetCompletionService` PATCHes
  `/api/v1/activities/{id}` (If-Match, Idempotency-Key, explicit Cookie
  header on a no-cookie-jar ephemeral session, ADR-002 body with
  `editScope:"this"` and `completedAt: null` on uncomplete) and only then
  updates the day cache — including the server's new revision, so a
  follow-up toggle doesn't 409 against a stale one. Expired session and
  cache/session scope mismatch fail before any request leaves the device.
  The rejected optimistic-cache failure mode is structurally impossible.
- **UI.** `CompleteBlockIntent` (App Intent, widget process) + circle done
  buttons on the small card and large list rows — rendered only when the
  cached row carries full identity; legacy rows stay read-only. A thrown
  intent leaves the timeline untouched and WidgetKit rolls the button
  back. VoiceOver reaches the button as a custom action on the combined
  card element.
- **Evidence.** 374 iOS unit tests (10 new: keychain group + migration
  semantics against an in-memory client modeling access groups — the
  simulator keychain ignores them — and the service's contract/rollback
  against a stub URLProtocol, including scope-mismatch-sends-no-request
  and 409-leaves-cache-untouched). Main-thread gate passed; web lint
  clean (no web source changes). Parity: H03 0.5 → 1.0, iOS 85.80% →
  **86.36%**.
- **Known limitation (documented).** Repeat toggles on a server-split
  recurring occurrence can 409 until the app next reconciles — the widget
  throws, changes nothing, and the app's refetch resolves it.
- **Ship postscript — two CI truths surfaced.** (1) The glance-surface
  contract test still encoded "the widget target is read-only", so the
  bridge commit correctly failed CI; the contract was retargeted to the
  invariant that replaced it (every intent button routes through
  CompleteBlockIntent; the service sends If-Match + Idempotency-Key on a
  no-cookie-jar transport; a new regression case moves the cache write
  ahead of the 2xx gate and must be caught). Lesson absorbed into the
  round pipeline: web contract tests grep iOS sources — run the full web
  suite even for iOS-only commits. (2) Chasing the recurring vitest
  teardown flake exposed that the DB test harness shelled to psql via
  the Homebrew /tmp socket, so **every DB integration test had been
  silently skipping in CI since Phase 1B** (the skip-noise at worker
  teardown was the flake's trigger). CREATE/DROP now go through the same
  postgres-js TCP path as the data connections: CI build-test went from
  963 passed + 27 skipped to **993 passed, 0 skipped** — first run ever
  with the DB integration suite live in CI. Final release: `252952b`,
  run `30686340667` success on the exact SHA, deploy drained, live
  health all `ok`.

## 2026-08-01 — Round 37: arcade lazy-loading — games leave the first-load bundle (Fable)

- **What changed.** All fifteen games in `PlayClient.tsx` moved behind
  `next/dynamic` with a calm full-screen "opening…" loading state; the
  Grammar Snap and Spell Check quizzes moved into self-contained
  wrappers (`games/GrammarSnap.tsx`, `games/SpellCheckGame.tsx`) so
  their 80+ bank items ship in the lazy chunk instead of the grid's
  first load. Turbopack quirk: `next/dynamic` options must be an inline
  object literal — a shared `opts` const fails the build.
- **Measured.** Live `/app/play` initial script payload (sum of gzipped
  transfer for every `/_next/static/*.js` referenced by the page HTML):
  **before 15 chunks / 246,623 B → after 14 chunks / 236,287 B**
  (−10,336 B gzipped, −4.2%); game code + quiz banks now arrive only on
  tap.
- **Verified.** Dev: Quick Tap intro and a full Grammar Snap
  question→answer cycle through the dynamic boundary. Prod (post-
  deploy): all 15 cards render on time.neima.me and Grammar Snap opens
  live — bank chunk loaded on tap, question 1 of 8 rendering.
- **Release.** Commit `27395ac`; run `30683597117` first attempt failed
  on a Vitest worker-teardown race (`EnvironmentTeardownError: Closing
  rpc while "onUserConsoleLog" was pending`, amplified by a runner
  where the Postgres service socket never came up — all 964 tests had
  passed; vitest already at latest 4.1.10, no code fault); failed-job
  rerun concluded **success on the exact SHA** (build-test,
  native-contract, e2e). Deploy drained; live `/api/health` all `ok`.

## 2026-08-01 — Round 36: 8C standing hardening — deps patched, restore re-proven (Fable)

- **Dependency audit.** `pnpm audit` surfaced **16 advisories (9 high)**.
  Next.js 16.2.10 → 16.2.12 closed nine — including a middleware/proxy
  bypass and two Server-Action SSRF highs on the production app. Targeted
  same-major overrides lifted the transitive pins (postcss ≥8.5.18,
  sharp ≥0.35.0, brace-expansion pinned to exactly 1.1.17 after a naive
  `>=` range briefly let pnpm jump minimatch@3's dep to the ESM-only 5.x
  line — caught and corrected before commit). **One accepted moderate
  remains:** esbuild ≤0.24.2 inside drizzle-kit's abandoned
  `@esbuild-kit` loader — the advisory concerns esbuild's dev server,
  which that loader never opens; dev-tooling only.
- **Gates on the framework bump.** Lint, typecheck, **1012 unit tests**,
  production build, and the production-mode E2E suite (**11 passed, 1
  legitimate skip** — the calibration spec's own near-midnight guard, in
  its designed window).
- **Backup + restore drill (SEC-07).** The off-host Jul 29 prod backup's
  SHA-256 matches the recorded value exactly (mode 0600). A full
  `pg_restore` into an isolated scratch DB succeeded: 68 public tables,
  9 migration rows (0000–0008, consistent with a pre-0009 predeploy
  artifact); the scratch DB was dropped and no planner contents were
  inspected.
- **Release.** Commit `17ec675`; GitHub Actions run `30682505132`
  concluded `success` on the exact SHA; deploy drained; live
  `/api/health` all `ok` on Next 16.2.12.

## 2026-08-01 — Round 35: token-level WCAG audit — one sub-AA pair fixed (Fable)

- **Method.** Probe-div contrast measurement of the arcade's real token
  pairs (category inks, chips, found-states, success feedback) across
  all four theme modes, computed with actual WCAG luminance math in the
  live page. (First attempts measured mid-`transition-colors`
  interpolation and the app's own theme manager fought root-class
  toggles — container-scoped token probes sidestepped both.)
- **Results.** Category inks on surface: 5.99–6.58 light, 8.46–10.4
  dark, and **9.17–13.75 in the high-contrast modes** — the toggle
  delivers its AAA promise on the arcade. Found-cells are disabled
  (WCAG-exempt) and strengthened under high contrast anyway. One genuine
  finding: light `--success` (#23805c) measured **4.06 on success-soft**
  (quiz correct-answer text) and 4.43 on canvas (score counters) — under
  the 4.5 AA line for normal text, a pre-existing pair the arcade
  inherited.
- **Fix.** Light `--success` → `#1e7354`: 4.82 on success-soft, 5.69 on
  surface, 5.26 on canvas (verified live post-HMR at 4.82); the
  inverse-on-success pairing improves too. Dark and high-contrast values
  were already compliant and are untouched. iOS `kSuccess` mirrors the
  same light value so the platforms stay token-identical; the iOS gate
  re-passed (**364 executed, 0 failures**).
- **Release.** Commit `2a867e2`; GitHub Actions run `30681484144`
  concluded `success` on the exact SHA; deploy drained; live
  `/api/health` all `ok`.

## 2026-08-01 — Round 34: reduced stimulation stills the arcade (Fable)

- **The gap.** An audit of the arcade against the app's own Reduced
  stimulation toggle found the suppression list covered the literal
  `animate-pulse`/`ping`/`bounce` utilities but not Tailwind's
  `motion-safe:` variant — a differently named class — so Night Sky's
  next-star kept pulsing for exactly the users who asked for calm.
- **The fix.** `globals.css` now suppresses the escaped
  `motion-safe\:animate-pulse` class too (settled 0.55 opacity), keeping
  the OS-level `prefers-reduced-motion` gating intact. Verified by
  computed styles in a live tracing round: animation `pulse` → `none`
  with the toggle class applied. Native games audited clean: no
  decorative motion or already gated on `KairoPrefs.reducedStimulation`.
- **Release.** Commit `50cb4e4`; GitHub Actions run `30680214316`
  concluded `success` on the exact SHA; deploy drained; live
  `/api/health` all `ok`.

## 2026-08-01 — Round 33: Pattern Tiles, simultaneous spatial recall (Fable)

Roadmap: `docs/plans/2026-08-01-round33-pattern-tiles.md`. (Round 32 was
the docs consolidation: AGENTS.md refreshed to post-mock reality and
`docs/plans/UNBLOCK-7B-8B.md` added — commit `a483cc5`.)

- **What shipped.** The fifteenth game and Hold it in mind's fourth: a
  handful of tiles flash together on a 4×4 grid, hide, and get tapped
  back in any order. Clean recalls grow the pattern (3 → the nine-tile
  cap); a miss kindly re-reveals the answer before the end state; best =
  largest pattern held. Shared seeded draw contract pinned by tests on
  both platforms.
- **Evidence.** Web: a precomputed seeded draw let the run be played
  exactly — the predicted tiles (10/13/14) completed the pattern and it
  grew to four, then a deliberate miss produced the kind reveal and
  "Pattern of 3" with the new-best chip. iOS: the tour proved memorize →
  recall → guaranteed terminal outcome, 1/1, screenshots inspected under
  ignored `browser-qa/round33-pattern-tiles/ios/` (the memorize phase
  renders three iris tiles exactly as designed).
- **Gates.** Web **98 files / 1012 tests** + production build; iOS
  main-thread gate (**364 executed, 1 expected skip, 0 failures**);
  release preflight passed.

**Release state:** shipped and live-verified. Web commit `b23b212` and
iOS commit `65635ef1b532bde8f03c0609c005276489646e47` pushed to `main`.
GitHub Actions run `30679267087` on the exact SHA concluded `success`.
The webhook Coolify deployment drained, live `/api/health` returned all
checks `ok`, and the production `/app/play` render contains Pattern
Tiles.

## 2026-08-01 — Round 31: Letter Soup, a gentle unscramble (Fable)

Roadmap: `docs/plans/2026-08-01-round31-letter-soup.md`.

- **What shipped.** The fourteenth game and Wordplay's third: eight
  everyday words per run, seeded-scrambled and rebuilt by tapping
  letters into slots. Kindness is structural: the 46-word bank is
  curated to be anagram-safe (no entry shares letters with a common
  English word — a unit-tested invariant on both platforms), wrong
  builds hand the letters back after a soft flash, and "Show me" reveals
  without credit or shame. Shared logic in `src/lib/games.ts` ↔
  `ArcadeLogic` with pinning tests including the never-original-order
  scramble and its rotation fallback.
- **Evidence.** Web: solved "travel" from a live scramble, exercised
  "Show me" (advance, no credit), and a wrong build ("iborn" for robin)
  that flashed and returned all letters — three paths proven in a real
  browser. iOS: the tour proved the round header, slots/tiles render,
  and the reveal → no-credit advance (1/1, screenshots inspected under
  ignored `browser-qa/round31-letter-soup/ios/`).
- **Gates.** Web **98 files / 1008 tests** + production build; iOS
  main-thread gate (**361 executed, 1 expected skip, 0 failures**);
  release preflight passed.

**Release state:** shipped and live-verified. Web commit `f632d1b` and
iOS commit `752485c9ae51f10f9451c22a2385dee6b08f8fac` pushed to `main`.
GitHub Actions run `30677738572` on the exact SHA concluded `success`.
The webhook Coolify deployment drained, live `/api/health` returned all
checks `ok`, and the production `/app/play` render contains Letter Soup.

## 2026-08-01 — Round 30: full-surface quality sweep — clean (Fable)

First full sweep since Round 12, after six feature rounds (24–29).

- **Method.** A fresh synthetic tenant on the local dev server
  (`qa-r30-…@kairo.test`), seeded with a believable five-block day
  (varied categories and energies) plus two inbox tasks; then **39
  captures** — 13 routes (every app surface + landing) × desktop-light /
  desktop-dark / mobile-390 — each with console, failed-request, and
  horizontal-overflow checks. Script and evidence under ignored
  `browser-qa/round30-sweep/` (`r30-sweep.mjs`, `report.json`).
- **Result: zero defects.** No horizontal overflow on any capture, no
  real console errors, no failed requests except the known sweep-only
  artifact: better-auth's own limiter returning 429 on `get-session`
  under 39 fresh contexts in ~3 minutes — the exact behavior Round 12
  recorded and hardened UserMenu against (an errored probe never claims
  signed-out). Not user-reachable.
- **Design review.** Today (desktop + mobile, live now-line and
  past-block dimming), Week dark (tinted blocks, intentions), Month
  (today ring + dots), Stats (garden seed, soft streak, mood), the
  13-game sectioned arcade in dark, Settings dark, and the landing on
  mobile were all visually inspected: tokens, spacing, and states hold
  everywhere. No fixes required — the finding IS the record: six feature
  rounds landed with no visual, console, or layout regressions.

**Release state:** docs-only round; no code changed.

## 2026-08-01 — Round 29: Night Sky, a wind-down constellation trace (Fable)

Roadmap: `docs/plans/2026-07-31-round29-night-sky.md`.

- **What shipped.** The arcade's thirteenth game and Slow down's third:
  five invented constellations traced star by star with lines appearing
  as you go — no timer, no score, no failure; the only number kept is a
  lifetime "skies traced" counter. The point sets are one shared
  contract (web `CONSTELLATIONS` ↔ iOS `ArcadeLogic.constellations`),
  pinned by unit tests on both sides; iOS gains
  `PlayScores.recordCount` for lifetime counters.
- **Evidence.** Web: a full seeded trace of The Kite in a real browser —
  progressive lines, the completion state, and the counter chip ("1
  skies traced") on the card. iOS: a dark-mode tour traced a complete
  sky (The Door) to its completion state, 1/1, screenshots inspected
  under ignored `browser-qa/round29-night-sky/ios/` — the dark render
  reads as an actual night sky.
- **Gates.** Web **98 files / 1003 tests** + production build; iOS
  main-thread gate (**358 executed, 1 expected skip, 0 failures**);
  release preflight passed.

**Release state:** shipped and live-verified. Web commit `e4143ee` and
iOS commit `1f688e9eb52d05941d03e27eb7790887acdbc9fc` pushed to `main`.
GitHub Actions run `30675927901` on the exact SHA concluded `success`
(including the e2e suite with the Round 28 zone fix in place). The
webhook Coolify deployment drained, live `/api/health` returned all
checks `ok`, and the production `/app/play` render contains Night Sky.

## 2026-07-31 — Round 28: the Daily Brief lands on native Today (Fable)

Roadmap: `docs/plans/2026-07-31-round28-daily-brief-ios.md`.

- **What shipped.** The web's Smart Daily Brief ported to iOS with its
  contract pinned: a warm butter morning card under the Today header —
  greeting tier ("Still up" / "Good morning" / "Hello"), "N things on
  today, M already done" (or "Nothing scheduled yet — a blank, gentle
  day."), "First up · emoji title at time", and the learned focus-peak
  tip reusing the peak-hour insight Today already loads. Morning-only,
  today-only, dismissible for the day; absent on read-only cached days.
- **Evidence.** `DailyBriefPolicyTests` pin the gate, greeting tiers, and
  summary copy to `src/components/DailyBrief.tsx`. The Today fixture pins
  a 9am hour and resets dismissal, and the tour passed **2/2** (brief
  show → dismiss-for-the-day, plus the Round 27 low-battery journey
  re-proven on the same state). Screenshots inspected under ignored
  `browser-qa/round28-daily-brief/ios/`.
- **Gates.** iOS main-thread gate passed (**355 executed, 1 expected
  skip, 0 failures**) plus `pnpm ios:release:preflight`. No web files
  changed.

- **CI found a real (pre-existing) nightly flake — root-caused and
  fixed.** The `221e232` run's e2e job failed at 23:31 UTC: the auth
  setup project signed up WITHOUT the suite's America/New_York timezone
  mock, so the shared account's planning zone followed the runner clock
  (UTC in CI) while `dayUrl` also sliced dates in UTC. In the nightly
  23:20–24:00 UTC window, calibration-hint's "40 minutes from now" probe
  rolled onto the account's next planning day — colliding with
  core-loop's "isolated" day ("all 1 done" read 1 of 2; the retry's
  duplicate title then hit strict mode) while the probe's own same-day
  hint went missing. Round 28's iOS-only commit merely exposed it by
  being the day's first push after 23:20 UTC. Fix `5fa2b9e`: the setup
  project signs up under the suite zone and `dayUrl` names days in it.
  The full local suite passed **12/12 inside the former flake window**.

**Release state:** iOS commit `221e232` pushed to `main` (its CI e2e
failure was the pre-existing nightly zone flake above — build-test and
native-contract were green, and the deployed web code was byte-identical
to the previously verified SHA; live health stayed `ok`). Flake fix
`5fa2b9e33eaa8025861f04ef9ad2381ad3a1a573` pushed; GitHub Actions run
`30674088327` on that exact SHA concluded `success` — with the e2e job
executing around midnight UTC, squarely in the former flake territory.
The deploy queue drained and live `/api/health` stayed all `ok`.

## 2026-07-31 — Round 27: low-battery day lands on native Today (Fable)

Roadmap: `docs/plans/2026-07-31-round27-low-battery-ios.md`.

- **The gap.** A feature sweep found the web's low-battery day and daily
  brief had no iOS counterparts; low-battery day (the higher-empathy,
  fully client-local one) shipped this round with exact web semantics.
- **What shipped.** Energy decodes from the generated day adapter into
  `Activity`/`DayBlock`. Today gains a per-date, device-local
  "Low battery?" chip (today only, absent on read-only cached days):
  when on, pending high-energy blocks dim to 55% with a visible "heavy"
  tag, a softened note appears ("Doing less on purpose still counts as a
  plan."), and Pick-for-me demotes heavy picks / slightly prefers light
  ones within each kind — `LowBatteryDay.pickRank` mirrors the web
  picker's weights, pinned by unit tests.
- **Two real defects caught by the deterministic tour.** (1) The
  combined block accessibility label silently swallowed the "heavy" tag
  — VoiceOver heard nothing; the label now appends ", heavy for a
  low-battery day". (2) The tour fixture's date key shifted across
  relaunches because an early load could compute the date in UTC before
  bootstrap set the planning zone — the debug fixture now pins its zone,
  and `LowBatteryDay.set` forces a defaults flush so an immediate app
  kill cannot drop the toggle.
- **Evidence.** `KairoRound27LowBatteryTour` passed **1/1** on the new
  `-kairoTodayFixture` (mutable mixed-energy Today): off state, toggle →
  dim + tag + note, relaunch persistence, and a clean off state at the
  end. Screenshots inspected under ignored
  `browser-qa/round27-low-battery/ios/`.
- **Gates.** iOS main-thread gate passed on the final state
  (**352 executed, 1 expected skip, 0 failures**) plus
  `pnpm ios:release:preflight`. No web files changed this round.

**Release state:** iOS commit
`224a84ff1817dd6a79e6e8a52f6ff2ffc484301e` pushed to `main`. GitHub
Actions run `30671403192` on the exact SHA concluded `success`. The
webhook Coolify deployment drained (web code unchanged this round) and
live `/api/health` returned all checks `ok`. Native low-battery behavior
is simulator-proven; a physical-device pass remains part of the standing
7B device checklist.

## 2026-07-31 — Round 26: Green Light + the post-focus brain break (Fable)

Roadmap: `docs/plans/2026-07-31-round26-green-light.md`.

- **Green Light on both platforms.** The classic go/no-go: twenty-four
  signals at 750ms + 350ms, tap the greens 🟢, let the reds 🛑 pass —
  response inhibition as honest play. The shared sequence contract
  (~30% no-go, never three no-gos in a row, first two always go) lives in
  `src/lib/games.ts` and `ArcadeLogic` with seeded tests on both sides.
  Score = right calls out of 24 (hits + correct rejections); the arcade
  is now **twelve games**.
- **The first planner↔arcade integration.** The focus "Session done —
  what now?" menu on web and iOS now offers **Play a brain break**: web
  routes to `/app/play`, iOS presents the arcade in a sheet without
  leaving Focus. Post-session transitions — the classic ADHD cliff —
  now have somewhere soft and structured to land.
- **Web evidence.** A seeded hands-free Green Light run scored exactly
  the mathematically predicted **15/24** (all correct rejections, all
  misses), proving the stimulus loop, scoring, and end state; the
  new-best chip recorded. The focus nudge is covered by a new E2E
  assertion that completes a real session, clicks the button, and lands
  on the arcade — the local Playwright focus suite passed **4/4**.
- **Local E2E unblock.** The dev server rejected its own origin
  ("Invalid origin" on signup) because `.env.local` lacked
  `BETTER_AUTH_URL=http://localhost:3456` — the exact configuration
  `auth-capabilities.test.ts` documents. Added (git-ignored); local
  E2E against the :3456 dev server works again.
- **iOS evidence.** `KairoRound26ArcadeTour` passed **2/2**: Green Light
  intro → running signal ("1 of 24" with a live green), and the
  `-kairoFocusDoneFixture` completion menu → nudge tap → arcade sheet.
  Screenshots inspected under ignored `browser-qa/round26-green-light/ios/`.
- **Gates.** `pnpm lint`, `pnpm typecheck`, **98 files / 1000 web
  tests**, production build, `pnpm ios:release:preflight`, and the iOS
  main-thread gate (**349 executed, 1 expected skip, 0 failures**) all
  passed. Parity checklist intentionally unchanged.

**Release state:** shipped and live-verified. Web commit `fa26dd6` and
iOS commit `758ee2dbd96e052d5d1e962bfdf35e4a996f0d43` pushed to `main`.
GitHub Actions run `30668937683` on the exact SHA concluded `success`.
The webhook Coolify deployment drained; live `/api/health` returned all
checks `ok`. The production `/app/play` client lists all **twelve**
games, and a real production browser session started Green Light and
reached "4 of 24" with a clean console. The signed-out focus page cannot
show the completion menu, so the live nudge claim rests on the E2E flow
(local 4/4) and CI's production-mode suite on the exact SHA.

## 2026-07-31 — Round 25: eleven-game arcade in four moods (Fable)

Roadmap: `docs/plans/2026-07-31-round25-arcade-wave5.md`.

- **Two new games on both platforms.** Odd One Out (a near-twin emoji
  impostor hides in a grid growing 3×3 → 5×5 over eight rounds; overall
  tenths-of-a-second time is the only score; wrong taps flash and cost
  time, never points) and Digit Span (digits flash for 900ms + 350ms per
  digit, an on-screen keypad takes them back, one digit added per clean
  recall, no immediate-repeat digits). Pure logic in `src/lib/games.ts`
  is mirrored by `ArcadeLogic` on iOS; both sides carry seeded-RNG unit
  tests pinning the shared contract.
- **The arcade got structure.** Eleven games now read in four moods —
  Sharp & fast, Hold it in mind, Wordplay, Slow down — as labeled
  sections on web (semantic `<section>`s, section h2s, card headings
  demoted to h3) and iOS (uppercase headers with the combined
  accessibility header trait). Personal-best chips carried over.
- **Web evidence.** Both games were played end-to-end in a real browser:
  Odd One Out through all eight rounds across all three grid sizes to a
  new-best end screen; Digit Span through a correct 3-digit recall,
  level-up to four, and a deliberate miss showing "Span of 3" plus the
  new-best chip. Playwright captures (desktop/mobile × light/dark) report
  zero horizontal overflow, under ignored `browser-qa/round25-arcade/`.
- **iOS evidence.** `KairoRound25ArcadeTour` passed **2/2** on the
  offline fixture: all four section headers, all eleven cards, Odd One
  Out round 1 with live clock (light and dark), Digit Span memorize →
  keypad entry registering "1 of 3". Screenshots exported from the
  `.xcresult` and inspected under `browser-qa/round25-arcade/ios/`.
- **Gates.** `pnpm lint`, `pnpm typecheck`, **98 files / 996 web tests**,
  production build, `pnpm ios:release:preflight`, and the iOS main-thread
  gate (**346 executed app-hosted tests, 1 expected skip, 0 failures**)
  all passed. Scripted parity unchanged and above gate (web **89.74%**,
  iOS **85.80%**); the arcade remains a beyond-Tiimo extra.

**Release state:** shipped and live-verified. Web commit `aaf3ee7` and iOS
commit `8374219f63b13dfbdbc61921d5aba3e605831015` pushed to `main`.
GitHub Actions run `30666345435` on the exact SHA concluded `success`
(build-test, e2e, macOS native-contract). The webhook Coolify deployment
built and drained; the `kairo` app reports `running:healthy` and live
`/api/health` returned all checks `ok`. The live `/app/play` server render
contains the four mood sections plus Odd One Out and Digit Span, and a
real production browser session opened Odd One Out and reached "round 1
of 8" with a clean console. The web unit count above (996) and the iOS
count (346 executed, 1 expected skip, 0 failures) were both re-verified
on the committed code state.

## 2026-07-31 — Round 24: nine-game brain-breaks arcade on both platforms (Fable)

Roadmap: `docs/plans/2026-07-31-round24-brain-games.md`.

- **Three new web games.** Focus Finder (5×5 Schulte grid, tap 1→25, timed
  to tenths, wrong taps flash danger and only cost time), Memory Trail
  (nine-tile glowing path, starts at 3 steps, grows each clean run, best =
  longest completed trail), and Color Clash (12 Stroop rounds, ~1 in 4
  congruent, tap the ink not the word). Pure logic in `src/lib/games.ts`
  with seeded-RNG unit tests; personal bests stay in localStorage;
  celebration on new bests; success/danger tokens for feedback; the arcade
  keeps its honest no-brain-training framing.
- **iOS reaches full game parity (3 → 9).** Emoji Match, Grammar Snap,
  Spell Check, Focus Finder, Memory Trail, and Color Clash join Time Feel,
  Quick Tap, and Steady Breath. The quiz engine ports the web contract
  whole: 66 grammar + 16 spelling bank items transcribed verbatim into
  `QuizBank.swift` (subagent-transcribed, count/answer/topic-validated),
  topic-spread picker (cap 2 per topic, second-pass fill), tricky-ones
  practice offered at 3+ misses with per-prompt redemption, and
  fresh-run-only bests. `PlayArcadeLogic.swift` mirrors `src/lib/games.ts`
  and `PlayArcadeLogicTests` pins both platforms to the same behavior
  (grids, trails, Stroop rounds, deck pairing, picker spread, miss
  memory). Play cards now show personal-best chips; the shared game chrome
  gains a subtitle and an accessibility-labeled exit control (the tour
  caught the icon-only exit button having no VoiceOver label — fixed).
- **Web evidence.** All three new games were played end-to-end in a real
  browser (Color Clash full 12 rounds with verdict flashes and new-best
  chip; Memory Trail failure path, seeded success path through a
  4-length trail, and best recording; Focus Finder full 1→25 sweep with
  wrong-tap flash and live timer). Playwright captures at 1440×1000 and
  390×844 in light and dark report `clientWidth == scrollWidth` (no
  horizontal overflow); dark-mode ink tokens verified on the arcade and
  in-game. Ignored evidence under `browser-qa/round24-brain-games/`.
- **iOS evidence.** Deterministic `KairoRound24ArcadeTour` on the offline
  fixture account passed **2/2** on an iPhone 17 Pro simulator: all nine
  cards, Focus Finder find-1→find-2 advance, Memory Trail playback →
  your-turn phase, Color Clash round + verdict, Grammar Snap question
  render, in light and dark. Screenshots exported from the `.xcresult`
  and visually inspected under ignored `browser-qa/round24-brain-games/ios/`.
- **Gates.** `pnpm lint`, `pnpm typecheck`, **98 files / 989 web tests**,
  production build, OpenAPI sync check, and `pnpm ios:release:preflight`
  passed. The iOS main-thread gate passed with **340 executed app-hosted
  tests, 1 expected skip, 0 failures** and no Main Thread Checker output.
  Scripted parity is intentionally unchanged (web **89.74%**, iOS
  **85.80%**, both above gate) — the arcade is a beyond-Tiimo extra with
  no checklist rows.
- **No server surface changed.** Games are fully client-local; no API,
  schema, or migration work; nothing in this round touches production
  planner data.

**Release state:** shipped and live-verified. Web commit `d720de2` and iOS
commit `025ce35c7fb14c6ef59a0ff51d0418a4ceef8570` were pushed to `main`.
Coolify deployment `hlc4mgcd67ei70uhsx4h1qnx` (webhook-triggered by the
push) built that exact SHA and reached `finished`; the `kairo` app reports
`running:healthy`. Live `/api/health` returned 200 with migrate, database,
AI, and scheduler all `ok`; CSP and HSTS are present on `/`. The live
`/app/play` server render contains all nine cards, and a real browser
session on https://time.neima.me played Color Clash interactively (correct
answer scored, "round 2 of 12 · 1 right") with a clean console. Live
Playwright captures at 1440×1000 and 390×844, light and dark, report zero
horizontal overflow (ignored under `browser-qa/round24-brain-games/live/`).
GitHub Actions run `30664075202` on the exact SHA concluded `success`
with all three jobs green: `build-test`, `e2e`, and the macOS
`native-contract`.

**Environment note:** the Claude Code iOS Simulator panel could not attach
on this Mac because the active developer directory is not Xcode — fix with
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (needs
password). Simulator evidence was collected via `xcodebuild`/XCUITest
instead, which work regardless.

## 2026-07-29 — Round 23: cross-platform Google authentication code (Codex)

Roadmap:
`docs/plans/2026-07-29-round23-google-auth.md`.

- **Fail-closed web identity.** Commits `7c73328..a3f9df2` add a three-value
  Google provider contract, exact `{ magicLink, apple, google }` capability
  response, branded sign-in/sign-up controls, explicit Settings linking,
  overlapping-request guards, and allowlisted redirect recovery. Google remains
  absent when any server value is blank; implicit same-email merging remains
  disabled.
- **Native transport and UI.** Commits `1dfb925..b9edbaa` pin
  GoogleSignIn-iOS 9.0.0, route refreshed ID tokens through Better Auth, preserve
  valid sessions on expected provider/link errors, fence stale cookies across
  auth generations, route the reversed-client callback, and ship polished
  sign-in/linking states. The deterministic iPhone 17 Pro fixture tour retained
  ten non-failure screenshots for unavailable, ready, loading, error,
  duplicate-account, success, dark, linking, and linked states under ignored
  `browser-qa/round23-google-auth/`; follow-up fixtures prove account-link
  hydration.
- **Privacy and parity truth.** Apple Reminders F02 is now `excluded | 0`.
  EventKit has no read-only Reminders authorization, and Kairo will not request
  full read/write access for a one-way import. Calendar import remains a
  separate feature and is not claimed as equivalent. The privacy policy now
  distinguishes basic Google identity/account linkage from separately
  authorized Google Calendar data and records that Kairo requests no Apple
  Reminders access.
- **Release contract.** Deployment and iOS runbooks now bind the Web and iOS
  Google Cloud clients, production callback, bundle ID, reversed URL scheme,
  three mirrored Coolify variables, public native build settings, fail-closed
  release validation, and real browser/device proof. Phase **8B remains
  unchecked**: code-complete is not release-complete.
- **Task 4 gates.** Focused privacy/release/docs coverage passed **4 files /
  31 tests**. `pnpm lint`, `pnpm typecheck`, **98 web files / 979 tests**,
  `pnpm build`, OpenAPI sync, generated-client adoption (**22 operations across
  47 shipping Swift files**), and repository iOS release preflight passed.
  The build emitted only the expected local warning that this credential-free
  worktree uses Better Auth's default development secret. Scripted parity is
  web **89.74%** and iOS **85.80%**; both gates pass.

**External blockers / not claimed:** Google Cloud project `Kairo`
(`kairo-nntime-2026`, account `neimarules@gmail.com`) exists, and its branding
wizard has the Kairo name, external audience, support account, and developer
contact. Setup intentionally stopped before accepting the Google API Services:
User Data Policy agreement. Consent is not finalized, so no Web client, iOS
client, or secret exists and no Coolify/native environment was activated.
Accepting that legal agreement requires Neima's confirmation. Live production
browser sign-in/linking, signed physical-iPhone sign-in, Keychain relaunch,
linking, 401 purge, and logout remain unproven. This documentation task did not
provision credentials, push, deploy, mutate production, or claim OAuth/device
proof.

## 2026-07-29 — Round 22: secure iOS glance surfaces (Codex)

Roadmap:
`docs/plans/2026-07-29-round22-ios-glance-surfaces.md`.

- **Real read-only glance surfaces.** Small, medium, large, accessory circular,
  accessory rectangular, and accessory inline WidgetKit families now read only
  the protected app-group day snapshot. Focus Live Activity and Dynamic Island
  surfaces remain read-only. Every action opens the authenticated app through
  `kairo://today` or `kairo://focus`; no extension transport, Keychain access,
  `AppIntent`, or optimistic cache mutation was added.
- **Deterministic presentation.** One shared clock/selection layer applies the
  account's validated 12/24-hour preference, planner timezone, current-before-
  next ordering, completed exclusion, and stale-day rejection across all
  families. Version-2 caches remain decodable, status updates preserve the new
  optional hour cycle, and every production cache writer now supplies it.
- **Accessibility and polish.** Every family and Live Activity region has a
  combined VoiceOver label and open-app hint. The final system-gallery review
  found the hierarchy, spacing, contrast, truncation, category language, and
  interaction state professional in compact/expanded ActivityKit plus small
  and medium WidgetKit presentations.
- **Signed real-extension proof.** Xcode 26.4's CLI test runner stripped
  `XCUIApplication` launch arguments/environment despite the documented API.
  A debug-only fixture deep link now crosses that runner boundary without
  affecting Release. The final signed iPhone 17 Pro simulator tour passed
  **1/1** and proved fixture → compact/expanded Live Activity → real widget
  gallery → medium install with shared data → widget tap → Today deep link.
  The `.xcresult`, seven retained screenshots, manifest, video-bearing failed
  diagnostic runs, and gate logs are ignored under
  `browser-qa/round22-ios-glance-surfaces/20260729T224843Z/`.
- **Full gates.** `pnpm lint`, `pnpm typecheck`, **93 web files / 917 tests**,
  and the Next.js production build passed. OpenAPI sync/adoption passed
  (**22 operations across 43 shipping Swift files**), SwiftPM passed **45/45**,
  repository iOS release preflight passed, and a fresh disposable simulator
  passed **290 app-hosted tests**, with one expected file-protection skip and
  no Main Thread Checker violation. The unsigned generic iOS Simulator Release
  build embedded `me.neima.kairo.widgets` as a WidgetKit extension; artifact
  inspection found no `URLSession`, `KairoAPIClient`, or AppIntent symbol path.
  Both disposable simulators were deleted after verification.
- **Roadmap truth.** Phase **8A is complete**. Implementation commit
  `39f827b` ships the reviewed tranche. Scripted parity remains web **89.74%**
  and iOS **85.96%**; H03/H04 intentionally remain partial until a secure
  authenticated extension session bridge exists.

**Not claimed:** No Coolify deployment was triggered because this tranche is
native-only. Phase 7B still requires production Resend/Apple configuration and
a physical-iPhone lifecycle. Phase 8B (Google sign-in plus the Apple Reminders
decision) is the next actionable roadmap slice. TestFlight processing and App
Store launch remain release-specific external evidence.

## 2026-07-29 — Round 21: native offline sync and conflict recovery (Codex)

Roadmap:
`docs/plans/2026-07-29-round21-native-sync.md`.

- **Protected account-scoped sync state.** The native app now keeps cursor
  checkpoints, ordered pending mutations, durable conflicts, and the matching
  saved-day projection in atomically replaced files protected until first
  unlock. Every read, enqueue, replay, presentation update, account change,
  logout, and 401 purge is fenced to the expected local account scope.
- **Generated transport and cursor recovery.** Generated OpenAPI operations
  now cover the change feed plus task and activity-status mutations. Foreground
  and offline-to-online synchronization pull incrementally, recover an invalid
  cursor from the server's separately contracted authoritative checkpoint,
  replay in order with stable idempotency keys, continue pulling independent
  remote changes while mutation replay is backed off, and publish one
  consistent presentation snapshot.
- **Whole-range ADR corrections.** Final adversarial review found and closed
  three runtime gaps before integration: Today responses and offline status
  enqueues are now fenced against account switches, a restored server can
  explicitly rewind an invalid high cursor, and a backed-off mutation cannot
  starve the change feed. Follow-up review also caught the new required
  `checkpointCursor` missing from the zod response contract; the field and a
  deep zod/OpenAPI parity regression now bind the runtime shape.
- **Truthful offline Today and Inbox.** A matching cached day permits only the
  ADR-approved completion toggle; create, edit, drag, delete, focus, review,
  templates, and other unsafe actions stay unavailable. Inbox capture commits
  to the protected outbox before appearing, survives termination, remains
  editable while pending, and cannot cross an account transition.
- **Durable conflict recovery.** Server conflicts retain their exact original
  mutation and idempotency key. Retry is account-scoped, exact-ID, and
  single-flight; failed retries preserve the recovery copy, successful retries
  remove only that conflict, and legacy payload-less conflicts remain
  truthfully dismiss-only. The bounded carousel, VoiceOver announcements,
  44-point controls, reduced-stimulation behavior, and light/dark tokens were
  independently reviewed.
- **Quality review fixes.** The final pass moved Inbox recovery notices into
  normal layout so Accessibility XXXL cannot cover the composer, changed
  conflict body copy to the AA Rose ink token, kept Today text and controls
  fully opaque while muting only card fills, and added a compact metadata
  fallback so exact 390-point cards do not ellipsize.
- **Deterministic UI evidence.** A fresh iPhone 14 simulator ran the complete
  `KairoRound21SyncTour` at exactly 390 points: **6/6 passed, 0 failed, 0
  skipped**. It proves cached-day safety, pending Inbox relaunch persistence,
  retry/dismiss/navigation recovery, light/dark states, and Accessibility XXXL
  action/composer reachability. Final ignored screenshots and the attachment
  manifest are under
  `browser-qa/round21-native-sync/post-review-exact-390/`.
- **Full local gates.** `pnpm lint`, `pnpm typecheck`, **914 web tests**,
  `pnpm build`, OpenAPI sync/adoption, and `pnpm ios:release:preflight` passed.
  SwiftPM passed **45/45**. App-hosted unit tests passed **283**, with the one
  expected simulator skip for unavailable file-protection attributes. The
  exact-390 UI suite passed **6/6**, and the generic iOS Simulator Release
  build passed. Independent specification, quality, and whole-range ADR reviews
  drove the corrective passes; no known P0-P2 finding remains.
- **Roadmap truth.** Phase **7C is complete**. Implementation and review span
  `501d63a..40ecdac`; the final reviewed implementation SHA is
  `40ecdac66caed0602badb61b0c0766143b1654d3` before this documentation commit.
  Scripted parity remains web **89.74%** and iOS **85.96%**.

**Not claimed:** Phase 7B remains blocked on production Resend/Apple provider
configuration and a physical-iPhone lifecycle. Google sign-in, secure
authenticated extension mutations, TestFlight processing, and App Store launch
remain open. The legacy `KairoFlowUITests` broad flight was intentionally not
run: it targets a live API account and creates, reschedules, completes, and
deletes server data, so it is not an acceptable deterministic local or
read-only production gate for this round.

## 2026-07-29 — Round 20: native auth completion code and simulator proof (Codex)

Roadmap:
`docs/plans/2026-07-29-round20-native-auth-completion.md`.

- **Fail-closed provider discovery.** `/api/v1/auth/capabilities` exposes only
  magic-link and Apple availability. Resend is enabled only by a non-empty
  `RESEND_API_KEY`; Apple requires the complete five-variable server contract
  and the exact native bundle ID. Apple account linking is explicit, OAuth
  token storage remains encrypted, and implicit same-email linking is denied.
- **One-time Apple exchange.** Server-issued state and nonce challenges are
  intent-, user-, and expiry-bound, atomically consumed, replay-safe, and
  exchanged through Better Auth without exposing provider configuration.
- **Native transport and lifecycle.** Generated OpenAPI adapters now cover
  capability discovery, Apple challenge/exchange, iOS magic-link requests, and
  token-only callback redemption. Cookies survive successful exchange, 400s
  preserve the session, structured 401s use the existing full purge boundary,
  and cancellation remains cancellation.
- **Safe callback routing.** Universal links and direct URLs use one coordinator
  with token-hash duplicate suppression. Invalid callbacks are ignored; account
  changes purge before bootstrap; failures remain actionable.
- **Professional native UI.** The sign-in surface uses Kairo design tokens,
  official Sign in with Apple controls, password as the primary path, and
  magic link as a clear secondary path. Loading, success, cancellation,
  duplicate, sent, expired, and retry states have deterministic fixtures.
  Settings adds an explicit Connected accounts flow with account-switch and
  privacy copy plus ready, linking, linked, expired, and retry states.
- **Release contract hardened.** Repository and signed-artifact preflight now
  verify the native bundle ID, Apple entitlement, associated domain, AASA app
  ID/callback route, capability schema, and canonical/generated OpenAPI sync.
  The deployment runbook documents Resend, all five Apple variables, multiline
  private-key handling, Apple Services ID versus native App ID, live AASA and
  capability probes, and the exact physical-device acceptance checklist.
- **Independent review closed.** Invalid Apple provider credentials now return
  a validation 400 instead of a Kairo-session 401, so failed linking preserves
  the valid cookie and Keychain envelope. Link mutations enforce a
  native-compatible, environment-isolated browser origin boundary; public
  challenge throttling uses Coolify's trusted `X-Real-IP` contract instead of a
  caller-prepended forwarding hop. A loopback HTTP listener now proves the real
  generated OpenAPI/URLSession path accepts the Apple exchange cookie from
  empty storage without test-side cookie injection.
- **Local evidence.** At the end of implementation, 133 app-hosted unit tests
  and nine deterministic auth-tour UI tests passed, as did a Release simulator
  build. Inspected ignored evidence under
  `browser-qa/round20-native-auth/` covers compact 390-point width, actual
  accessibility XXXL Dynamic Type, light/dark Apple controls, error/magic-link
  states, and ready/linked/expired account-linking states.

**Not claimed:** Phase 7B remains unchecked. This round has not configured
Resend or Apple production credentials, completed a real magic-link/Apple
provider exchange, or proved install → sign-in → Keychain restore → 401 purge →
link → logout on a physical iPhone. Simulator fixtures do not satisfy those
release gates. Google sign-in, native cursor/mutation sync, secure extension
credentials, and TestFlight processing remain open.

**Release completion:** Independent review cleared the final session-preservation,
CSRF/origin-isolation, cookie-persistence, and rate-limit findings with no
remaining Critical or Important issues. Commit `7466ee6` was fast-forwarded to
`main`; Coolify deployment `grke2cnwkaydn0lig8vjekmo` finished for that exact
SHA. Live `/api/health` reported migrations, database, AI, and scheduler healthy;
the AASA contract and callback route were present. Real-browser callback QA
passed at 1440×1000 and 390×844 with both continuation links visible and no
horizontal overflow. `/api/v1/auth/capabilities` truthfully returned both
providers disabled, so live credential and physical-device gates remain open.

## 2026-07-29 — Round 19: native session and offline integrity (Codex)

Roadmap:
`docs/plans/2026-07-29-round19-native-session-integrity.md`.

- **Shipping session continuity.** The SwiftUI app now persists only configured
  Better Auth cookies in a Keychain envelope protected after first unlock,
  restores them before its first generated-client probe, and derives a local
  SHA-256 scope that is never logged or transmitted. Auth and generated planner
  requests share one cookie store.
- **Honest auth state.** Only structured 401 evidence signs out. Network,
  rate-limit, retryable server, decoding, and cancellation paths have explicit
  policy coverage; a restored account without usable cached data gets a
  recoverable connection screen instead of a false login prompt. Generation
  fencing prevents overlapping bootstrap/logout work from reviving stale state.
- **Protected read-only Today.** The former unscoped `UserDefaults` blob is now
  a versioned, atomically replaced app-group file with
  `NSFileProtectionCompleteUntilFirstUserAuthentication`. Reads require an
  exact local scope and planning date. Matching cached blocks render under a
  prominent saved/read-only notice with edit, drag, complete, delete, focus,
  review, template, and FAB mutations removed while scrolling remains intact.
- **One purge boundary.** Logout, account replacement, and later 401 clear the
  Keychain envelope, configured cookies, protected day snapshot, URL cache,
  pending activity reminders, account-derived presentation settings, and
  in-memory timezone/category/offline state. Onboarding and explicit device
  Health consent remain.
- **False extension actions removed.** The prior widget and Live Activity
  controls used a different cookie store, could fail remotely, and could still
  optimistically change local UI. Widgets are now truthfully read-only and Live
  Activity actions open the authenticated app. H03/H04 parity credits were
  reduced to partial; iOS parity remains above gate at **85.96%**.
- **Dead prototype claims removed.** Unwired package auth/Apple/deep-link and
  offline-queue sources/tests were deleted. Phase 7/8 roadmap checkmarks now
  show native Apple/magic-link, cursor/mutation/conflict sync, Google sign-in,
  and secure extension credentials as remaining work.
- **Evidence.** 45 generated-client package tests, 101 app-hosted unit tests,
  the main-thread gate, unsigned shipping build, and the focused real-simulator
  offline UI flow pass. Simulator proof is stored under ignored
  `browser-qa/round19-native-session-integrity/`; it verifies the saved-day
  notice and absence of mutation controls. Web gates pass with 83 files / 861
  tests, lint, typecheck, production build, OpenAPI sync/adoption, and release
  preflight.
- **Release state.** Shipped implementation
  `2bb94134d51783849c456914d7a91567ba123d54`. GitHub Actions run
  `30449105180` passed build/test, production-mode browser E2E, generated/native
  contracts, 101 shipping-app tests, the main-thread gate, and the unsigned
  shipping build. Coolify deployment `dpxaqtw9fehx781lwac4rho5` finished on
  that exact SHA at `2026-07-29T11:52:25Z`. The first scheduler tick
  overlapping cutover failed as expected; the next tick at 11:53 UTC and three
  consecutive follow-up executions succeeded. Live health returned 200 with
  migration, database, AI, and scheduler checks all `ok` and 58-second
  scheduler lag. The live landing page passed desktop browser smoke and its
  CSP, HSTS, frame, MIME, referrer, permissions, and cross-origin headers were
  present.

**Not claimed:** a production-account online→offline→logout lifecycle was not
mutated for evidence; the simulator flow is synthetic. Native magic links,
Sign in with Apple, Google sign-in, secure widget credential propagation,
offline mutation replay, physical-device proof, and TestFlight remain open.

## 2026-07-28 — Round 18: durable notifications and truthful scheduler health (Codex)

Roadmap:
`docs/plans/2026-07-28-round18-durable-notifications.md`. Replaced the
production-looking placeholder notification flow that wrote duplicate
`planner_events` with a durable Postgres scheduler boundary.

- **Dedicated operational state.** Forward-only migration `0009` adds
  `notification_jobs` and `scheduler_runs`, stable deduplication, due/entity
  indexes, bounded states, and claim-token ownership without updating or
  deleting planner history. Notification work remains outside sync, stats, and
  export.
- **All five ADR-004 types.** Start, halfway, wrap-up, Review Today, and weekly
  review jobs are recurrence/override aware. Compute cancels obsolete future
  work; delivery re-checks preference, quiet hours, current recurrence/source
  state, planning timezone/week-start, timing offsets, title privacy, and sound.
- **Bounded, fenced delivery.** One-statement `SKIP LOCKED` claims use a fresh
  UUID fencing token. The owner renews its five-minute lease immediately before
  and once per minute during provider delivery. Web Push uses a 30-second socket
  timeout, four-request concurrency pool, and ten-live-subscription account
  ceiling. Retryable failures use 1/5/15/30-minute backoff; 404/410 endpoints are
  tombstoned; expired, suppressed, retry, and sent outcomes remain durable.
- **User-facing control.** The existing Settings design now exposes all five
  notification-type toggles, per-activity timing controls, normal-device-sound
  control, lock-screen title privacy, and quiet hours. The service worker
  consumes the current sound preference through `NotificationOptions.silent`.
- **Fail-closed operations.** Every authenticated minute tick records a run and
  returns 500 when any stage fails. `/api/health` reports warming, current lag,
  latest failure, and recovery from the ledger. Error storage redacts arbitrary
  credential URLs, quoted JSON secrets, authorization values, tokens, API keys,
  passwords, and email addresses.
- **Cross-process migration safety.** The merged production build exposed nine
  independent Next workers racing migration `0009`; seventeen workers logged a
  duplicate `__migrations` primary-key failure even though the build exited
  zero. The runner now holds a PostgreSQL advisory lock across its check, apply,
  and record boundary. An eight-runner live-Postgres regression passes, and a
  fresh-database production build applied migrations `0000`–`0009` exactly once
  each with zero migration failures.
- **Independent adversarial review.** Successive reviews found stale-owner
  fencing, batch-clock, recurrence, privacy, offset, retry-summary, pruning,
  sanitizer, in-flight lease, review-reschedule, sound/toggle, unbounded fan-out,
  and offline-hydration gaps. Each verified issue received a failing regression
  before its fix. The final exact-state release review reported no remaining
  Critical or Important findings. Its only Minor note—the subscription ceiling
  was covered sequentially—was closed by registering twelve endpoints
  concurrently while asserting that only ten remain live.
- **Local release proof.** ESLint, TypeScript, production build, and **83 files /
  861 Vitest tests** passed after the final migration-lock follow-up. OpenAPI
  sync and generated iOS adoption passed at **17 operations / 30 shipping Swift
  files**. The full production-mode Playwright suite passed **12/12** on a fresh
  migrated PostgreSQL database, including both offline replay flows.
- **Scheduler state-cycle proof.** Against a synthetic local tenant,
  unauthenticated tick returned 401; authenticated tick returned 200 with one
  desired/deduplicated job and healthy scheduler. Temporarily renaming the local
  synthetic job table forced tick 500 and health 503/`scheduler:failed`;
  restoring it produced tick 200 and health 200/`scheduler:ok`. Evidence is
  ignored under `browser-qa/round18-durable-notifications/`.
- **Responsive browser proof.** The expanded Settings surface persisted a
  per-type toggle and timing offset across reload, then restored the defaults.
  Desktop 1440×1000 and mobile 390×844 renders have zero horizontal overflow,
  zero console warnings/errors, and all fourteen accessible switches. The
  inspected screenshots are
  `browser-qa/round18-durable-notifications/settings-desktop.png` and
  `settings-mobile.png`. Live release QA also found the landing hero's blurred
  decoration extending the mobile document by four pixels; the root now clips
  only horizontal decoration. The exact 390×844 production recheck reports
  `clientWidth=390`, `scrollWidth=390`, and a clean fresh-tab console.
- **Native regression proof.** Swift build/test passed **57 tests / 9 suites**;
  release preflight and XcodeGen preparation passed; the app-hosted main-thread
  gate passed **77/77** with zero Main Thread Checker findings; and the serial
  no-proxy iPhone 17 Pro flight passed **17/17**. Round 18's later review fixes
  are web/server/docs-only.
- **Parity is informational.** The current script still credits `planned` rows,
  so its web **89.74%** and iOS/combined **87.08%** output is not treated as a
  truthful release gate. G01–G03 evidence now explicitly distinguishes shipped
  web behavior from unclaimed native parity.
- **Data safety.** All mutation, failure, delivery, and browser proof used
  synthetic local databases/accounts. Production planner, settings,
  subscriptions, notification rows, and user data have not been read or
  changed. The Jul 29 03:00 UTC production backup was copied off-host to
  `/Users/nn/Backups/kairo/2026-07-29/kairo-prod-predeploy-20260729-030003.dmp`
  before integration. It is a 562,700-byte PostgreSQL custom archive, mode
  `0600`; `pg_restore --list` parsed it successfully and SHA-256 is
  `859853d46784d1a3cb21a14014c9a0832991e23f008c84d0d8e9ee10847f1aa7`.
  No planner contents were inspected.

**Release state:** shipped. `main` release
`e33d106690f052512387a4901f17a2a7542af865` passed GitHub Actions run
`30443525089`: build/test, production-mode E2E, generated/native contract,
shipping-app tests, and unsigned shipping build all succeeded. Coolify
deployment `q90ebdpz3k6jqvychysw1ard` finished on that exact SHA and recovered
to `running:healthy` after the normal cutover overlap. The next authenticated
cron execution returned 200 with the durable notification summary; live health
returned 200 with migrate/database/AI/scheduler all `ok` and 29-second
scheduler lag. The signed-out settings UI settled into its sign-in boundary,
`GET /api/v1/settings` returned the structured 401 contract, and landing-page
CSP, HSTS, frame, MIME, referrer, permissions, and cross-origin headers were
present. Production assets contained the new Halfway check-ins, Notification
sounds, and Quiet hours controls. Read-only desktop/mobile screenshots are
ignored under `browser-qa/round18-live/`; no production user or planner data was
read or mutated.

## 2026-07-28 — Round 17: offline mutation integrity (Codex)

Roadmap:
`docs/plans/2026-07-28-round17-offline-integrity.md`. Closed the gap between
ADR-002's narrow delayed-mutation contract and the web app's previously ad hoc
offline adoption.

- **One executable safety boundary.** `sendReplaySafeCreate` accepts only
  tasks, activities, routines, and mood; `sendRebasedStatusChange` accepts only
  status-only activity patches. The same UUID is used for the immediate request
  and any replay. General edits, deletes, checklist changes, focus transitions,
  imports, and compound promotions remain direct and online-only.
- **Every eligible local surface is covered.** Quick Capture (plain and
  confirmed proposals), Activity Editor create, Inbox capture, mood, routines,
  Peak Focus, Today completion, and Review complete/skip use the typed boundary.
  Inputs clear only after a server save or durable IndexedDB write; failed local
  persistence keeps the user's work visible and says it was not saved.
- **Durable, honest conflicts.** Queue summaries separate pending and terminal
  rows per user. The shell refreshes on queue drain, preserves a generic
  server-version conflict across reload, and deletes only that user's terminal
  rows after acknowledgment. Production-mode browser QA found the mobile
  dismiss control hidden under the capture controls and the toast overlapping
  queue status; both notification layers now remain legible and operable with
  a 44 px mobile dismiss target.
- **Replay identity and retry correctness.** Initial and replayed queued
  requests carry an owner binding that `requireSession` compares with the live
  authenticated user, preventing a stale queue or account switch from writing
  into another account. Retryable online failures defer the first replay
  instead of issuing a back-to-back request. Optimistic-concurrency 409s are no
  longer cached for 48 hours, so the same logical key can re-read a fresh
  revision and succeed.
- **Independent adversarial review.** The first review found the cross-account
  owner gap, immediate retry, and cached-409 poison described above. Each was
  reproduced with a failing test and fixed at the boundary. Re-review accepted
  all three fixes and reported no remaining Critical or Important findings.
- **Full web proof.** ESLint, TypeScript, production build, and **74 files /
  781 Vitest tests** passed. OpenAPI sync passed; generated iOS-client adoption
  remains **17 operations / 30 shipping Swift files**. The full
  production-mode Playwright suite passed **12/12**, including offline inbox
  replay, fresh-revision completion convergence, conflict reload/dismissal,
  focus concurrency, and the core loop.
- **Visual proof.** Desktop 1440×1000 and mobile 390×844 queue and conflict
  states were captured and inspected under
  `browser-qa/round17-offline-integrity/`. The persistent status, transient
  toast, both mobile capture controls, tab bar, and dismiss action no longer
  collide.
- **Native release proof.** Swift package validation passed **57 tests / 9
  suites**. The release contract and XcodeGen preparation passed with no
  package-lock diff. The app-hosted gate passed **77/77** with zero Main Thread
  Checker findings; a fresh unsigned simulator build succeeded. The definitive
  no-proxy serial iPhone 17 Pro flight passed **17/17** with zero failures and
  zero Main Thread Checker findings.
- **Parity remains honest.** This is integrity hardening, not new feature
  credit: web remains **89.74%** and iOS/combined remains **87.08%**, both above
  the 85% gates. `docs/plans/parity-checklist.md` is intentionally unchanged.
- **Data safety.** All browser and native mutation proof used synthetic local
  tenants or mock native data. No production planner, mood, or PHI-like data
  was created or changed.

- **Exact-SHA release proof.** Source SHA
  `c0283eaee08503223dc4e21f5b42e80e4a2697ae` passed all three GitHub Actions
  jobs in run
  [`30389900489`](https://github.com/neima3/nnTime/actions/runs/30389900489):
  build/test, production-mode E2E, and native contract. Coolify deployment
  `k13p2zccvbvrhg2o54rk5gt3` finished for that exact SHA and the `kairo`
  application reported `running:healthy`.
- **Read-only production proof.** `GET /api/health` returned `200` with
  migrations, database, AI, and scheduler all `ok`; the signed-out settings
  boundary returned the expected `401`. CSP, HSTS, frame denial, MIME sniffing
  denial, referrer, permissions, opener, and resource policies were present.
  The live hashed client chunks contained the Round 17 conflict copy. The Today
  surface rendered without horizontal overflow at 1440×1000 and 390×844, with
  zero browser-console warnings or errors; screenshots are in the ignored
  `browser-qa/round17-offline-integrity/` directory.

The production Chrome profile remains signed out, so authenticated planner
reads are explicitly unclaimed. The release proof was read-only and made no
production planner or mood changes.

## 2026-07-28 — Round 16: generated client in the shipping native app (Codex)

Roadmap:
`docs/plans/2026-07-28-round16-generated-native-client.md`. Closed the boundary
left intentionally open by Round 15: generated Swift compiled in isolation, but
the real SwiftUI application still used independently handwritten planner
requests and response decoders.

- **Correct canonical contracts.** The day response now documents and validates
  the real occurrence-enriched activity shape and exact response keys. Dedicated
  mutation inputs no longer require server-owned ids, revisions, user ids, or
  timestamps. Routine lists retain steps, schedules, counts, and duration.
  Generator-safe nullability is compile-tested across energy, batch, search,
  stats, mood, and focus shapes.
- **Generated client is the shipping transport.** The package exposes the
  collision-free `KairoAPIClient` module and the XcodeGen application target
  links it directly. `KairoAPI` remains the stable app-facing actor, but all 17
  planner operations across settings, categories, day, activities, tasks,
  search, stats, mood, routines, and focus now call generated operations.
  Better Auth `/api/auth/*` is the only manual HTTP boundary.
- **One transport policy.** `KairoClient` centrally supplies the shared cookie
  session, planning-zone middleware, mockable transport, and composed RFC3339
  transcoder. The transcoder accepts whole seconds, fractional seconds, and
  offset-equivalent instants and emits stable RFC3339 requests. App adapters
  preserve the polished presentation models without exposing generated wire
  types to feature views.
- **Mutation correctness is operational.** Native settings, activity, task,
  mood, routine, and focus writes use generated idempotency and `If-Match`
  fields. Focus updates enforce compare-and-swap server-side. Web focus now
  retains revisions, uses one idempotency key per logical action, serializes
  rapid taps, survives post-commit response-body loss, refreshes on stale
  revisions, reports failed reconciliation honestly, and converges across
  running or paused tabs.
- **Fail-closed adoption and CI.** The scanner rejects planner literals,
  aliased/optional/qualified `URLSession` escape hatches, nonliteral endpoints,
  and incomplete generated-operation inventory across all 30 shipping Swift
  files. The macOS job checks canonical sync and adoption, forces clean Swift
  generation, regenerates the Xcode project, runs package and app-hosted tests,
  and builds the shipping simulator app.
- **Real QA found and closed two high-severity defects.** First, the web focus
  client did not send the newly required revision and then did not reconcile a
  stale second tab. Second, the generated native runtime rejected valid server
  timestamps with fractional seconds. Both were reproduced through their real
  transports, fixed, regression-tested, and cleared by independent re-review.
  The ignored report and evidence are under
  `browser-qa/round16-generated-native-client/`.
- **Full local proof.** ESLint, TypeScript, production build, and **70 files /
  745 Vitest tests** passed. OpenAPI sync and generated-client adoption passed
  at **17 operations / 30 shipping Swift files**. Swift package validation
  passed **57 tests / 9 suites**; the app-hosted main-thread gate passed **77
  tests** with zero Main Thread Checker findings; a fresh unsigned app build
  succeeded. The direct, no-proxy serial simulator flight passed **17/17** after
  a cold reboot; a focused screenshot tour also passed and exported six
  signed-in screens.
- **Browser and data-safety proof.** The complete Playwright suite passed
  **10/10**, including real server-commit/idempotent-replay, two-tab conflict
  convergence, failed-refresh copy, and offline queue replay. A synthetic local
  tenant exercised settings, categories, day, activity, task, search, stats,
  mood, routine, and focus mutations. Desktop and 390 px mobile web screens and
  the six-screen native contact sheet were visually inspected. Production was
  not accessed or mutated during local acceptance.
- **Parity remains honest.** Contract and transport hardening add no feature
  credit: web remains **89.74%** and iOS/combined remains **87.08%**, both above
  the 85% gates.
- **Independent review.** Successive adversarial reviews found focus
  revision/idempotency/reconciliation gaps and missing date boundaries. The
  final re-review reported no remaining Important or Minor findings.

**External release proof:** the immutable code SHA
`f6c93e07d831f1181f0cbdb834f53af3fd715f7f` is pushed to `main`.
[GitHub Actions run 30381917744](https://github.com/neima3/nnTime/actions/runs/30381917744)
passed all three required jobs: build/test, production-mode Playwright
**10/10**, and the clean generated-client/package/app-hosted-test/unsigned-app
native contract job. Coolify deployment `gbqda9s02f1uijm5twaraoc9` reports
that exact commit `finished`; app `kairo` is `running:healthy`.

Live read-only verification returned HTTP/2 200 and
`/api/health` `{status:"ok"}` with migration, database, AI, and scheduler checks
all `ok`. Enforcing CSP, HSTS, DENY framing, nosniff, referrer, permissions,
COOP, and CORP headers are present. The deployed Focus chunks contain both
unique Round 16 recovery markers (`Focus changed elsewhere` and
`couldn't be loaded`). The real Chrome production page was exercised at
1440×1000 and 390×844 across Focus, Today, and Stats; the hydrated desktop and
mobile Focus screens were visually inspected and the browser reported no
warnings or errors.

The available Chrome profile was signed out. Read-only planner endpoints
correctly returned 401, but an authenticated settings/categories/day/stats
read was not claimed: no Kairo login was available in the open session and the
approved 1Password biometric sign-in timed out. Task 7 therefore remains open
on that single evidence item. No production planner or mood mutation was
performed; the complete mutation matrix remains synthetic-local evidence.

## 2026-07-28 — Round 15: executable native API contract (Codex)

Roadmap:
`docs/plans/2026-07-28-round15-api-contract.md`. Closed a production-risk gap
hidden behind the historical 7A checkbox: the repository had two independently
editable OpenAPI documents, the shipping iOS app still used a manual client
with no operation inventory, and CI did not compile generated Swift.

- **One authored contract.** `api/openapi.yaml` is canonical.
  `pnpm api:sync-ios` atomically regenerates the Swift package input and
  `pnpm api:check-ios` proves byte equality without writing. Drift fails with
  an actionable repair command.
- **Runtime and documented shapes agree.** Shared Zod contracts now validate
  stats queries/responses, mood requests/responses, and focus start/update
  snapshots. Fractional, non-numeric, zero, negative, and over-90 `days`
  values return the standard 400 envelope instead of reaching date math.
  The focus contract now documents its collection GET and the real
  `{session, remainingSec}` start/update response.
- **Generated-client compatibility is executable.** Apple’s generator exposed
  that a nullable `oneOf` silently dropped `FocusSnapshot.session`; a
  compile-time Swift test reproduced the defect before the schema was corrected
  with a generator-compatible nullable object shape. The package then passed
  **41 tests / 8 suites**.
- **The shipping manual client cannot silently add endpoints.**
  `pnpm api:check-ios-client` validates **19 calls across 12 path shapes**,
  including Swift interpolation normalization, against canonical OpenAPI.
  This deliberately covers operation drift while the app remains manual; full
  request/response type migration to generated client calls is the remaining
  boundary.
- **CI now enforces the native contract.** A dedicated `macos-latest`
  `native-contract` job checks both OpenAPI copies, checks shipping manual
  operations, and runs the generated Swift package tests independently of the
  Linux web jobs.
- **Idempotent native retries are concurrency-safe.** Mood, task, and activity
  mutations now execute on the same advisory-locked transaction that persists
  the replay record. A real PostgreSQL test saturates a `max:2` pool with
  concurrent task/activity mutations and proves they complete without
  requiring another connection; a same-key overlap creates one mood event and
  returns one original plus one replayed response.
- **Adversarial review closed concrete regressions.** Independent review found
  and drove fixes for Date-shaped focus rows failing response validation,
  fail-open manual-client scanning, incomplete method/path inventory,
  duplicate stats query handling, and both same-key and bounded-pool
  idempotency races. The final re-review reported no remaining Critical or
  Important findings.
- **First-push feedback became release coverage.** GitHub’s Linux unit job
  exposed that the Round 14 Apple release-contract suites require `plutil`;
  those 15 tests now run with XcodeGen on the macOS native-contract worker
  using a synthetic environment-provided team ID, while the other 615 remain
  on the Postgres-backed Linux worker. The first E2E flight also proved Better
  Auth user IDs are opaque text, not guaranteed UUIDs. The focus
  runtime/OpenAPI contract now reflects that real identity shape, and the
  previously failing Companion flow passes in the complete 7-test browser
  suite.
- **Full local proof.** Lint, typecheck, build, and **59 files / 630 tests**
  passed; both contract checks passed; parity intentionally remains web
  **89.74%** and iOS/combined **87.08%**. The app-hosted native gate passed
  **56 tests** with no Main Thread Checker diagnostic. The definitive serial
  XCUITest flight passed **17/17** in 493.8 seconds.
- **Browser and data-safety proof.** The live stats surface rendered cleanly at
  1440×1000 and 390×844 with no failed requests, console errors, or page
  errors; production remained read-only. Against the local `kairo_dev`
  synthetic tenant, a fractional stats query returned 400, an invalid mood
  enum returned 400, and a valid mood returned `201 {"ok":true}`. Screenshots
  were visually inspected under `browser-qa/round15-api-contract/` and remain
  git-ignored.

**External release proof:**
- GitHub Actions run `30339293080` passed all three jobs on source SHA
  `93cf1a6b697531fb2a650f9268a85cd95355df6a`: Postgres-backed Linux
  build/test, 7-test Playwright E2E, and macOS native/release contract.
- Coolify deployment `cs7e8owoym1l4etxynpokros` finished for that exact SHA
  and the Kairo app reported `running:healthy`.
- Live `/api/health` returned `status: ok` with migrations, database, AI, and
  scheduler all `ok`. The root returned 200 with CSP, HSTS, frame denial,
  nosniff, referrer, permissions, and cross-origin isolation headers.
- In the authenticated production browser, read-only
  `GET /api/v1/stats?days=14` and `GET /api/v1/focus-sessions` both returned
  200 with `private, no-store`; stats decoded all expected keys and the focus
  snapshot decoded without assuming UUID-formatted Better Auth IDs.
- The live stats surface was visually inspected at 1440×1000 and 390×844 with
  no console errors, page errors, captured 4xx/5xx requests, or layout defects.
  Final screenshots remain git-ignored under
  `browser-qa/round15-api-contract/`. Production mood POST was never called.

## 2026-07-28 — Round 14: verifiable distribution and public privacy (Codex)

Roadmap:
`docs/plans/2026-07-28-round14-testflight-release.md`. Closed the repository
and artifact gaps between a simulator-ready native app and a release that can
be evaluated truthfully:

- **Repository-backed release contract.** `pnpm ios:release:preflight` now
  validates the real XcodeGen target rather than a parallel model: exact app
  and widget IDs, iPhone-only device family, semantic version/build,
  HealthKit and App Group entitlements, both Health purpose strings, both
  executable-scoped privacy manifests, and build provenance.
- **Accurate privacy declarations.** The app `PrivacyInfo.xcprivacy` declares
  tracking off, the account/planner/product-interaction data Kairo actually
  sends, and the approved app-only/App Group UserDefaults reasons. The widget
  has its own no-collection/no-tracking manifest with the App Group
  UserDefaults reason it independently requires. Raw Apple Health data is
  intentionally absent because it remains on-device.
- **Public policy and entry points.** `/privacy` explains account/planner
  storage, optional providers, Apple Health's local-only boundary,
  export/deletion, retention, security, and contact in plain language. It is
  linked from the landing footer and native Settings.
- **Deterministic distribution driver.** `pnpm ios:release` now owns
  preflight, signed archive, App Store Connect IPA export, and upload modes.
  It requires a clean checkout for every real mode, derives a positive build
  number, embeds the exact Git SHA/UTC build date, verifies app and widget
  signatures, versions, entitlements, and manifests in both archive and IPA,
  and scrubs optional API-key values before writing Xcode logs.
- **Native proof.** Swift package validation passed **40 tests / 8 suites**;
  the app-hosted gate passed **56 tests** with no Main Thread Checker
  diagnostic; the definitive serial XCUITest flight passed **17/17**. A
  Live Activity tab-selection race was reproduced, fixed with an observable
  selection gate and one bounded retry, and reverified in the focused and full
  suites.
- **Distribution-pipeline proof and adversarial review.** An initial signed
  archive and App Store Connect-exported IPA proved distribution signing,
  identifiers, provenance, HealthKit/App Group entitlements,
  `beta-reports-active`, `get-task-allow = false`, and strict code-sign
  verification. Independent review then found that the widget executable
  lacked its own required-reason manifest and that the first inspector did not
  enforce both bundles deeply enough. The repository and artifact contracts
  now require the widget manifest, matching app/widget versions and builds,
  both signed entitlement sets, exact provenance, and IPA inspection; the
  strengthened validator correctly rejects the superseded artifact. The final
  artifact must be rebuilt from this immutable handoff commit.
- **Web and design proof.** Lint, typecheck, build, and **47 files / 566
  tests** passed. `/privacy` was exercised in a real production browser at
  1440×1000 and 390×844 in light and dark schemes. It has one H1, ten ordered
  H2s, no horizontal overflow, visible keyboard focus, working section
  navigation and landing entry link, and no console or failed-network errors.
  Screenshots were visually inspected and remain git-ignored.
- **Parity unchanged.** Release truth and privacy disclosure do not inflate
  feature parity: web remains **89.74%** and iOS/combined **87.08%**.
- **Roadmap semantics corrected.** Checked 7F/8D boxes now describe the
  repository capability/historical gate only. They no longer imply that any
  particular build was uploaded, processed, reviewed, or launched.

**Post-commit evidence boundary:** the exact final archive/IPA SHA, Apple
upload acceptance and processing state, Coolify deployment record, live
health, and live-browser proof are collected after this source commit exists
and reported directly from those systems. “Uploaded” and “available in
TestFlight” remain separate claims.

**Still user-controlled:** accepting or denying the physical Apple Health
permission sheets and confirming real mindful-minute/sleep behavior in the
Health app. Release automation cannot substitute for those interactions.

## 2026-07-28 — Round 13: private sleep-aware wind-down (Codex)

Roadmap: `docs/plans/2026-07-28-round13-healthkit-sleep.md`. Completed K04's
separately scoped HealthKit sleep-read tranche without weakening Round 11's
write-only boundary:

- **Independent, explicit consent.** The Apple Health Settings card now has
  separate, default-off controls for mindful-minute writes and Sleep Analysis
  reads. The disclosure states exactly what each control does; both
  preferences remain device-local.
- **Value-only Health boundary.** `AppleHealthKitClient` queries only recent
  Sleep Analysis categories. It maps them into value-only `SleepSample`
  structs, exposes no source metadata, logs no samples, and uploads or
  persists nothing.
- **Honest inference.** A pure `SleepScheduleInference` collapses split sleep
  stages into local nights, rejects in-bed and awake records, requires at
  least four distinct nights in a 28-day window, and uses a midnight-safe
  median. The suggestion is 45 minutes before the inferred sleep start.
- **Notification coexistence.** Kairo owns one stable local wind-down request.
  Activity reminder reconciliation now removes only Kairo's `start-` and
  `cushion-` requests, preserving the sleep suggestion and unrelated
  notifications. Foreground refresh never asks for notification permission
  implicitly and respects quiet hours.
- **TDD and full native proof.** Focused suites were driven RED before
  implementation. The final serial native flight passed **56 unit tests and
  17 UI tests** with zero failures and no Main Thread Checker diagnostic. The
  consent surface passed in Light and Dark on an isolated iPhone 17 Pro
  simulator and its screenshots were visually inspected.
- **Web and parity gates.** Lint, typecheck, build, and **44 files / 547
  tests** passed. Parity remains intentionally unchanged at web **89.74%** and
  iOS/combined **87.08%** because K04 stays partial until real Health data is
  exercised.
- **Real-device release gate.** The arm64 Release target built both unsigned
  and signed. The signed app contains both Health purpose strings plus the
  `com.apple.developer.healthkit` entitlement, installed on the connected
  physical iPhone as Kairo 1.0.0, and launched successfully.
- **Production verified.** Main commit
  `1308fcd8278f6cfa5bbdbbcd18ea3cf768a5da59` deployed through Coolify as
  `jzfgfms0bkc7emdy0t4g32v9` and reached `finished`. The app reports
  `running:healthy`; `/api/health` returned `ok` for migrations, database, AI,
  and scheduler. Desktop `/` at 1440×1000 and mobile `/app/today` at 390×844
  rendered without browser console or page errors. CSP, HSTS, COOP, CORP,
  Permissions-Policy, Referrer-Policy, nosniff, and frame denial were present.

**Still requires phone interaction:** accept or deny the two Health permission
sheets, complete a focus session and confirm its mindful sample in Health,
enable sleep-aware wind-down against real sleep history, and observe the local
notification. Installation and launch do not prove those user-controlled
flows.

**Next:** complete the four physical HealthKit interaction checks above before
promoting K04 beyond partial.

## 2026-07-28 — Round 12: full-surface quality sweep (first since Round 6) (Fable)

Roadmap: `docs/plans/2026-07-27-round12-quality-sweep.md`. 39 captures
(13 app routes × desktop-light/dark/mobile) with per-route console + failed-
request logging on a seeded believable day, then a Fable design review of
every screen. Evidence in `browser-qa/r12/`.

**Two real defects found and fixed:**
1. **"Sign in" on a failed session probe.** The sweep's burst tripped
   better-auth's own limiter, and every 429'd get-session made UserMenu
   claim the user was signed out — while online, so the R8 offline guard
   didn't cover it. Principle now enforced completely: a session probe that
   ERRORED (offline, 429, 5xx) is never evidence of signed-out; only a
   definitive empty answer is. useSession's `error` field drives the
   placeholder.
2. **Contradictory banner stack on Today.** A one-item all-done day in the
   morning window showed "Day done — go be free" AND "Set up your day — a
   blank page" simultaneously (each condition individually correct; both at
   once is exactly the noise Kairo exists to prevent). Design call: a
   one-thing day done is EARNED celebration for this audience, so the setup
   card yields to all-done (new `allDone` prop). Verified both directions:
   all-done morning → celebration only; pending day → neither (count ≥2
   suppresses the card as before).

**Artifacts, recorded not "fixed":** the 429 bursts themselves are
better-auth's limiter working under 39 fresh-context loads in ~3 min — not
user-reachable; month-view dots on future days are E2E residue on the
shared account. Everything else across all 39 captures held: dark tokens,
mobile stacking, the new companion chip and charged-hours card, planner,
templates, routines, play, review, settings.

Gates: 547 unit + 7/7 E2E + build green.

## 2026-07-27 — Round 12: iOS main-actor release hardening (Codex)

Roadmap: `docs/plans/2026-07-27-round12-main-actor.md`. Closed the native
runtime-correctness gap exposed after Round 11:

- **Compile-time UI isolation.** The SwiftUI environment model `AppState` is
  now `@MainActor`, covering UIKit trait updates and every observable-state
  mutation before and after async suspension.
- **A warning is now a failing gate.** `scripts/ios-main-thread-gate.sh`
  regenerates the Xcode project, runs the 37 app-hosted unit tests in isolated
  temporary DerivedData, preserves `xcodebuild` failures, and rejects any
  `Main Thread Checker:` output. The RED run passed its assertions but failed
  on both `UIApplication.connectedScenes` and `UIWindowScene.windows`; the
  GREEN run passed 37/37 with neither warning.
- **Shared-QA smoke is state-aware.** The full-flight XCUITest initially
  failed because another runner's legitimate overtime focus session hid the
  idle `Start focus` control. The tab smoke now accepts either the idle control
  or the server-authoritative active-session `Complete session` control,
  without ending another runner's session. The focused test then passed.
- **Full gates.** Web lint, typecheck, build, and 44 files / 547 tests passed.
  iOS passed 37 unit tests and 16 serial UI tests with zero failures and no
  Main Thread Checker match. The unsigned generic arm64 device build
  succeeded; its stale `var` warning in the widget intent was removed.
- **Parity unchanged.** This is correctness hardening, not feature inflation:
  web **89.74%**, iOS/combined **87.08%**; both gates pass.
- **Production verified.** Main commit
  `64d8db6502b6a8b4308eddd12196e031d61bbca6` deployed through Coolify as
  `gr9qfn157skskn4i99axp004` and reached `finished`. The live app reports
  `running:healthy`; `/api/health` returned `ok` for migrations, database, AI,
  and scheduler. Desktop `/` at 1440×1000 and mobile `/app/today` at 390×844
  rendered without browser console or page errors. CSP, HSTS, COOP, CORP,
  Permissions-Policy, Referrer-Policy, nosniff, and frame-denial headers were
  present.
- **Host contention handled honestly.** A separate checkout was running
  Xcode against the original simulator. Final evidence used a distinct,
  already-migrated iPhone 17 Pro plus isolated DerivedData rather than treating
  runner termination as an app failure.

**Still not physically verified:** the checkout still lacks
`ios/Signing.local.xcconfig`, so the Health permission sheet and a mindful
sample in Apple Health remain unclaimed.

**Next:** run `./scripts/ios-device-install.sh <TEAM_ID>` on the connected
iPhone and complete the Round 11 HealthKit release check. After that, begin
K04's separate sleep-schedule-read / wind-down-suggestion tranche.

## 2026-07-27 — Production-readiness pass + a launch crash caught before it shipped (Fable)

**Ops hardening (goal: production ready):**
- `Strict-Transport-Security` joined the proxy's security headers
  (max-age=31536000; includeSubDomains; deliberately no preload) —
  **live-verified** after deploy.
- The Dockerfile now carries a `HEALTHCHECK` on `/api/health` (node global
  fetch; 30 s interval). Safe by construction — health 503s only on hard
  dependencies. **Kairo now reads `running:healthy` in Coolify** (was
  `running:unknown` since launch).
- Access finding, recorded in DEPLOYMENT.md: the Coolify API token in
  `.env.local` is read-only (PATCH → Unauthenticated), so the Coolify-side
  healthcheck toggle and scheduled-backup verification remain UI/owner
  steps — documented, not claimed.

**⚠️ The launch crash (highest-value find of the pass).** Verifying the
externally-committed R11 (HealthKit mindful minutes, 476ae8c) surfaced an
app-killing bug: on a fresh simulator the app crashed AT LAUNCH for every
UI test (16/17 failures, `EXC_CRASH SIGABRT`). Root cause from the crash
report, not guesswork: `AppState` was `@Observable` but **not main-actor
isolated** — `bootstrap()` is nonisolated-async, so `applyContrastOverride()`
(I1's window `traitOverrides` mutation) could run UIKit work off the main
thread. A latent race since I1 that had always won its timing — until R11's
HealthKit framework link shifted startup enough to lose deterministically.
Fix: `@MainActor` on `AppState` (every call site was already main-actor —
the isolation was the only thing missing). This would have shipped in the
next device build.

**Second find while stabilizing:** a crashed KairoRound8Tour had left
high-contrast + dyslexia-font ON on the shared QA **account** (the modes
sync server-side), restyling every later tour. Restored via the API. Trap
recorded: when tours die mid-run, check the account's prefs, not just
local state.

**Definitive suite, fresh simulator + clean account: unit 37/37 (incl.
R11's HealthKitManagerTests 9/9), UI 16/16 — 0 failures, TEST SUCCEEDED.**
R11 is now genuinely verified, not just committed.

## 2026-07-27 — Round 11: HealthKit mindful minutes (Codex)

Roadmap: `docs/plans/2026-07-27-round11-healthkit.md`. Finished the deferred
Round 10E as a deliberately narrow, privacy-first HealthKit slice:

- **Explicit consent, off by default.** Settings now has a token-only Apple
  Health card with `Save focused minutes`, clear write-only privacy copy,
  busy/authorized/unavailable/denied/failure states, and a VoiceOver hint.
  The preference is device-local and disabling it stops future writes.
- **Isolated write boundary.** `HealthKitManager` wraps an injectable
  `HealthKitClient`; production requests only `.mindfulSession` write access
  and reads no Health data. Completed sessions use the focus UUID as
  `HKMetadataKeySyncIdentifier` with version 1, so retries update rather than
  multiply the sample.
- **Server completion stays authoritative.** `FocusView` exports the exact
  focused minutes only after the API accepts the completed transition.
  Kairo shows the completed UI, haptic, ends the Live Activity, and stops the
  soundscape before launching the best-effort HealthKit write, so even a slow
  or failed save cannot delay or roll back completion.
- **Capability and disclosure.** `com.apple.developer.healthkit = true` is in
  both the app entitlement and XcodeGen source of truth.
  `NSHealthUpdateUsageDescription` names the mindful-minute write.
- **TDD evidence.** The focused bundle first failed to compile on the missing
  `HealthKitClient`/`HealthKitManager`, then passed 9/9 manager tests. The
  consent XCUITest first failed because no toggle existed, then passed.
- **Full gates.** Web: lint, typecheck, build, and 44 files / 547 tests green.
  iOS: 37 unit tests and 16 UI tests, zero failures; generic arm64 iOS device
  build succeeded with signing disabled. The built Info.plist contains the
  usage string and Xcode resolves `App/Kairo.entitlements`.
- **Visual evidence.** Real iPhone 17 simulator screenshots in
  `browser-qa/round11-healthkit/final/` were inspected in explicit Light and
  Dark themes. The control is on-screen, accessible, and follows the existing
  Settings hierarchy; artifacts remain git-ignored.
- **Parity and tracker audit.** K04 is now honestly partial (0.5): mindful
  writes shipped, sleep-schedule reads remain. F9/G9 were stale duplicates of
  the Round 8 T15 Playwright CI suite and native tours, and are reconciled.
  Recomputed parity: web **89.74%**, iOS/combined **87.08%**; both gates pass.

**Not physically verified:** Xcode sees a connected iPhone, but this checkout
has no `ios/Signing.local.xcconfig`; a signed install needs the developer Team
ID plus the documented Apple-account/device interaction. Therefore the Health
permission sheet and a real sample appearing in Apple Health were not claimed.

**Next:** run `./scripts/ios-device-install.sh <TEAM_ID>`, opt in on the
connected iPhone, complete a focus session, and verify the sample in Health.
Only after that release check should K04's separate sleep-schedule-read /
wind-down-suggestion tranche begin.

## 2026-07-27 — Round 10: iOS companion parity (Fable)

Roadmap: `docs/plans/2026-07-27-round10-ios-companion.md`. Round 9's web
companion (T11) had left iOS behind — the sharpest cross-platform gap this
session created, closed the same way KTime mirrors time-format.ts:

- **`CompanionLines.swift` (Shared)** — the exact web lines and 4-minute
  rotation math from src/lib/companion.ts; `CompanionLinesTests` (5 tests)
  pins the mirror to the web's own test values, including the never-shames
  register check. If the web copy changes, iOS fails on purpose.
- **FocusView**: Companion toggle chip on setup (same "kairo-companion"
  device-local key via KairoPrefs — a vibe, not data, never synced); the
  Body-double ritual switches it on; during a session a presence card with
  the rotating line and a Solo escape. The breathing dot animates only when
  BOTH reduced-stimulation and the system Reduce Motion allow it.
- **KairoRound10Tour**: ritual → "Companion on" → start → card shows the
  web's exact first line → Solo dismisses → session completed (account left
  clean). Two real XCUITest traps fixed along the way: SwiftUI concatenates
  the chip's emoji into its accessible name (match by CONTAINS, not
  identifier), and the done-state label is the full sentence ("23 min of
  real focus") so exact-match staticTexts never hit it. The tour also
  self-heals from a leftover active session.
- **10E (HealthKit mindful minutes) deliberately deferred** — new
  entitlement + usage strings touch signing; that's its own clean slice,
  recorded in the roadmap as open.

Full iOS suite green (Executed-line verified below). Web untouched.

## 2026-07-26 — Round 9: E07 energy-pattern learning ("charged hours") (Fable)

Roadmap: `docs/plans/2026-07-26-round9-energy-pattern.md`. With the round-3
tracker at 20/20, the next real work was the one deferred parity row that is
genuinely Kairo-shaped: learn when this user's HIGH-energy work actually gets
completed, show it honestly, and let it inform scheduling. (The other sub-1
rows are deliberate design decisions — emoji over icon packs, six token
categories over 3,000 freeform colors — chasing them would break our own
design contract, so they stay 0.5 on purpose.)

- **Derivation (server-side, once):** `computeEnergyPattern` in stats.ts —
  high-energy completions joined to their series (so it learns from ALL
  history immediately, not just future events), scheduled hour projected
  from occurrenceKey into the planning zone (completion time as fallback
  for older rows), fixed 60-day window. Evidence-gated: ≥8 samples AND the
  best 3-hour window must hold ≥3 or the app says nothing. Wrap-aware
  (22–01 is a real evening pattern); ties anchor to an hour with signal
  ("9–12" reads truer than "8–11" when everything landed at 9 and 10 —
  found by seeding real data, fixed with a test). 6 unit tests.
- **Web:** "Your charged hours" Stats card — mint heat strip with the
  window highlighted, copy that observes rather than prescribes. Both new
  cards format hours via useHourCycle (and the focus-hours card's raw
  ":00" was upgraded along the way). Evidence:
  `browser-qa/r9-charged-hours.png` (seeded 8 high-energy completions).
- **Plan-my-day:** the route hands the learned window to planMyDay as a
  `<learned>` data block (same delimiting discipline as every untrusted
  field, SEC-05 intact); the system prompt prefers placing high-tagged
  tasks inside charged hours when a slot overlaps. Pattern failures never
  block planning.
- **iOS:** StatsResponse gains the optional energyPattern block (older
  builds unaffected); Insights renders the same card from the same
  payload — no double-implemented math. `KTime.hourLabel` added mirroring
  the web's formatHourLabel, pinned by unit tests.
- **Parity: E07 0 → 1. Web 89.74%, iOS 87.64%** (was 88.46/86.52), both
  gates PASS.

Note: `/api/v1/stats` predates this round in being absent from
openapi.yaml (the inventory gate passes — it was accepted as outside the
pinned contract). Additive change, nothing new owed; recorded here so the
gap is known rather than discovered.

## 2026-07-26 — Round 8: offline conflict decision + E2E suite land (Fable)

Picked up the two items Round 7 named as the real gaps: the ADR-002 conflict
decision blocking the rest of the offline queue (T13), and E2E coverage (T15).
Also shipped the previous session's stranded commit: fcc546c (the 12/24-hour
fix) was sitting unpushed while production ran without it.

**T13 — offline completions, decided and shipped.** ADR-002 already contained
the answer ("stale revision → 409, client must rebase"; completion conflicts
resolve by planner_events ordering) — recorded it as three mutation classes in
the ADR and implemented class 2:
- **Rebase-on-replay**: a queued complete/uncomplete PATCH carries no pinned
  revision; at flush time the queue GETs the resource and uses the *fresh*
  revision as If-Match. Safe because a status-only patch touches no other
  field group. 404 on re-read (deleted while offline) → terminal conflict UI;
  409 on replay → retry (next flush re-reads again). The activities [id] PATCH
  now honors Idempotency-Key (withIdempotency existed since 1A but only
  creates used it), so a replay whose response was lost can't double-apply.
- Today's timeline queues status flips offline with an optimistic overlay;
  a new `kairo:queue-drained` event refreshes pages when a flush lands.
- Field edits / checklist overrides / deletes stay honestly unqueued (class 3)
  until a real merge UI exists.
- +7 unit tests pin the rebase contract. Verified in-browser both directions
  (offline complete → reconnect → server completed; offline uncomplete →
  server pending; queue drains to 0, exactly one PATCH each).

**Found while verifying: the SSR clock-format flash.** A fresh h12 account's
served HTML rendered 7:00/13:00, then hydration repainted to 7 AM/1:00 PM —
useHourCycle's server snapshot was hardcoded "h24", the exact flash its own
comment claimed to prevent. The /app layout now provides the account's hour
cycle via HourCycleContext; the served HTML carries the right format in the
first byte (fetch-verified: no '7:00' anywhere in an h12 account's payload).

**T15 — Playwright E2E suite, in CI.** Five specs against a real browser +
real server: settled-auth setup (one sign-up/run via storageState — stays
clear of the 10/10min auth rate limit), plan→complete→persists, quick capture
→ inbox, clock format (including the SSR payload assertion), and offline
replay under real network emulation (context.setOffline). Two consecutive
cold-server full-suite runs green locally; CI gained an `e2e` job (service
Postgres + pnpm start; the app self-migrates on boot). Test-enabling product
change: `HydrationMarker` stamps data-hydrated on <html> — pre-hydration
fills are wiped and a pre-hydration submit degrades to a native GET reload,
so the marker is the only honest "safe to interact" signal.

**The suite immediately earned its keep — two real bugs manual drills missed
(a warm client-session cache had hidden both):**
1. **Offline masqueraded as signed-out.** With a cold cache, useSession()
   fails/never resolves offline: the sidebar flipped to "Sign in" for a
   signed-in user, and OfflineShell passed userId=null — which silently
   killed the offline banner AND the reconnect flush. OfflineShell now falls
   back to the device's remembered user (resolveQueueUser — Round 7's own
   fix, finally applied at the shell), and UserMenu holds its placeholder
   instead of claiming signed-out while the network is down.
2. **purgeUserCache had ZERO callers** — ADR-002's "purge on logout" was
   never wired (the same infrastructure-without-wiring shape Round 7 found
   twice). Sign-out now purges the user's queued mutations and forgets the
   remembered id, which is also what makes the shell fallback safe.

**Trap for later sessions:** `pnpm add` while the dev server runs leaves it
serving a stale turbopack chunk graph — hydration dies page-wide with
"module factory is not available", and every browser that visited keeps the
broken chunks in cache (a plain reload does NOT recover; hard-reload or a
fresh profile does). Restart the dev server (rm -rf .next) after installs.

**Per-type notification toggles (backlog item, closed).** notificationPrefs
gains a flat `startNudges` key (absent = ON — they're the core reminder, so
only the explicit Settings switch turns them off); `startNudgesEnabled()` in
quiet-hours.ts is the single read point and deliverDueNudges suppresses before
the quiet-hours check. New "Start-of-block reminders" row in web Settings →
Notifications. Verified in-browser: toggle → PATCH → `startNudges:false` in
the DB → survives reload → restored. Syncs to iOS via the same prefs blob
(iOS merge preserves keys it doesn't model). 524 tests.

**Ship gate:** lint + typecheck + **524 tests** + build green; E2E 5/5 twice
from cold; parity holds (web 88.46%, iOS 86.52%, both gates PASS); CI green
including the first e2e-job run; deployed to time.neima.me.

**Live-verified on production (QA account, evidence in-transcript):**
- 12/24 fix live: timeline gutter "7 AM…11 PM", block "1:00 PM – 1:45 PM",
  `data-hour-cycle="h12"` stamped, and the SERVED payload carries "9 AM"/
  "1:00 PM" with zero "9:00" — the SSR fix live end to end.
- T13 on prod: offline → complete → one PATCH queued in IndexedDB with the
  rebase marker, offline banner up, NO "Sign in" masquerade → reconnect →
  queue drained to 0 → `status:"completed"` from the day API. QA row deleted
  afterwards (204).
- `data-hydrated` marker present on the live document (build-unique to this
  round's code).

**T12 — estimate calibration on the block (continued same session).** The
Stats-only calibration signal now lives where plans are made: pending future
blocks ≥25 min show "· usually ~Xm" (semibold, category ink — no red, no
shame) when the user's focus-session ratio is ≥1.3, with "Usually runs about
X minutes" in the block's accessible label. `calibratedDurationMin` in
insights.ts (pure, +4 tests) rounds to friendly 5s; TodayTimeline reads the
same /api/v1/stats estimate the editor hint uses (progressive enhancement —
blocks never wait on Stats). Localhost-only `?calibrationDebug=<ratio>`
override (ritualDebug pattern) because the real signal needs ≥5 qualifying
sessions. New E2E spec pins: hint renders under the override, hint stays
away without signal, aria-label carries the sentence. Visual evidence:
`browser-qa/t12-usually-hint{,-block}.png`. 528 tests, 6/6 E2E.

**T16 (measurement half).** Live landing re-measured post-rounds-7/8:
Lighthouse mobile **perf 96** (FCP/LCP 2.1 s throttled, CLS 0, TBT 70 ms) and
**a11y 100, zero failing audits** — the 6D ≥90 gate and P8's a11y bar both
hold. Small drift from P8's perf 100 (2.1 s LCP vs 1.6 s); nothing regressed
below gate, so the deep-perf work (bundle audit, /app/today measurement)
stays queued rather than reactive.

**T18 — copy audit round 2 (subagent sweep, 13 findings, all applied).** The
pattern: failure paths lagged the happy paths — round 1 warmed the toasts
people see when things work; what remained was almost entirely catch blocks,
!res.ok branches, and aria-labels. Fixed: the sign-in fallback ("Something
went wrong. Please try again." on the app's highest-traffic error surface),
"An unexpected error occurred." opener in the error boundary, four surviving
"Could not X." strings, a dev note shipped verbatim in the magic-link info
("Local dev logs the link in the server console…"), raw HTTP "Conflict"
leaking into two Today toasts (now reuses TimelineCanvas's warm 409 copy),
the network-error standard unified across all 12 sites ("Couldn't reach the
server — try again?"), inbox terminology drift (items/tasks → thoughts),
"revision" jargon in the editor, two cold Settings→Calendars strings, and
three aria-label issues — including "Mark X incomplete" → "Mark X not done"
(deficit connotation; WeeklyIntentions already said "not done") and a
WCAG 2.5.3 label-in-name violation ("Stop tending" on a button reading
"Done"). E2E specs updated for the aria change; 528 tests + 6/6 E2E green.
The audit confirmed zero shame/guilt framing anywhere, and named the strong
surfaces so round 3 doesn't re-litigate them (audit text in the session
transcript). **iOS follow-up:** the native app still says "Mark X
incomplete" (KairoFlowUITests asserts it) — same one-word change + test
update next time the simulator toolchain is warm.

**T16 — deep half done: bundle audit + the one real win.** Audit method and
findings (so nobody re-audits blind): per-route First-Load JS computed from
the live site; /app/today ships 14 chunks ≈762 kB raw. The three biggest are
react-dom (224 kB), the app-router client runtime (140 kB), and the
**nomodule polyfill file (112 kB) that modern browsers never download** —
naive transfer sums over-count by exactly that file. Real modern-browser
cost ≈145 kB gzip framework floor + ~60 kB app code: lean, no misplaced
deps (zod/web-push are server-only; lucide tree-shakes per icon). No bundle
action warranted — fabricating trims there would be motion, not value.
The actual win was runtime: one Today view fired **four** /api/v1/stats
requests (DailyBrief + PeakFocusNudge duplicating days=30, SoftStreaks
days=60, and T12's new calibration read), each re-aggregating
planner_events server-side. New `src/lib/stats-cache.ts` (keyed promise
memo, 60 s TTL, failure-never-cached — the settings-cache pattern) now
serves all five consumers; ActivityEditor and the calibration hint share
the 30-day entry since the estimate uses a fixed 14-day window server-side
regardless of ?days. **Measured in a real browser: 2 stats requests per
Today load (was 4)**, and the promise cache absorbs StrictMode's doubled
dev effects too. 5 new tests (dedupe, per-key isolation, TTL expiry,
failure not cached, invalidation); 533 total, 6/6 E2E.

**T19 — landing refresh (continued same session).** The feature grid caught
up to the product: 6 → 9 cards (clean 3×3) adding reminders + quiet hours,
offline capture/completions, and the brain-breaks arcade (with the Play
hub's own honesty line). Verified light/dark/375px
(`browser-qa/t19-grid-*.png`); `/` stays static; all three cards
live-verified on time.neima.me.

**T11 — body-doubling companion (continued same session).** An ambient
"focus with someone" presence, honest about being the app and not a fake
human. `src/lib/companion.ts` (pure, 8 tests): deterministic line rotation
every 4 minutes derived from elapsed time — no new timers, a re-render can
never flicker the copy — with steady dedicated lines for paused ("Paused
together — take your moment") and overtime ("Still with you — wrap up
whenever it feels right"); a never-shames test locks the register. Device-
local preference (a vibe, not data — never synced); the Body double ritual
switches it on; a Companion toggle on Focus setup; during a session a calm
card under the ring (breathing dot rides `animate-pulse`, so H9's
reduced-stimulation rules already quiet it) with a "Solo" escape that also
clears the pref. New E2E spec covers ritual→on→card→Solo→pref-cleared and
completes its session so the shared account stays clean. 541 unit tests,
7/7 E2E. Evidence: `browser-qa/t11-{setup,session}.png`.

**Round-3 tracker reconciled again:** T14 (PWA polish) was shipped across
waves — InstallPrompt (wave 1), SW cached-shell offline fallback (6B),
icons/manifest shortcuts (wave 4) — now ticked with provenance. Remaining
open: **T8** (iOS widget accuracy) and **T20's iOS-suite-green half** —
both need the simulator toolchain, plus the iOS "not done" label.

**iOS cycle — T8 + labels + suite green (continued same session).** The
up-next widget's accuracy gap was exactly the suspected shape: the day
snapshot records its `date` but the provider never checked it, so after
midnight (or days of not opening the app) the widget confidently rendered
yesterday's plan as "next up". The provider now rejects snapshots from
another day (honest empty state) and schedules a midnight flip entry so
the change happens on time, not at the next hourly refresh. Also carried
the copy audit's "incomplete → not done" into the iOS timeline
(accessibilityLabel + custom action) with KairoFlowUITests updated to
match. xcodegen + build + **full suite green against production:
Executed 14 tests, 0 failures** (the real Executed line, per the
false-green rule).

**ROUND-3 TRACKER: 20/20 COMPLETE.** T8 and T20 were the last open boxes —
T20's record: web 541 tests + 7/7 E2E + CI green (incl. e2e job),
deployed + live-verified on time.neima.me; iOS full suite green. Every
item now carries provenance for which round shipped it.

**Next round candidates** (nothing tracked is open): deepen T11 (companion
sounds/co-working timers), Apple Health writes (8B stretch), Android
exploration, or a fresh feature-parity sweep against Tiimo's latest.


## 2026-07-24 — Round 7: cross-platform completion + backlog truth (Opus, session 2 cont.)

Round 6 closed, so this round finished what it exposed: the accessibility work
only existed on web, quiet hours were device-local on iOS, scheduled push had no
cron, and the older roadmaps were lying about what was done.

**I1 — iOS accessibility parity.** The four modes now exist on iOS and, more
importantly, live on the **account** rather than the device: set high contrast on
the web and the app adopts it, and vice versa.
- High-contrast token variants are resolved from the **trait collection**, so iOS
  "Increase Contrast" drives them for free; the in-app toggle works by setting
  `traitOverrides.accessibilityContrast` on the window (iOS 17+), which makes
  UIKit re-resolve every token without any view knowing the mode exists. Turning
  it off *removes* the override rather than forcing `.unspecified`, so a user with
  the system setting on keeps it. Hex values mirror globals.css exactly.
- Atkinson Hyperlegible bundled (OFL, license alongside the TTFs), swapped for
  display+body. The mono face is deliberately untouched — tabular time digits are
  already unambiguous and swapping them would break timeline alignment.
- Larger text multiplies the type scale by 1.125 (same step as the web's zoom) on
  top of Dynamic Type, which every iOS font already rides via `relativeTo:`.
- Evidence: `browser-qa/ios-r8/ios-9{0,1,2,3}*.png` — Settings and Today visibly
  restyle, then restore. KairoRound8Tour (1 test executed, passed).

**I2 — quiet hours became one setting, not two.** iOS kept them in local
UserDefaults, so the web toggle shipped in H7 did nothing to iOS reminders and
vice versa. `KairoPrefs.adopt()` / `sharedPrefsPatch()` now read and merge
`settings.notificationPrefs` — the same keys the web writes and the server's push
delivery reads — and the merge preserves keys iOS doesn't model (intentions,
transition warnings). Opening iOS Settings reconciles with the account first, so
it can't show a stale device copy.

**I3 — scheduled push actually fires.** H1 built delivery but left "an external
cron must call jobs/tick" as homework. Added a **Coolify scheduled task** on the
app (`kairo-jobs-tick`, `* * * * *`) that calls the endpoint over loopback from
inside the container, reading `CRON_SECRET` from the container env — no public
round trip, no duplicated secret. Uses `node -e` + global fetch because the
runtime image is `node:24-alpine` with no curl. **Verified by execution history,
not by the task existing:** three consecutive runs a minute apart, each
`200 {"ok":true,…,"delivery":{…}}`. Full details + management commands in
`docs/DEPLOYMENT.md`.

**T13 (partial) — the offline queue had zero callers.**
`src/lib/offline-queue.ts` has been complete since 6B (IndexedDB store, ordered
flush, backoff, terminal 4xx, pending count) and nothing ever called
`enqueueMutation`. OfflineIndicator initialized the queue and displayed a count
that could only ever be zero, so capturing a thought offline just failed — the
same "infrastructure with no wiring" shape as the accessibility prefs. Wired the
inbox capture path: the archetypal offline moment, and the only mutation that is
unambiguously safe to replay (plain POST + Idempotency-Key, no revision, no
If-Match to go stale). **Verified in-browser end to end:** offline → capture →
"Saved on this device"; the pending POST visible in IndexedDB; reconnect → queue
flushes → task in the inbox; queue drains to 0 with exactly one copy.
**Deliberately not wired:** activity edits/completions, whose If-Match revisions
are stale by replay time — that needs an ADR-002 conflict decision
(last-write-wins vs re-read-and-merge), not a bolt-on. Left honest rather than
half-done.

**Backlog truth.** The round-3/4/5 trackers had 26 open checkboxes, 14 of which
were shipped in later rounds and never ticked. Reconciled each with the round
that actually shipped it (verified against code, not assumed). The **real**
remaining backlog is now 12 items: iOS widget/Live-Activity accuracy (T8),
body-doubling companion mode (T11 — only the Focus ritual preset exists),
estimate calibration surfaced on the block (T12 — Insights-only today), the rest
of the offline queue (T13), E2E tests (T15/F9/G9), performance pass (T16), copy
audit round 2 (T18), landing refresh (T19), per-type notification toggles.

**DEPLOYMENT.md corrections** (both learned the hard way): auto-deploy IS enabled,
so pushing to `main` builds on its own — the doc said otherwise, and pushing plus
triggering queues a redundant second build. Also documented the live-verification
trap: pick a marker unique to the new build. I "confirmed" a deploy using a string
the root layout has always emitted, which proved nothing.

**One more fix, found only by testing on production.** The first live offline
capture hit the honest-but-avoidable fallback ("this device can't hold it")
because the page's client session hadn't resolved, leaving `userId` null — and
offline is exactly when `useSession()` may never resolve. The queue only needs a
stable per-user key, so the last signed-in user id is now remembered (id only, not
a credential) and used as the fallback; `resolveQueueUser()` returns null only if
nobody has ever signed in on this device. 6 tests, including denied storage
(private mode). **This is the argument for verifying on prod and not just
locally** — the local run passed because that browser happened to have a resolved
session.

**Ship gate:** web lint + typecheck + **503 tests** + build green; parity holds
(web 88.46%, iOS 86.52%, both gates pass); iOS suite green (14 UI + 15 unit tests
executed); deployed to time.neima.me. **Live-verified on production:** signed in,
went offline, captured a thought → "Saved on this device", one row in IndexedDB →
reconnected → queue drained to 0 and exactly one task in the inbox (no duplicate).
Test rows deleted from the QA account afterwards. Build markers unique to the new
code confirmed in the live bundles ("Saved on this device", "In your planner").

**Next:** the ADR-002 conflict decision that unblocks the rest of the offline
queue, then E2E coverage (T15) — the largest real gap now that the false greens
are gone.


## 2026-07-24 — Round 6 COMPLETE: 10/10 + one unplanned fix (Opus, session 2)
Roadmap: `docs/plans/2026-07-24-round6-10phase.md`. Finished H3/H7/H8/H9 and
found a production-class bug on the way.

**H7/H8 — extraction + tests.** `src/lib/quiet-hours.ts` (parse/normalize the
notificationPrefs blob, overnight-wrap membership, formatting) and
`src/lib/intentions.ts` (week-keyed parse, cap of 3, reducers that return the
same reference on a no-op). push.ts and WeeklyIntentions now consume them.
**Gap closed:** the web had no quiet-hours UI at all, so the server's
quiet-hours branch was unreachable for web users. Added a toggle + window rows;
verified the full round trip UI → PATCH → DB
(`{"quietHours":{"end":7,"start":23,"enabled":true}}`) → reload.

**⚠️ H11 (unplanned, highest-value find): the migration chain was broken.**
Migrations 0006/0007 referenced a `"users"` table that does not exist (the
better-auth table is `"user"`). On any database migrated from scratch — a fresh
Coolify DB, staging, local dev — the chain died at 0006, so 0006/0007/0008 were
never applied *or recorded*: `push_subscriptions` was absent and **web push was
silently dead on every new environment**. Prod only worked because it still has
a legacy `users` table. Hidden twice over: `scripts/migrate.ts` catches and
`exit(0)`s, and the DB test harness treated the same error as "no Postgres
available" and skipped — so **nine DB test files (migrations, schema-invariants,
dal, crud-flow, focus, focus-extend, recurrence, occurrence, ratelimit,
routine-materializer) reported green while asserting nothing**. Fixes: 0006/0007
are now documented no-ops (0008 is the correct rebuild; prod already recorded
them, so it skips either way); `test-db.ts` throws a distinct `MigrationFailure`
and `rethrowIfMigrationFailure()` is wired into all nine `beforeAll` catches;
new `migration-chain.test.ts` guards numbering, the `"users"` reference, FKs to
tables no earlier migration creates, and the 0006/0007 no-op contract. Suite
went **453 passed | 17 skipped → 475 passed, 0 skipped**. Verified end to end on
an ephemeral from-scratch DB and on the dev DB.

**H9 — the accessibility prefs were theatre; now they're real.**
`.reduced-stimulation` was toggled onto `<html>` and checked by three components
in JS but had **zero CSS rules**, so the toggle left 18 `animate-pulse`, 10
`animate-spin`, 2 `animate-ping` and every entrance animation running. Worse,
`personalization.ts` had exposed highContrast/dyslexiaFont/largerText since 5B
with nothing consuming them — **parity rows I04 and M04 were credited SHIPPED on
preferences a user could not turn on** (both rows rewritten with the real
status). Now shipped and live-verified:
- Reduced stimulation: decorative keyframes off with settled resting states,
  spinners kept but slowed to 1.6s (a frozen spinner reads as a hung app),
  transitions capped, shadows flattened per theme.
- High contrast: token overrides split per theme, edges instead of blur, 3px
  focus rings, `prefers-contrast: more` honoured before the toggle is touched.
- Dyslexia-friendly font (Atkinson Hyperlegible) and larger text (body zoom
  1.125 — the px type scale makes root font-size a no-op).
- `src/lib/a11y-prefs.ts` is the single settings→classes mapping (33 tests), and
  `src/app/a11y-css.test.ts` asserts every toggleable class actually styles
  something, so "a class with no CSS" cannot recur.
- Two gaps found while verifying: nothing applied these classes outside Settings
  (so a **new device** showed the default UI until you opened Settings) — fixed
  with a server-rendered `src/app/app/layout.tsx` (marketing routes stay static)
  plus `A11yApply` for client-side navigation, where React never runs an inline
  script; and `.timeline-past` (opacity .55 + saturate .5) was washing out past
  blocks for exactly the users who opted into high contrast.
- Empty-state sweep: month view had no explanation when a month is blank; two
  flat PlanDayClient strings warmed.

**H3 — planner search, both platforms.** Needed a REST endpoint first (AGENTS.md:
core data ops must be `/api/v1/*` for iOS), which closed a web gap too — ⌘K
searched only *commands*, never the user's own blocks.
- `src/lib/search.ts` — shared matching/ranking (title exact > prefix >
  word-prefix > substring > notes; accent/case-insensitive; ties toward the
  nearer date, capped so proximity can't outrank a better field match). 21 tests.
- `GET /api/v1/search` — series not expanded occurrences (a recurring block
  matches once and carries `repeats`); zone-aware `today`; 400 blank / 401 anon /
  limit clamped. The ADR-002 inventory gate caught the missing OpenAPI entry —
  added path, components, tag, zod schemas; verified no dangling `$ref`s.
- iOS `SearchView` — debounced 280ms, generation-guarded so a slow response can't
  overwrite a newer query, four honest states, reachable from the Today toolbar
  and More, taps through to the day. `KairoRound7Tour` covers it.
- Web ⌘K now lists "In your planner" hits under the commands.

**Ship gate:** web lint + typecheck + **497 tests** + build green; landing page
still static (`○ /`). Deployed to time.neima.me (auto-deploy is enabled — a push
builds without a manual trigger) and **live-verified**: search returns ranked
real data with a session, 400/401 correct; all four a11y modes toggle live
(`--ink #120e1c`, zoom 1.125, classes + localStorage) and toggle back off.
iOS: `KairoRound7Tour` passed against the live API — result row "Live QA block ·
Sat, Jul 18 · 22:36" (`browser-qa/ios-r7/ios-81-search-results.png`).

**Trap worth remembering:** `xcodebuild ... -only-testing:` printed
**TEST SUCCEEDED with "Executed 0 tests"** because the new test file wasn't in
the generated project — run `xcodegen generate` after adding any Swift file, and
always check the "Executed N tests" line, not just the SUCCEEDED banner.

**Next:** iOS ports of the accessibility modes (7D — Increase Contrast, dyslexia
font, larger text on iOS), and an external cron hitting `/api/v1/jobs/tick` so
scheduled push fires without a manual call.


## 2026-07-24 — Round 6: 10-phase program (Opus) — 3/10 (iOS parity depth)
Roadmap: `docs/plans/2026-07-24-round6-10phase.md`.

Done + verified (all iOS, simulator + full suite green):
- **H2 Focus session checklist** — focus started from a Today block now carries
  the activity id/occurrence/checklist through the kairoStartFocus flow; the
  active session shows a STEPS card and ticking a step PATCHes checklistOverride.
  Rituals start unlinked. Mirrors the web focus checklist.
- **H5 Onboarding orientation** — a closing "Three things worth knowing" screen
  (Pick for me / Focus a block / Brain breaks) → "Start my day". Verified:
  `browser-qa/ios-11-orientation.png`; KairoNewScreensTour updated + passes.
- **H6 Routines "edit on the web" note** on the populated list.
- **H10 iOS ship gate** — full iOS suite green (12 suites). No web changes this
  round, so web stays as last deployed (372 tests, live).

**"Do them both" follow-up — the two hard ones, done + verified:**
- **H1 Scheduled web-push delivery** — jobs/tick now runs `deliverDueNudges()`:
  finds notification jobs due within ±2 min, sends a push per activity via
  sendToUser, respects per-user quiet hours (overnight-wrap, per timezone),
  marks each job sent in-place (jsonb) so ticks don't repeat. **Verified live:**
  set CRON_SECRET in Coolify, redeployed, and `POST /api/v1/jobs/tick` (Bearer)
  returns 200 with `delivery:{delivered,suppressed,considered}` — the full path
  executes. Automatic firing needs an external cron hitting that endpoint every
  1–2 min (documented in DEPLOYMENT.md); on-demand push already works.
- **H4 Native iOS soundscape** — `SoundscapeEngine` (AVAudioEngine +
  AVAudioSourceNode) generates rain/forest(+chirps)/ocean(swell)/cafe/white in
  real time (one-pole filters + leaky integrator + LFO), gain-smoothed. Focus
  rituals auto-start their vibe; a soundscape picker row on the Focus setup;
  stops on complete/leave. Build-verified + KairoRound6Tour passes (audio isn't
  verifiable headlessly). Note: a stale xcodegen cache initially dropped the new
  file — cleared it.

**Still remaining (H3, H7, H8, H9):** iOS Search, extract intentions/quiet-hours
to a testable lib + tests, web reduced-stimulation/empty-state sweep.

⚠️ Machine memory is exhausted (swap ~5.4 GB used) — `next build` gets
OOM-killed unless `NODE_OPTIONS=--max-old-space-size=2048` caps the heap; iOS
UI tests are flaky under the pressure. Worth freeing RAM before next session.



## 2026-07-24 — Round 5: 10-phase program (Opus) — 6/10
Roadmap: `docs/plans/2026-07-24-round5-10phase.md`.

Done + verified:
- **G1 iOS Week tap-to-edit** — blocks open the editor; every day (incl. empty)
  has a "+" to add. **G3 iOS Weekly Intentions** — synced via
  settings.notificationPrefs; **verified cross-platform**: an intention added on
  the web showed on iOS (`browser-qa/ios-60-week-intentions.png`). Added
  KairoAPI.settingsRaw() for the flexible prefs blob.
- **G6 Quiet hours** — iOS reminders skip a nightly window (Settings toggle,
  default 22:00–07:00, overnight-wrap aware).
- **G7 Web focus polish** — idle screen shows the linked activity's name instead
  of a raw UUID. Deployed + live.
- **G8 iOS Play best scores** — Time Feel + Quick Tap record and show a personal
  best (app-group UserDefaults).
- **G10 ship gate** — web lint+typecheck+**372 tests**+build green, deployed +
  live smoke 200; **full iOS suite green (12 suites)**.

**Remaining (G2, G4, G5, G9):** iOS Search/quick-jump, iOS Focus session
checklist (needs threading activityId through the focus flow), iOS native
AVAudioEngine soundscape, integration tests for new surfaces.



## 2026-07-24 — Round 4: 10-phase program (Opus + verification back) — 4/10
Roadmap: `docs/plans/2026-07-24-round4-10phase.md`. Disk was freed (~26 GB) and
agent-browser works again, so full visual verification is back.

Done + verified:
- **F1 Web Push** — completes the reminders story (pairs with iOS notifications).
  web-push + VAPID (keys in Coolify buildtime env), subscribe/unsubscribe/test
  endpoints, SW push + notificationclick handlers (cache v4), PushReminders opt-in
  in web Settings. **Server pipeline verified live**: subscribe → `{ok:true}`,
  test/unsubscribe → 200. Real notification *display* needs a real browser+push
  service (not headless). NOTE: fixing this took 8 migrations — the prod
  `push_subscriptions` table was badly drifted (missing keys/deleted_at/indexes
  and a wrong FK to `users` vs `user`); rebuilt it cleanly (it was empty).
- **F3 iOS Month** — Monday-first grid, completion dots, tap-day preview sheet.
  Verified: `browser-qa/ios-50-month.png`.
- **F6 iOS Settings formatting** — 12/24h + week-start, persisted via new
  KairoAPI.updateSettings. Verified: `browser-qa/ios-51-settings-format.png`.
- **F7 Weekly Intentions** — 1–3 streak-free aims on the Week page, persisted in
  settings.notificationPrefs (syncs to iOS). **Verified live**: survived a full
  reload (`browser-qa/web-f7-intentions.png`).

Ship gate: web lint+typecheck+**372 tests**+build green, deployed + SW v4 live.

**Remaining (F2, F4, F5, F8, F9, F10):** notif quiet-hours, iOS Search, iOS Week
tap-to-edit, iOS native soundscape, E2E tests, final ship sweep.



## 2026-07-23 — Round 3: 20-phase program (Opus + subagents) — IN PROGRESS
Roadmap: `docs/plans/2026-07-23-round3-20phase.md`. **Shipped this session: T2,
T4, T5, T9, plus partial T17/T18. The rest remain — 20 phases is multi-session.**

Done + verified:
- **T2 iOS local notifications** — `NotificationManager` schedules on-device
  reminders for today's upcoming blocks; Settings toggle + permission flow.
- **T4 transition cushions** — a "time to shift" nudge N min before each block.
- **T5 iOS Templates** — native grouped screen, one-tap apply → activity+checklist.
  (T2/T4/T5 verified on simulator: `browser-qa/ios-40/41`, KairoRound3Tour passes.)
- **T9 Smart Daily Brief** — morning orientation card on web Today (blocks +
  first-up + peak window). Build-verified + deployed; **live visual check was
  blocked** — the dev machine hit 99% disk and the agent-browser daemon started
  crashing (CDP channel closed). Freed ~7 GB but it stayed unstable. Reached
  `/app/today` signed-in; card is build-verified and mirrors the verified
  PeakFocusNudge pattern.
- **T17/T18 (partial)** — ran a round-2 UX audit (subagent, 27 findings) and
  applied the cheap must-fixes: iOS Focus control + editor-stepper VoiceOver
  labels, web QuickCapture save aria-label, iOS onboarding anchor copy
  reconciled with web, iOS Templates show step labels.

Ship gate: web lint+typecheck+**389 tests**+build green, deployed + live smoke
200; iOS build + Round3 tour green.

**Continuation ("do it all") — more iOS parity from the audit (all build- +
simulator-verified; full iOS suite green after fixing a selector regression):**
- iOS **Mood check-in** on Insights (Low/Okay/Good/Great → POST /api/v1/mood).
  Verified: `browser-qa/ios-42-mood.png`.
- iOS Focus **break flow** (Take a 5-min break → countdown → "I'm ready now";
  Keep going / Done for now) + **overtime inline actions** (Wrap up / +5 more,
  shows minutes past target).
- iOS **Day Rituals** on Today — morning "ease into today" (→ Templates) +
  evening "close the day gently" (→ Review), window-gated + dismissible.
- Fixed `KairoLiveActivityTest` selectors broken by the Focus done-state rename.
- (Earlier in this continuation: iOS VoiceOver labels, copy reconciliation,
  Templates step labels — committed under T17/T18.)

**Remaining (T1, T3, T6–T8, T10–T16, T19, T20):** the T18 audit surfaced the
highest-value next targets — iOS mood check-in, iOS break flow after focus,
iOS Day Rituals, iOS week-view semantics vs web, iOS soundscape parity, and
web push (T1). See roadmap + audit findings for the full list.

⚠️ **Environment note:** the dev machine's Data volume is ~99% full (only a few
GB free). This is degrading Xcode result bundles and the browser daemon —
worth clearing space before the next session.



## 2026-07-21 — Round 2: 10-phase program (Fable/Opus + subagents) — ✅ 10/10
Roadmap: `docs/plans/2026-07-21-round2-10phase.md`.

**iOS parity for the new web features** (all verified on simulator, shared
`ios/App/Features/Stats/Insights.swift` mirrors `src/lib/insights.ts`):
- R1 Reward Garden + R2 Weekly Reflection on Insights, R3 Focus rituals
  (horizontal chips), R4 Peak-focus nudge on Today. Evidence: `browser-qa/
  ios-30-focus-rituals.png`, `ios-32-insights-garden.png`. KairoRound2Tour passes.

**Depth:**
- R5 Procedural Web Audio soundscape engine (`src/lib/soundscape.ts`) — rain/
  forest(+chirps)/ocean(swell)/cafe/white-noise generated live; replaced the
  12-byte placeholder .ogg files; Focus rituals auto-start their vibe via a
  `kairo:soundscape` event. Live: ritual reframes session cleanly (audible
  playback needs a real audio device, not verifiable headless).
- R9 "Protect your peak": nudge one-tap creates a recurring daily focus anchor
  at the peak hour.

**Debts + hardening (subagents, verified):**
- R6 `useFocusTrap` hook wired into CommandPalette/QuickCapture/PickForMe/
  OneThing/KeyboardShortcuts.
- R7 copy sweep — 18 formal "Could not X." errors → warm contraction form.
- R8 45 unit tests for the insights derivations (web suite now 389 tests).

**Ship (R10):** web lint+typecheck+389 tests+build green, deployed to
time.neima.me + live-verified; full iOS suite TEST SUCCEEDED. Insights logic
extracted to `src/lib/insights.ts` as the single source both platforms use.



## 2026-07-21 — 20-phase 10× program, continuation (Fable + subagents)
Roadmap: `docs/plans/2026-07-20-20phase-program.md`. **✅ 20 of 20 phases done.**

- **P17 Landing showcase**: added a "The parts people fall for" section between
  the ADHD-problems grid and the feature grid — three crafted, theme-aware
  product mocks (Reward Garden, Focus rituals, Routines step player) matching
  the hero's quality bar (no raster screenshots → keeps Lighthouse 98–100 /
  a11y 100, responsive + dark-correct). Live-verified —
  `browser-qa/web-p17-showcase-dark.png`.

**Second continuation batch (P8, P14–P18, P19):**
- **P14 Focus rituals**: named session presets (Deep work / Quick win / Body
  double / Wind down / Creative flow) on the Focus setup — one tap sets
  title+emoji+duration+vibe. Verified live (interactive) —
  `browser-qa/web-focus-rituals.png`, `web-focus-winddown.png`.
- **P15 Peak-focus nudge** on Today: derives peak attention hour from
  focus-hours; offers to protect the window; dismissible once/day, silent under
  4 sessions of history. `PeakFocusNudge.tsx`.
- **P16 Energy-aware Plan-my-day**: low-battery days default to gentle planning
  + note; AI prompt sharpened to drop high-energy tasks on depleted days and
  under-fill. `PlanDayClient.tsx` + `ai.ts`.
- **P19 Copy pass** (from Sonnet audit): warmed the sync-conflict banner (no
  red/⚠), fixed block/activity terminology in shortcuts, standardized bare
  "Network error." copy, warmed formal error toasts, matched web empty states
  to iOS's voice, added inline CTA to web routines empty state.
- **P8 Lighthouse**: measured prod landing — perf 99→**100**, a11y 95→**100**
  after fixing the one failing color-contrast node (small text-iris→text-iris-deep
  on iris-soft; no token change). Re-measured live to confirm. No perf work
  needed (LCP 1.6s, CLS 0).
- **P18 Resumable onboarding**: step/name/picks persist to localStorage,
  restore after hydration, cleared on finish/skip; progress dots fill for
  completed steps. **Verified live** — reloaded mid-flow and it resumed at step 2
  with the name intact (`browser-qa/web-onboarding-resumed.png`).
- **P20**: full web gates green (lint, typecheck, 344 tests, build); iOS unit
  suite green; full iOS suite run for final sign-off. Deploys this batch all
  finished + live-verified on time.neima.me.

---
Roadmap earlier state: **12 of 20 phases done.**

**Shipped + verified this continuation:**
- **P9 web a11y sweep** (Sonnet subagent, verified): `aria-modal` on
  CommandPalette/QuickCapture/PickForMe dialogs; OneThing gained full
  `role="dialog"`/label + container-focus fallback; KeyboardShortcuts focuses
  Close on open; QuickCapture window-level Escape. Gates green. Deployed live.
- **P3 iOS Routines** (Fable, main loop): `Routine` wire models + `KairoAPI.routines()`;
  `RoutinesView` (cards + polished empty state) and `RoutinePlayerView`
  (full-screen calm player — per-step countdown ring, untimed ∞ steps,
  time's-up holds at zero, progress dots, next-step preview, pause/skip,
  gentle completion; reduced-motion + haptics). Wired into More; refreshed
  stale copy. `KairoRoutinesTour` UI test passes. Evidence:
  `browser-qa/ios-20-routines-list.png`, `ios-21-routine-player.png`
  (seeded a "Wind-down" routine on the synthetic QA account to capture the player).
- **P12 Reward Garden** (Fable): `RewardGarden.tsx` hero card on Insights —
  cumulative growth that never resets (5 plant stages by total effort + a
  meadow of blooms). Pure/derived, no new API. **Verified live** on
  time.neima.me showing "In Bloom · 28 planted" — `browser-qa/web-garden-live.png`.

Earlier in the program (already ticked): P1 iOS Stats, P2 iOS Pick-for-me,
P4 iOS Review, P5 iOS Play, P6 iOS Inbox tend, P7 WCAG-AA contrast token pass,
P10 security review, P11 server test coverage (+110 tests).

- **P13 Weekly Reflection** (Fable): `WeeklyReflection.tsx` "This fortnight,
  gently" card — 2–3 derived warm observations (best weekday, focus given,
  peak window, days shown up), gated on ≥3 completions. Pure/derived.
  **Verified live** — `browser-qa/web-insights-full.png`.

**Remaining (8): P8** prod-build Lighthouse measure+fix; **P14** focus
soundscape presets; **P15** peak-focus nudge;
**P16** energy-aware plan-my-day; **P17** landing polish; **P18** web onboarding
refinement; **P19** cross-platform copy/empty-state audit (subagent-friendly);
**P20** final gates + deploy + iOS suite green.

Deploys this session: Coolify `qqlhxs05…` (P7 contrast + security + tests) and
`jfwo9hn…` (P12 garden) both finished; live verified. Latest commit at handoff:
Reward Garden (530e186) + roadmap ticks.

## 2026-07-20 — iOS production program: 10 phases (Fable + subagent)

Plan: docs/plans/2026-07-20-ios-production-roadmap.md (all ticked).

1. **Interactive complete widget:** `CompleteActivityIntent` (App Intents) on
   the small "Next up" widget — flips the shared cache optimistically then
   PATCHes via `Shared/KairoRemote` (app-group cookie store so the widget
   process carries the session). Cache now carries id/revision/occurrenceKey.
2. **Live Activity buttons:** +10 (`ExtendFocusIntent`) and Done
   (`CompleteFocusIntent`) on the lock-screen banner (rebuilt as a VStack)
   and Dynamic Island expanded bottom; overtime tinting already shipped.
3. **Large + accessory widgets:** systemLarge "Today list" (5 rows + "+n
   more"), accessoryCircular (day-progress ring around ◔), rectangular
   (next-up), inline; all deep-link to kairo://today.
4. **First-run onboarding:** `OnboardingSheet` anchor picker (mirrors web),
   creates real activities (daily RRULEs), one-time via app-group flag.
5. **Settings:** theme override (system/light/dark → `.preferredColorScheme`,
   persisted), reduced-stimulation toggle, data links, sign out — verified
   Dark recolors the whole app.
6. **Resilient states:** `NetworkMonitor` (NWPathMonitor) → butter offline
   banner across all tabs.
7. **Accessibility:** timeline blocks expose complete/edit/focus/delete as
   VoiceOver custom actions + descriptive labels; progress ring has an
   accessibilityValue.
8. **API unit tests (subagent):** `KairoUnitTests` target, 15 golden
   decode/date-strategy/error cases, wired into the scheme.
9. **Refresh/haptics:** selection haptics on chips/toggles; consistent
   success/medium generators.
10. **Ship prep:** full suite green — **15 unit + 5 UI tests** (flow, live
    activity, deep link, tour, new-screens); onboarding + Settings-dark
    captured (browser-qa/ios-09/10).

Caveat unchanged: widget/intent networking + app-group cache read live data
once signing activates the group.me.neima.kairo entitlement (files in place).

## 2026-07-19 — iOS round 6: overtime island, medium widget, deep links (Fable)

- **Live Activity overtime** (ios-adaptation §4): when a session passes its
  target, the lock-screen banner + Dynamic Island (expanded/compact) switch
  the digits to the now-coral and count UP from the target, with copy
  "past target — that's okay" / "Good stopping point? Wrap up in the app."
  FocusView flips the ContentState exactly once at the zero crossing.
- **Medium "Today strip" widget** (spec §3): the day as up-to-4 mini
  category pills with a now-coral outline on the active block, a
  "n of m · N%" progress footer, and honest empty/all-done states
  ("All done. Go be free. 🎉"). Shares the same day cache; supportedFamilies
  now [small, medium].
- **Deep links:** `kairo://` URL scheme registered; both widget families
  carry `.widgetURL(kairo://today)`; app routes today/focus/inbox via
  onOpenURL. Scheme registration verified (simctl openurl → system
  "Open in Kairo?"), routing verified by XCUITest.
- Full suite (flow + live activity + tour + deep link) green against
  production.

## 2026-07-19 — iOS round 5: focus Live Activity + Dynamic Island (Fable)

Implemented ios-adaptation §4 — the focus timer now lives on the lock
screen and in the Dynamic Island:
- `Shared/FocusActivity.swift`: FocusAttributes (title/emoji/target) +
  ContentState (endDate, paused, frozen remaining) shared app↔extension.
- `Widget/FocusLiveActivity.swift`: lock-screen banner (emoji circle on
  sky, title + target line, self-ticking `Text(timerInterval:)` mono
  countdown — zero per-second pushes), Dynamic Island expanded/compact
  (◔ + live countdown)/minimal presentations; paused state freezes the
  digits and swaps in a pause glyph.
- FocusView lifecycle: start → Activity.request; pause/resume/extend →
  update; complete → end(.immediate). NSSupportsLiveActivities enabled.
  Gotcha fixed: the wire model named `Activity` shadowed ActivityKit's —
  qualified explicitly.
- **Verified on simulator:** dedicated XCUITest starts a session,
  backgrounds the app, and screenshots Springboard — the island renders
  ◔ + a live 24:54 countdown (browser-qa/ios-07-live-activity.png);
  session then completed in-app for cleanup. Full suite (flow + live
  activity + tour) green against production.

## 2026-07-19 — iOS round 4: checklists, inbox promotion, Next-up widget (Fable)

- **Checklist steps everywhere:** timeline blocks show up to 3 step lines
  when tall enough (+ "n/m steps" in the meta line); the editor gets a
  Steps section — tickable circles that persist immediately in edit mode
  (checklistOverride PATCH with revision chaining), add-step field, and
  new activities can be created with a checklist template.
- **Inbox → schedule:** swipe an inbox thought right → editor sheet opens
  prefilled at the next quarter-hour+30; saving creates the activity and
  clears the task (onCreated hook).
- **"Next up" widget** (WidgetKit, small — per ios-adaptation §3): app
  writes a day snapshot to a shared cache on every Today load and reloads
  widget timelines; the provider re-renders at every block boundary with
  no network — NOW dot for current, category-fill card, honest empty
  state ("Nothing planned — add something kind."). Cache write verified
  in the simulator container. Caveat (documented in ios/README): without
  signing, simulator processes use fallback containers, so live widget
  data needs the app-group entitlement active (files committed, wired in
  project.yml).
- Full XCUITest suite green against production after every step.

## 2026-07-19 — iOS round 3: edit, drag-to-reschedule, cleaner gestures (Fable)

- **Tap to edit:** tapping a block opens the editor sheet prefilled
  (title/emoji/category/time/duration); saving PATCHes with If-Match.
  Repeat chips hidden in edit mode (occurrence edits keep the series rule).
- **Drag-to-reschedule** (the ios-adaptation marquee interaction):
  long-press lifts the block (scale + medium haptic), drag moves it,
  release snaps to 15 minutes and PATCHes `editScope: this` + `startAt`
  (success haptic). Long-press now means drag ONLY — the old context menu
  conflicted, so Delete + "Focus on this" moved into the edit sheet as
  proper actions (danger-soft delete, iris-ghost focus).
- **Up next** line in the Today header card (emoji, title, "in N min").
- **Test flight extended and self-healing:** asserts editor prefill, drags
  the block ~60 min and verifies the accessibility label changed, then
  deletes through the edit sheet in a loop that also sweeps leftovers from
  any aborted runs (a real leak this session — purged server-side too).
- Full XCUITest suite green against production (flow 57 s + tour).

## 2026-07-19 — iOS round 2: Week tab, day nav, context actions, launch polish (Fable)

- **Week tab** (5-tab layout now matches the ios-adaptation spec): next 7
  days fetched concurrently as gentle cards — TODAY chip, per-day planned
  total, compact category-tinted rows, "Nothing planned — space is
  allowed." empty copy.
- **Today day navigation:** chevrons page ±days (branded title updates,
  tap title to jump back to today); now-line/"now" affordances only on the
  real today.
- **Block context menu** (long-press): "Focus on this" — switches to the
  Focus tab with title/emoji/duration prefilled via NotificationCenter —
  and destructive "Delete activity" (If-Match delete + haptic).
- **Launch screen** now uses a canvas-colored LaunchBackground asset
  (light+dark) instead of default white.
- **Test hygiene:** the E2E flight is now self-cleaning — it deletes its
  own "iOS flight check" through the context menu (exercising the delete
  path); purged 7 leftover duplicates from earlier runs off the live QA
  account; FAB label made distinct ("New activity") after the empty-state
  collision surfaced.
- **Full XCUITest suite passes against production** (flow 40 s + tour);
  fresh per-screen evidence exported (browser-qa/ios-0*.png incl. Week).

## 2026-07-19 — Kairo for iOS: native SwiftUI app, live-API verified (Fable)

**New:** `ios/App` — a production-quality native iOS app (iOS 17+, XcodeGen,
no signing yet) implementing the core loop against https://time.neima.me:
- **Theme** (`KairoTheme.swift`): every Soft Focus token as exact light/dark
  dynamic colors; Bricolage Grotesque / Onest / Spline Sans Mono bundled
  (variable TTFs + OFL licenses, fetched by subagent); card/float shadows,
  category palette enum.
- **API client** (`KairoAPI.swift` actor): Better-Auth cookie sessions,
  If-Match revisions, x-timezone seeding, typed errors; day/activities/
  tasks/focus/settings endpoints.
- **Screens:** SignIn (brand card, sign-up toggle), Today (proportional
  timeline 1min=1.7pt, hour rules, now-line, adaptive day bounds, progress
  ring header, branded Bricolage title, FAB), Editor sheet (emoji menu,
  category dots, steppers + duration chips, repeat chips), Inbox (composer,
  aging chips, swipe-to-delete), Focus (server-authoritative ring timer,
  overtime counts up in butter, done state), More (timezone, web
  superpowers, sign out).
- **App icon** generated (iris field, ◔ mark).
- **Tests:** XCUITest E2E flight — sign in with the labeled prod QA account,
  create "iOS flight check", complete it, visit all tabs — **passes against
  production** (30 s); screenshot tour test exports per-screen evidence
  (browser-qa/ios-0*.png, light + dark captured).
- Pre-existing Phase-7A SPM contract library left intact at `ios/Kairo`.

**Fixed along the way:** XcodeGen Info.plist duplicate-task trap; SwiftUI
`.frame(height:)` centering the timeline canvas (needed `alignment: .top`);
`FocusState` name collision with SwiftUI's property wrapper.

**Honest gaps:** no signing/TestFlight (needs Neima's Apple account);
widgets/Live Activity/drag-reschedule are next per ios-adaptation.md;
week view not in v1 (tab layout: Today/Inbox/Focus/More).

## 2026-07-19 — 10× ADHD wave 4: first-run & frictionless (Fable)

**Plan:** `docs/plans/2026-07-19-10x-adhd-wave4-roadmap.md`.

**Shipped (all browser-verified on a fresh account, qa-w4@kairo.test):**
1. **Onboarding 2.0** — 3 skippable steps, ≤60 s: name+auto-timezone →
   "pick your anchors" (6 starter blocks, tap-to-toggle, one Create makes
   real activities; daily ones get FREQ=DAILY) → superpowers card (C /
   Pick-for-me / brain breaks). Verified: fresh account → 3 anchors on
   Today with NowBar/Up-next live.
2. **Command palette** — ⌘K/Ctrl+K, fuzzy subsequence across nav + actions
   (capture, one-thing, new activity, review, play…), keyboard-first.
   Verified: "cap" → Quick capture opens via Enter.
3. **Inbox gardening** — "resting N days" butter chips at ≥7 d; ≥3 old →
   "🪴 Tend the garden?" card with one-by-one Keep/Schedule/Let-go flow
   (deletion verified server-side, tombstoned).
4. **Editor friction** — free minute input (5–480) + duration chips
   (15/25/45/60/90) + start chips Now/+30/Tonight 20:00. Verified: Tonight
   + 35 min → block at 20:00 local.
5. **Focus checklist ticks** — linked sessions fetch the activity checklist
   and steps are checkable mid-session (checklistOverride PATCH with
   If-Match + occurrenceKey threaded through all focus links). Verified:
   tick persisted to the day's occurrence.
6. **PWA shortcuts** (subagent) — manifest shortcuts: New activity /
   Quick capture (?capture=1 opens the sheet) / Focus / Brain breaks.
7. **Slot it** — wand button on Anytime items: `firstFreeSlot` (pure,
   exported) finds the first ≥30 min gap from now before 22:00 honoring
   15-min snapping; creates the activity, clears the task. Verified:
   "Slotted at 16:45" — correctly skipped a 15-min sliver and a busy block.

**Phases 8–9 (subagent):** a11y fixes applied — nav landmark moved off the
aside onto the real <nav>, Play card headings h3→h2, <main> landmarks on
landing + onboarding. Deferred honestly: token-driven contrast (needs a
design-token pass), TimelineCanvas nested-interactive pattern (needs an
interaction redesign, flagged). Lighthouse mobile (dev server): / = 93,
CLS 0; /app/today unmeasurable under next dev (dev-runtime artifact — re-
measure on prod build). **Gates: lint 0/0, typecheck, 234 tests, build.**
7 new firstFreeSlot tests (moved to src/lib/slots.ts).


## 2026-07-19 — Grammar Snap 10×: 66-item topic bank + tricky-ones practice (Fable)

**Bank:** GRAMMAR_BANK grew 16 → 66 items across ten topics (sound-alikes,
apostrophes, agreement, pronouns, comparisons, tricky verb pairs, past
tense, word choice, double negatives), each with a kind memory-hook note.
`QuizItem` gained `topic`; `QUIZ_TOPIC_LABELS` renders a small chip on
questions.

**Picker:** `pickQuizRounds` now guarantees topic spread (≤2 per topic per
draw, shortfall fill) so a run never becomes eight rounds of its/it's.

**Practice loop (the real 10× move, engine-level so Spell Check gets it
free):** wrong answers are remembered per game (localStorage, deduped,
capped 40); once ≥3 pile up the game opens with a chooser — "My tricky
ones (N)" vs "Fresh eight". Practice runs replay exactly the missed
prompts; a correct answer redeems it off the list ("Redeemed — off the
tricky list it goes"), practice never touches the personal best, and full
clears get "Full redemption — every one of those had beaten you before.
Not anymore."

**Verified in browser:** fresh run 5/8 → 3 misses recorded → chooser
rendered with count + best chip → practice run → "3 of 3, Full
redemption" → localStorage miss list = 0; mobile question layout with
topic chip. Gates: lint 0/0, typecheck, tests (subagent extending
games.test.ts), build.

## 2026-07-19 — Word games: Grammar Snap + Spell Check (Fable)

Extended the Brain Breaks arcade (wave 3) with two language games built on
one shared engine:
- **`games/QuizGame.tsx`** — generic 8-round tap-a-choice engine: instant
  kind feedback (wrong answers get butter, never red, plus a one-line
  memory hook), score /8, personal best, celebration on new best.
- **`GRAMMAR_BANK`** (16 items: your/you're, its/it's, their/there/they're,
  then/than, affect/effect, whose/who's, lose/loose, should-have, etc.) and
  **`SPELLING_BANK`** (16 famously slippery words with convincing impostor
  spellings + mnemonic notes) in `src/lib/games.ts`, plus `pickQuizRounds`
  (seeded bank shuffle + per-item option shuffle so the answer position
  varies).
- Hub now has 6 cards (sky Grammar Snap 📝, rose Spell Check 🔤); Stats
  Brain-breaks card shows both bests.
- Tests (subagent): bank validity (answer∈options, unique options, 2–3
  choices, ≥8 items) + picker determinism/no-mutation/permutation — 17 new,
  **213 total**.

**Verified in browser:** Grammar Snap full 8-round scripted run → "3 of 8"
end state with kind copy + new-best badge (first-option strategy scoring 3
proves option shuffling works); Spell Check question render (recieve/
receive/receeve) + full run; hub cards + best chips. Gates: lint 0/0,
typecheck, 213 tests, build — green.

## 2026-07-19 — 10× ADHD wave 3: Brain breaks arcade (Fable)

**Plan:** `docs/plans/2026-07-19-10x-adhd-wave3-roadmap.md` (all ticked).
**Research:** `docs/research/adhd-brain-games-2026.md` (subagent): time-
reproduction deficits are among ADHD's most replicated findings (5–60 s
tasks) → Time Feel is legitimate + on-brand; personal-best framing, hard
session caps, contextual offering; Lumosity's FTC fine = the overclaim
cautionary tale (hence the "Honesty corner" copy).

**Shipped:**
1. **/app/play arcade** (`PlayClient` + `games/GameShell`): four pastel game
   cards with localStorage bests, honesty-corner footer ("breaks, not brain
   training"). Nav: sidebar Play item, More tile, `g` shortcut.
2. **Time Feel** — signature game: reproduce 5/8/12/20 s without a clock;
   kind per-round feedback ("felt shorter — a fast-running brain"), score
   100−mean|error|%, ties back to the product ("your timeline does the
   feeling for you").
3. **Quick Tap** — 5 reaction rounds, early-tap forgiveness, avg ms best,
   space-bar playable.
4. **Emoji Match** — 8 category-emoji pairs, fewest-moves best, scripted
   full-solve E2E verified (8-move perfect game → "New personal best").
5. **Steady Breath** — box breathing 4-4-4-4, 1 or 2 min, expanding square
   (static under reduced motion/stim), cycle counter, zero grading.
6. **Integration:** focus break + break-over states link "play a brain
   break →"; Stats gets a client-only "Brain breaks" bests card.
7. **Delight:** DayDoneRain — first all-done moment of a day fires a 6-burst
   particle cascade (once per date, reduced-motion safe). Existing branded
   404 kept (already good).
8. **Tests:** `src/lib/games.ts` pure logic + `games.test.ts` (24 tests,
   subagent) — scoring, deck validity, delay bounds, localStorage bests.

**Verified in browser:** hub, Time Feel round ("5.2s — spot on"), Quick Tap
round (1085 ms), match grid + scripted win, breath cycle running; light
mode; nav + shortcut. **Gates:** lint 0/0, typecheck, **196 tests** (21
files), build — green.

**Residuals:** games are this-device only by design (no server surface);
dark-mode game screenshots not captured individually (all token-based);
dev server on this machine keeps getting reaped between commands — restart
with nohup + health check before browser QA.

## 2026-07-19 — 10× ADHD wave 2: all 10 phases shipped (Fable)

**Plan:** `docs/plans/2026-07-19-10x-adhd-wave2-roadmap.md` (all ticked).

**Shipped (browser-verified locally):**
1. **Repeat control in the editor** — five friendly chips (none/daily/
   weekdays/weekly-on-day/every-N) building real RRULEs; edit mode parses the
   rule back (unknown shapes preserved as "Custom"); ↻ glyph on recurring
   timeline blocks. Verified: daily appears tomorrow; weekday rule created on
   Sunday skips Sunday, lands Monday; edit-mode chip aria-pressed.
2. **RoutinePlayer** — full-screen step runner (per-step countdown ring,
   auto-advance with 2 s "next up" beat, pause/+1 min/skip/Esc, done state
   with celebration + honest skipped-count). Play button on routine cards.
3. **NL magic capture** — parse service now grounds relative dates in the
   user's zone and returns date/startMin; QuickCapture ✨ button (only when
   health.checks.ai=ok) → confirm chip → accept creates a scheduled activity
   or dated task (SEC-05: never auto-saves). E2E verified with the LLM call
   mocked in-page: chip → "Add to timeline" → activity at 2026-07-20 15:00 NY.
   NOTE: live LLM blocked — Anthropic key has no credit balance (fallback
   toast path verified live).
4. **Day rituals** — morning kickoff (<11:00, <2 activities: Plan with AI /
   template / copy-yesterday) + evening shutdown (≥19:00, unfinished: review /
   carry-all-to-tomorrow); per-day dismissal; ?ritualDebug=(morning|evening)
   override on localhost only. Copy-yesterday round-trip verified (4 one-offs
   cloned, recurring excluded).
5. **Low-battery mode** — per-day toggle (localStorage + window event): high-
   energy blocks dim + "heavy for today" tag, PickForMe deprioritizes heavy
   picks, softened header note. Verified: dim+tag+persistence.
6. **Stats truth** (subagent) — real bug found: computeStreak used UTC
   "today" against zone-bucketed keys (late-evening completions could zero
   the streak); fixed + extracted pure bucketEventsByZoneDate; new
   computeFocusHours 24-cell heat strip card (≥5 sessions, 30 d); 12 new
   tests (172 total).
7. **Mobile motion** — editor is a true bottom sheet on mobile (sheet-up
   keyframe, drag handle, 94dvh scroll); Esc + focus-primary on PickForMe/
   OneThing; active:scale press states on primary CTAs.
8. **Offline/perf** (subagent) — SW cache kairo-v3-wave2adhd + explicit
   no-store for /api; new settings-cache (60 s TTL, invalidated on PATCH)
   used by NowBar/TimezoneNudge; measured exactly 1 settings GET per page
   view (was 2–3).
9. **Landing ADHD story** — new "five ways planners fail ADHD" section with
   six mini product mocks in pure tokens (now card, pick card, overtime
   banner, capture input, one-thing, no-red review); footer honesty line.
10. **Also fixed:** Intl hour parsing hardened to hourCycle:"h23"
    (hour12:false has env-dependent quirks).

**Gates:** lint 0/0, typecheck, **172 tests** (20 files), build — green.

**Residuals:** live LLM parse needs Anthropic credits (Neima); routine player
logs no planner_events yet (deliberate — no events API for it); ritualDebug
param is localhost-gated by hostname.

## 2026-07-19 — agent-browser QA sweep of the 10x ADHD program (Fable)

Full signed-in dogfood of commit 95e1e28's features using the agent-browser
CLI (real Chrome, trusted clicks) against local dev + kairo_dev.

**Verified working end-to-end:** sign-in; TimezoneNudge UTC→America/New_York
(day re-resolves, header/date/now-line all correct across the zone change);
adaptive timeline hours (4 AM block on-canvas + clickable); checklist step
persistence; QuickCapture (`c` → type → Enter → task in inbox, sheet UI);
completion celebration (10 particles + persisted done); DayLoadMeter ("3.8 h
planned · a light day"); PickForMe (ranking, "Something else" re-roll, honest
slipped-copy); focus flow (linked session start, live tab-title countdown
"59:57 · …", session-done "N min of real focus" screen, 5-min break timer
with "☕ 04:58 break" tab title); OneThing empty state.

**Bugs found & fixed:**
1. PickForMe's "Start N min" link dropped `activityId` — focus sessions from
   a pick weren't linked to the activity (breaks time-truth logging). Now
   passes it for activity candidates (verified via HMR: href carries the id).
2. TimezoneNudge didn't refresh the NowBar after switching zones — the bar
   kept showing the old-zone day until reload. Now fires `notifyDayChanged()`.
3. InstallPrompt covered the last timeline block's Complete button
   (agent-browser's covered-element check caught it). Desktop position moved
   bottom-left + 15 s session-only auto-hide (re-offers next visit;
   permanent dismissal unchanged).

**Tooling notes:** agent-browser daemon needed one restart (wedged snapshot);
`find role button click` intermittently misses — ref-clicks via `snapshot -i`
are reliable. Claude's in-app browser pane remains flaky (0×0 viewport after
navigation; screenshot-first unwedges).

**Gates:** lint, typecheck, 161 tests (20 files), build — green.
## 2026-07-19 — 10× ADHD program: all 10 phases shipped (Fable)

**Plan:** `docs/plans/2026-07-18-10x-adhd-roadmap.md` (all boxes ticked) +
research `docs/research/adhd-features-2026.md` (subagent, competitor mechanics
+ pitfalls). Executor prompt: `docs/plans/10x-adhd-agent-prompt.md`.

**Shipped (all browser-verified locally, light+dark, desktop+375px):**
1. **NowBar** (`NowBar.tsx`): NowProvider context in AppShell fetches
   `/api/v1/day/{today}` (5-min refresh + visibilitychange + `kairo:day-changed`
   event), 30 s clock tick. Desktop sidebar Now card (live red dot, countdown)
   + mobile strip above tab bar; both link to Today; hidden on /app/focus and
   when nothing's left. ⛶ button / `o` opens One Thing.
2. **Celebration** (`Celebration.tsx` + `kairo-burst` keyframes): particle
   burst at the completion point (timeline complete + review "I did it");
   skipped under reduced-motion/reduced-stimulation. DayProgress: halfway copy,
   100% → success "Done!" chip; Today all-done banner ("Day done — everything
   happened."). ToastHost moved to AppShell (per-page mounts removed).
3. **QuickCapture** (`QuickCapture.tsx`): `c` anywhere / ✎ mobile button →
   sheet; Enter saves to inbox (Undo toast), Shift+Enter chain-dumps with
   counter; Web Speech dictation when the browser has it (not testable
   headless — code path guarded).
4. **Focus 10×** (`FocusClient.tsx`): overtime guard (+count-up ring, butter
   banner "Good stopping point?", Wrap up / +5), Session-done state (focused
   minutes + break/keep-going/done), local 5-min break timer with break-over
   state, live tab title (mm:ss · title / +N min over / ☕ break). Verified
   E2E with a 1-min session.
5. **PickForMe** (`PickForMe.tsx`): Today header + Inbox; deterministic order
   now → next → slipped → tasks (priority-weighted); "Just this" card with
   Start-focus link + shuffle.
6. **Time truth** (subagent, verified): focus_stop payload now logs
   targetDurationMin + elapsedMin; `computeEstimateCalibration` (≥5 sessions,
   14 d window, <3 min excluded) + 6 unit tests; Stats card + editor hint
   (ratio ≥1.3).
7. **Transition warnings**: Settings toggle (notificationPrefs, permission
   asked only on opt-in) → NowProvider boundary scheduler (start + 5-min-
   before-end, in-app toast always, system Notification only when granted and
   not reduced-stim). Verified live: toast fired at a real activity boundary.
8. **Overwhelm tools**: DayLoadMeter (planned vs 16 h window, 3 bands, "Lighten
   it →" → review) + OneThing full-screen mode (`o`/⛶, current/next/next-step,
   Focus link, empty state "Rest counts too").
9. **Polish**: install banner → bottom-right on desktop / above FABs on mobile
   (it was covering primary CTAs); dynamic timeline canvas hours (5 AM block
   now on-canvas — fixed off-canvas unclickable blocks); LiveNowLine
   pointer-events fix (was swallowing clicks on blocks under it); shortcuts
   help updated (c/o).

**Gates:** lint, typecheck, **161 tests**, build — green.

**Known follow-ups:** Stats week bars may bucket completions to the wrong
weekday for non-UTC zones (pre-existing; investigate `getStats` bucketing);
editor bottom-sheet animation + inbox swipe actions deferred; voice capture
needs a manual mic test on a real device; Web Push/server cron still gated on
CRON_SECRET env.

## 2026-07-18 — Polish pass: first-run crash, timezone correctness, auto-scroll (Fable)

**Found by dogfooding a brand-new account in agent-browser:**
1. **P0 first-load crash** — `getOrCreateSettings` get-then-insert raced when two
   Server Component renders hit a fresh account simultaneously; second insert
   violated the PK and Today rendered the error boundary as the user's very
   first screen. Fixed with `onConflictDoNothing` + re-read. Same guard added
   to the `listCategories` six-category seed (partial unique index made the
   loser crash there too).
2. **New accounts planned in UTC** — `detectTimezone()` existed but was never
   called; settings rows were created with `timezone: "UTC"` so the now-line,
   day bounds and "Up next" ran in the wrong zone until Settings was touched.
   Fixes: (a) `AuthForm` seeds `x-timezone` via `GET /api/v1/settings` before
   redirecting into the app; (b) new `TimezoneNudge` banner on Today offers a
   one-tap switch (PATCH with If-Match) for accounts already stuck on UTC,
   with a persisted "Keep UTC" dismissal.
3. **Auto-scroll to now finally works** — `LiveNowLine`'s scroll effect
   targeted a `.timeline-scroll-container` div that was never scrollable (the
   window scrolls), so Today always opened at 7:00 AM. Now `scrollIntoView` on
   the line itself (skips when already in view; instant under reduced motion).
4. **Install banner covered the auth CTA** — the PWA prompt overlapped
   "Create planner" on sign-up; it now only renders inside `/app`.
5. **Copy** — duration option "1.5 h 30m" → "1 h 30 min".
6. **Signed-out demo now-line** showed UTC time; mock path passes empty zone
   so the live line uses the visitor's browser clock.

**Verified (agent-browser, local dev):** fresh signup → clean empty state (was
crash); nudge rendered + "Use New York" applied (now-line 19:38 local, ring
19:40 = browser clock on the mock view); auto-scroll centered the line on
desktop + 375px mobile; auth pages banner-free.

**Gates:** lint, typecheck, 155 tests, build — green.

## 2026-07-18 — Review Wave 2 COMPLETE (hardening) + ship

**Plan:** `docs/superpowers/plans/2026-07-18-review-wave2-hard-hardening.md`

**Shipped:**
1. **Atomic If-Match** — all DAL update/delete + focus transitions use `WHERE revision = ?`; zero rows → ConflictError
2. **Transactional change_log** — mutations wrap write + log in `db.transaction`; `appendChangeLog` no longer swallows
3. **Routine materializer** — stable sourceRef dedupe, nextRunAt advance, zone wall fields, step duration sum; double-run test green
4. **Jobs tick** — `POST /api/v1/jobs/tick` with `CRON_SECRET`; health `checks.scheduler`
5. **Idempotency-Key** — 48h store/replay on POST tasks + activities
6. **OpenAPI inventory test** — path ↔ handler allowlists; list GETs return `nextCursor: null`
7. **Origin/CSRF** — proxy rejects cross-site Sec-Fetch-Site + mismatched Origin on `/api/v1` mutations
8. **Migrate honesty** — failed migrate tracked; health 503; batch rate limit
9. **Client editScope** — drag/review tomorrow use `this` + occurrenceKey; `clientToday(zone)`; week/month RRULE expand

**Gates:** lint, typecheck, **155 tests**, build green.

**Ops residual (env, not code):** set `CRON_SECRET` in Coolify + schedule cron → `/api/v1/jobs/tick`; optional `TRUSTED_ORIGINS`.

---

## 2026-07-18 — Full-app code review + Wave 1 critical fixes

**Review:** 4 domain agents (security/API, DAL/services, UI/client, contracts/iOS).
- Master: `docs/plans/2026-07-18-full-app-code-review.md`
- Domains: `docs/plans/2026-07-18-full-review-*.md`
- Plans: `docs/superpowers/plans/2026-07-18-review-wave1-critical-fixes.md`,
  `…-wave2-hard-hardening.md`

**Wave 1 shipped (executed with subagents):**
1. **Focus pause math** — pause no longer credits running time; remaining freezes while paused (`focus.ts` + pure tests).
2. **ICS SSRF (SEC-04)** — `isPublicIp`, DNS public-IP check, manual redirects max 3 (`calendar.ts` + 15 IP tests).
3. **Batch denylist** — reject nested `/api/v1/batch`; path normalize (`batch/path.ts` + tests).
4. **409 retryable: false** — conflicts are terminal for offline clients.
5. **AI/ICS error hygiene** — no raw exception messages to clients.
6. **Day RRULE expansion** — `expandActivitiesForDay` + `getResolvedDay` (DAILY/WEEKLY appear on later days; checklist overrides merge).
7. **Checklist toggle** — `editScope: "this"` + `checklistOverride` (no longer rewrites series template for all future days).
8. **Live now-line** — uses planning zone via `dateToMinutesFromMidnight`.

**Gates:** lint, typecheck, **145 tests**, build — all green.

**Not fixed (Wave 2+):** atomic `WHERE revision=?` TOCTOU, routine materializer, Idempotency-Key store, OpenAPI↔handler inventory, batch self-HTTP→in-process, week/month RRULE expansion, email verification, Origin CSRF, offline queue wiring, ADR-004 cron, iOS scaffold gaps.

---

## 2026-07-18 — Wave 5: daily-driver interactions (Fable)

**Shipped:**
1. **Real "Up next" rail card for authed users** (`/app/today`): server
   computes the earliest not-done, not-fully-past activity in the user's zone
   (today only); card shows "Up next"/"Happening now", `start · in N min` /
   `N min left`, and a Start focus link carrying
   title/emoji/duration/activityId into `/app/focus`. Signed-out keeps the
   mock card.
2. **Tappable checklist steps on the timeline**: steps in non-compact blocks
   are now buttons (aria-pressed, optimistic toggle, drag-safe via pointer
   stopPropagation). `TodayTimeline.handleToggleStep` PATCHes the full
   `checklistTemplate` with If-Match; conflict → toast + revert.
3. **Undo for inbox delete**: `Toast` now supports an action button
   (`toast(msg, {actionLabel, onAction, durationMs})`); delete shows
   "Deleted 'X' [Undo]" for 8 s; undo re-creates the task (same
   title/emoji/priority — id/revision change).

**Verified (local dev, synthetic account `qa-wave5@kairo.test` in kairo_dev):**
sign-up via Better Auth API; Up next card rendered with correct meta + focus
link (DOM-verified); checklist toggle exercised with a trusted browser click —
server persisted `[true,false,false]` rev 4 and UI flipped to "Uncheck step";
inbox delete + undo toast rendered (screenshot). Known gap: the Undo button's
click wasn't exercised end-to-end — the 8 s toast outpaces browser-pane round
trips; its POST path was verified directly 3×. Browser pane also served 0×0 /
stale frames after navigations this session (screenshot-first unwedges it).

**Gates:** lint, typecheck, 113 tests, build — all green.
## 2026-07-18 — Design elevation pass, round 2 (Fable)

**Audited previously-unseen surfaces** (sign-in/up, onboarding, more, month,
planner, templates, review, editor) **+ dark mode across landing/today/editor.**

**Shipped:**
1. Review screen: fixed "3 thingsdidn't happen" — compiled JSX was eating the
   space between the plural expression and the text node; headline is now a
   single template literal (also upgraded to a proper apostrophe).
2. Templates: six full-width `bg-iris` "Apply to Today" buttons downgraded to
   quiet `iris-soft` chips (hover fills iris); step lists `flex-1` so buttons
   bottom-align across cards. Content now leads the page.
3. Editor: selected Priority chip `bg-ink` (near-black, off-system) → `bg-iris`;
   Energy chips `whitespace-nowrap` (Medium no longer wrapped under its icon).
4. Dark mode: past timeline blocks were muddy-olive (`saturate-50` on deep
   fills) — new `.timeline-past` class in globals.css keeps light behavior,
   switches dark to opacity-only.
5. Motion: `--ease-spring` was defined but unused — added `kairo-rise`
   entrance (from-only keyframe so dimmed blocks never flash to full opacity;
   collapsed by the global reduced-motion rule) on timeline blocks (30ms
   stagger, 240ms cap) + Today right rail.

**Verified:** review headline text via DOM, templates/editor/today (light+dark)
screenshots, full landing at 1280×1700, iris-button contrast in dark measured
4.9:1 (AA pass). Lint + build green. Note: the in-app browser pane served
stale blank frames when scrolled below the fold on the landing page — page
confirmed healthy via DOM inspection + tall-viewport capture; pane glitch, not
an app bug.

**Shipped (all Soft Focus tokens, no new colors):**
1. `TimelineCanvas`: fixed checklist overflow bleeding into the next block
   (`overflow-hidden` + height-aware `checklistRows` — lines only render when
   the block is tall enough).
2. `FocusClient`: skeleton ghost-ring loading state (was bare text); idle setup
   redesigned — 15/25/45/60 min segmented pill (live ring + header update),
   Play-icon start button, emoji+title composer card; ring progress now
   animates (`stroke-dashoffset` 1s linear).
3. Week view: day columns `min-h-44/lg:min-h-64` (no more stubby cards),
   "n planned this week" subline, hover-reveal "+ Add" on filled days,
   centered dashed add-zone on empty days.
4. Inbox: High-priority flag danger-red → peach (honors "Nothing here ever
   turns red").
5. New `src/components/EmptyState.tsx`: `SignedOutCard` (icon tile, display
   headline, CTA + create-account link), `SkeletonCards`, `SkeletonRows`.
   Wired into Stats (signed-out + loading) and Settings (signed-out + loading).
6. Routines: tiles now id-hashed across the six category pastels (was all
   butter); designed empty state.

**Verified:** real browser, desktop + mobile (375px) — today/focus/week/inbox/
stats/settings/routines screenshotted; duration chips click-tested; lint +
build green. Not deployed (not requested).

## 2026-07-15 — 10× Wave 4 COMPLETE: PWA icons, ICS import, Resend, keyboard UX

**Program:** `docs/plans/2026-07-15-10x-wave4-roadmap.md` — all 10 phases.

**Shipped:**
1. `public/icon-192.png`, `icon-512.png`, `favicon-32.png` + layout icons.
2. `POST /api/v1/calendar/ics` + Settings Calendars import UI (SEC-04 fetch).
3. `src/server/email.ts` Resend transport; auth magic/reset/verify use it when keyed.
4. Timeline checklist chips; FocusClient steps list.
5. `POST /api/v1/ai/group-priority` + Inbox “Group by priority”.
6. `KeyboardShortcuts`: `n` new activity, `?` help.
7. Landing CTAs → onboarding; removed unused Next.js public SVGs.
8. Rate-limit create activities/tasks (60/min/user).
9. `calendar.test.ts` (parser + SSRF protocol guards); vitest hookTimeout 90s.
10. **101 tests** pass; build green; ship + Coolify.

**Residual:** Resend/Anthropic keys in Coolify env; full authed browser session optional.

---

## 2026-07-15 — 10× Wave 3 COMPLETE: auth recovery, PWA SW, empty states, tests

**Program:** `docs/plans/2026-07-15-10x-wave3-roadmap.md` +
`docs/plans/10x-wave3-agent-prompt.md`. All 10 phases ticked.

**Shipped:**
1. `/forgot-password` + `/reset-password` (Better Auth request/reset).
2. Magic-link client plugin + “Email me a magic link” on sign-in.
3. Routines authed empty state (no mock library as fake user data).
4. `ServiceWorkerRegister` in root layout (prod only).
5. `src/lib/adapters.test.ts` — 5 pure unit tests (97 total suite).
6. Settings account delete type-to-confirm + onboarding link.
7. Today “Review” chip; More menu Review + Onboarding.
8. Parity checklist evidence refresh (E01/E02/A03/C01/K03/L01).
9. Gates green; live smoke after deploy.
10. Ship to main + Coolify.

**Gates:** lint 0 errors, typecheck, **97 tests**, build green.

**Residual (external):** Resend / Anthropic keys, Coolify staging UI, GH Actions
budget, full authed browser session dogfood optional.

---

## 2026-07-15 — Finish line: Anytime rail, live nowMin, plan-day, offline shell

**Closed remaining Wave 2 boxes (14, 18) + extras:**
- **AnytimeRail:** schedule → editor; clear → DELETE task with If-Match.
- **Live nowMin:** `useLiveNowMin` drives past/current block styling + now-line.
- **OfflineShell:** mounts offline queue for signed-in user in AppShell.
- **Plan my day:** `POST /api/v1/ai/plan-day` + interactive `PlanDayClient` on
  `/app/planner` (accept opens editor — SEC-05 no auto-mutate).
- **Focus history:** focus_start / focus_stop → planner_events.
- Roadmaps fully ticked (Wave 1 + Wave 2 trackers).

**Gates:** typecheck, lint 0 errors, 92 tests, build green (after clearing
disk ENOSPC via `rm -rf .next`).

**Ship:** commit + push + Coolify deploy; live verify new routes 401 not 404.

**Honest residual (external, not code-blocked):**
- Resend not provisioned → magic-link/reset emails only log in dev.
- Coolify staging + automated backups still UI-only (1B).
- GitHub Actions budget if still exhausted.
- Authed live create/complete with real browser session not re-proven this pass
  (API surface + prior Wave 1 evidence stand).

---

## 2026-07-15 — 10× Wave 2: routines, stats, AI, month, batch, deploy

**Program:** `docs/plans/2026-07-15-10x-wave2-roadmap.md` +
`docs/plans/10x-wave2-agent-prompt.md`.

**Ticked:** 1–13, 15–17, 19–20 (14 Anytime rail + 18 perf left thin).

**Shipped:**
- **P1 Deploy Wave 1:** Coolify deploy `d6sicrx4jpmrwmz1iyniwc5j` finished on
  commit `c0b68d8`. Live: `/app/editor` `/app/today` `/app/focus` → 200;
  screenshot `browser-qa/wave2-live-editor.png`.
- **P2–4 Routines:** DAL CRUD + steps/schedules; REST list/create/patch/delete +
  schedule pause; `RoutinesClient` create/pause/use-today/delete.
- **P5–7 Insights:** `GET /api/v1/stats`, `POST /api/v1/mood`, `StatsClient` UI;
  complete/skip/uncomplete append `planner_events` in activity PATCH.
- **P8 Month:** real dots + `?ym=` nav + day → Today links (zone-aware).
- **P9 AI:** `POST /api/v1/ai/breakdown` + `/parse` (SEC-05, 503 without key);
  editor “Break it down” wired.
- **P10 Focus from Today:** timer button on blocks → `/app/focus?...`.
- **P11 Batch:** `POST /api/v1/batch` ordered fan-out.
- **P12 Auth:** Better Auth `magicLink()` **plugin** (was silent top-level no-op).
- **P13 SW:** cache version `kairo-v2-wave2`.
- **P15 Toasts:** `Toast` host on Today/routines/stats; save/complete feedback.
- **P16 SoftStreaks:** reads `/api/v1/stats` streak.
- **P17 Escape** closes activity editor.

**Gates:** typecheck, lint 0 errors, 92 tests, build green (new routes listed).

**Live after Wave 2 deploy:** re-trigger Coolify after this commit lands; verify
`/api/v1/stats` → 401 (not 404) when logged out.

**Parity:** still 88.46% / 86.52% planned; evidence rows not mass-updated.

**Next:** Anytime rail write actions (14), live nowMin (18), dogfood authed create
on live with real session, Resend for magic-link emails.

---

## 2026-07-14 — 10× 20-phase program: core product loop shipped (Phases 1–7, 9–11, 13)

**Program:** `docs/plans/2026-07-14-10x-20-phase-roadmap.md` + executor prompt
`docs/plans/10x-20-phase-agent-prompt.md`. Goal: turn server-complete foundation
into a daily-usable planner write loop.

**Ticked this session:** 1, 2, 3, 4, 5, 6, 7 (partial), 9, 10, 11, 13.  
**Open:** 8 (routines write UI), 12 (stats UI), 14–20 (AI routes, auth polish,
offline, a11y, perf, dogfood, deploy handoff — deploy still pending this note).

**Shipped:**
- **Phase 1:** `PATCH /api/v1/activities/{id}` wired to `editSeriesOccurrence`
  (was 501). ConflictError/NotFoundError mapping; field whitelist; occurrenceKey
  on update schema.
- **Phase 2:** Real `ActivityEditor` + FAB → create; categories/settings load;
  checklist template; redirect to Today.
- **Phase 3:** Complete toggle on timeline blocks (`editScope=this` + status);
  double-click/Enter open editor; delete from editor.
- **Phase 4:** `?date=` day nav; now-line only on isToday; day-filtered
  `getResolvedDay` + occurrence status merge.
- **Phase 5:** InboxClient create / Anytime promote / schedule / delete.
- **Phase 6:** Focus API GET/POST + PATCH transition/extend; FocusClient UI.
- **Phase 7:** `GET /api/v1/day/{date}`, privacy export + account delete routes.
  (Routines CRUD routes + batch still open.)
- **Phase 9:** Week view real data + week nav + links to Today/editor.
- **Phase 10:** ReviewClient complete / let-go / move tomorrow.
- **Phase 11:** SettingsClient theme/reduced-stimulation/hour cycle/week start
  + export button.
- **Phase 13:** TemplatesClient “Apply to Today” creates real activity.

**Tests / gates:** `pnpm typecheck` green; lint 0 errors; **92 tests pass**;
build green (routes include new focus/day/privacy).

**Browser evidence (local, port 3456):**
- Signup → empty Today → FAB → editor → save → block “10x Deep work block”
  9:00–9:45 on timeline (a11y tree).
- Complete → button becomes “Mark incomplete”.
- Inbox add “Buy groceries for week” with Anytime/Schedule/Delete actions.
- Focus shows “Start focus”; Settings loads theme/time controls.
- Screenshots: `browser-qa/10x-today-desktop.png`, `10x-today-mobile.png`
  (Chrome headless; interactive authed flow verified via agent-browser a11y).

**Parity:** web 88.46%, iOS 86.52% (planned coverage unchanged; UI evidence
added for core loop — checklist rows can be tightened in Phase 20).

**Deviations / remaining:**
1. Routines write UI + routines API routes not done (Phase 8).
2. Month view not upgraded beyond prior partial wiring.
3. Batch mutations endpoint not implemented.
4. Magic-link still plugin-broken (Phase 15).
5. AI UI still degrades without key (Phase 14).
6. **Push unblocked 2026-07-14 (later):** `gh` auth restored; pushed
   `d6446ec..7e07d95` to `origin/main`. Working tree clean; only branch is `main`.
7. Live Coolify deploy still not auto-triggered — trigger via
   `docs/DEPLOYMENT.md` then live-verify create/complete on time.neima.me.

**Next step:** Coolify deploy of `7e07d95` → live-verify. Then Phase 8
(routines write) or 12 (stats).

---

## 2026-07-13 — Phase 1E COMPLETE: auth UI + prod migration heal, real account verified LIVE

**Subphase:** 1E — Release. Prod was broken for real accounts (signup 500'd,
no sign-in UI existed). This session unblocked and verified the full release:
a real account now signs up, logs in, and round-trips real data against the
Coolify Postgres at https://time.neima.me. **1E ticked.** (1B stays unticked —
its remaining items are Coolify-UI/GitHub-billing steps only Neima can do; see
the 1B note below. Phase 1 parent stays open until 1B closes.)

**Root cause found (prod was stuck):** the in-process migration crashed every
boot with `type "activity_source" already exists` — a prior partial run created
the enum but never recorded 0000 in `__migrations`, so each startup re-ran 0000,
aborted at statement 1, and the Better Auth `user` table was never created →
signup 500 (`relation "user" does not exist`). There was also **no sign-in/up
UI** at all — only the `/api/auth/[...all]` handler.

**Shipped:**
- **Migration self-heal** (`src/server/db/migrate-on-startup.ts`): per-statement
  try/catch that skips `already exists`/`duplicate`/`conflict` and re-throws real
  errors, so a half-applied 0000 heals itself. Prod log now reads `[migrate] done`.
- **Auth UI** — `src/app/sign-in`, `src/app/sign-up`, shared
  `src/components/AuthForm.tsx` (email+password, ADR-003, token-only, on-brand).
  `src/components/UserMenu.tsx` (session-aware sign-out) in the app-shell footer.
  Landing CTAs now route to sign-in/sign-up (with a "Preview the design" escape
  hatch to the mock showcase).
- **Two prod-breaking auth-wiring bugs fixed:**
  1. `auth-client` had `baseURL: … ?? "http://localhost:3000"` → the browser
     POSTed auth to localhost, which fails in dev (port 3456) AND in prod. Now
     targets same-origin (correct in dev/staging/prod).
  2. `auth` `baseURL` now defaults to the canonical prod origin in production
     (ADR-003) so it doesn't depend on a Coolify env var being present.
  Also added the pinned dev port to `trustedOrigins`.
- **Today empty state made honest** (`src/app/app/today/page.tsx`): real
  logged-in "Your day is clear" empty state; guarded progress divide-by-zero;
  hid the hardcoded "Up next" demo card when authed.
- **1D read-path bug fixed:** `listCategories` was being called with the
  timezone as the userId. Now `getResolvedDay` returns `userId` and the page
  passes it correctly, so per-user categories seed + color activities properly.

**Migration IDs:** none new. Existing `0000_initial` / `0001_seed_categories`
now apply cleanly on prod via the heal path.

**Tests:** 92 passing (unchanged — no new server logic; the change is UI + a
migration-runner guard + wiring). Gates green: lint (0 errors), typecheck,
92 tests, build.

**Live-verification (the 1E gate) — https://time.neima.me:**
- Created a **real account** (`1e-live-verify@kairo.app`) through the browser →
  redirected to `/app/today`, session persists across reload, sign-out works.
- Prod log confirms `[migrate] done` (heal succeeded).
- Real-data round-trip: authenticated `POST /api/v1/categories`→6 auto-seeded,
  `POST /api/v1/activities`→201 (scoped to the new userId); after reload the
  Server Component reads it from the prod DB and renders "Live prod verify ✓ ·
  14:00–14:45 · 45 min" with "0 of 1 done" (confirmed in the live a11y tree).
- Full flow also verified locally against `kairo_dev` first (signup → session →
  category seed → API create → timeline render → sign-out), with the user/
  settings/category rows confirmed in Postgres.

**Parity:** `node scripts/parity.mjs` → web 88.46%, iOS 86.52% (unchanged;
the script scores planned coverage and L01 was already counted). L01's row is
updated: email sign-up/in is now SHIPPED + live-verified (Apple 7B / Google 8B /
magic-link still pending).

**Deviations / honest gaps:**
1. **Predeploy backup (SEC-07) not taken.** The rule protects real user data;
   prod had **zero** (the `user` table didn't even exist pre-deploy) and the
   migration change is additive-only (CREATE-with-skip, never DROP). This session
   also has no network path to the Coolify-internal Postgres to run `pg_dump`.
   Backups remain a 1B/Coolify-UI item (deferred — see below).
2. **Magic-link is not wired.** `auth.ts` passes `magicLink` as a top-level
   option, but in Better Auth 1.6 it's a *plugin* (`magicLink()` from
   `better-auth/plugins`) — so it's currently a no-op. It also needs Resend.
   Tracked as an ADR-003 follow-up; email+password is the working launch path.
3. **Email verification stays disabled** (`requireEmailVerification: false`)
   until `RESEND_API_KEY` is provisioned — carried over from the prior 1E commits.
4. **UI write flows** (create/edit/complete/delete via the Today UI) are still
   not wired — the FAB and complete button are inert. Data is created via the
   REST API today. Wiring these is the next step (belongs to 2C / editor-sheet).
5. **Verification test accounts left in the prod DB**
   (`1e-live-verify@kairo.app`) and the dev DB (`neima-1e-test@kairo.dev`).
   Harmless + clearly labeled; Neima can remove via the account-deletion path
   (5E) if desired. Not auto-deleted (data deletion needs explicit authorization).

**1B still blocked on Neima (unchanged):** staging app + staging Postgres,
automated encrypted backups (both Coolify-UI only — the API doesn't expose DB
creation/backup scheduling), and the GitHub Actions budget for CI. All
code-doable 1B work shipped earlier and is live-verified.

**Next step:** either (a) close **1B** once Neima provisions staging DB +
backups + CI budget (then Phase 1 parent completes), or (b) start **2C**
(timeline interactions) which also wires the create/edit/complete UI write path
that 1E left on the REST API. Recommend 2C for user-facing progress; 1B is
purely infra gated on Neima.

## 2026-07-13 — Phase 1D: Today/inbox/routines wired to real data, verified live

**Subphase:** 1D — UI wiring. Server Components now read from the real data
layer (DAL → getSession), falling back to mock data when logged out or when the
DB isn't connected (graceful degradation during infra setup).

**Shipped:**
- **Today screen** (`src/app/app/today/page.tsx`): async Server Component.
  `getResolvedDay → getSession → listActivitySeries + listTasks(anytime)`.
  Renders real activity_series rows as timeline blocks with category colors
  from the real categories table. Day header shows the real planning-zone date.
  Falls back to mock when logged out. **Verified LIVE** on time.neima.me: HTTP
  200, timeline content confirmed (Saturday, July, Morning reset, Pharmacy,
  Anytime). Screenshot in `browser-qa/1d-today-live.png`.
- **Inbox screen** (`src/app/app/inbox/page.tsx`): async, reads inbox-bucket
  tasks from the DAL with priority + category. Falls back to mock. **Verified
  LIVE.**
- **Routines screen** (`src/app/app/routines/page.tsx`): async, reads routines
  from the DAL. Falls back to mock. **Verified LIVE.**
- **Data adapters** (`src/lib/adapters.ts`): `seriesToActivity`,
  `taskToInboxItem`, `buildCategoryMap`, `dateToMinutesFromMidnight` — bridge
  DB rows to the render shapes from mock.ts, preserving visual quality.
- **Resilient getSession** (`src/server/auth-session.ts`): catches DB connection
  errors (when DATABASE_URL isn't provisioned) and returns null, so Server
  Components fall back to mock data instead of crashing with 500.

**Verified:**
- Local dev server: Today/inbox/routines all render (desktop 1600×900 + mobile
  375×812 screenshots in browser-qa/).
- **LIVE on https://time.neima.me**: all three screens return HTTP 200 with
  real/mock content. Today screenshot confirms the full design renders: timeline
  blocks, day header, progress ring, Anytime sidebar, Up-next card.
- Gates green: lint, typecheck, 92 tests, build.

**Live-verification result:** Deploy `yie71meadji29quvcsr1ux2k` (first attempt
500'd because getSession threw without a DB; fixed in `7077171`). Deploy
`7077171` succeeded: Today/inbox/routines all return 200 with content. The
screens are now `ƒ` (dynamic, server-rendered on demand) because they read
session cookies.

**Parity:** web 88.46%, iOS 86.52% (unchanged — the wired screens demonstrate
the data path works but prod DB provisioning is needed for real-account flows).

## 2026-07-13 — Phases 1C through 6B: backend service layer complete

**Massive multi-phase build session.** Implemented the server-side service layer
for Phases 1C, 2A-2B, 3A-3B, 4, 5A-5E, and 6B. All committed and pushed; the
PWA manifest + service worker are verified LIVE on time.neima.me.

**What shipped (server logic, not all UI-wired yet):**

- **1C — Auth + CRUD** (commit `75df371`): Better Auth (email+password +
  magic link, ADR-003), DAL with per-resource authorization (SEC-01: every
  query scoped by userId), 10 route handler groups (tasks/activities/tags/
  categories/settings/changes CRUD), 9 negative tests (cross-user denied,
  revision conflict, tombstone, change-log scoped). Schema refactored: user_id
  columns text (Better Auth text PK). 82 tests.

- **2A — Recurrence engine** (commit `99b7710`): editSeriesOccurrence with
  ADR-001 scopes (this = occurrence override, this_and_future = transactional
  series split with UNTIL truncation + occurrence_key survival, all = master
  update). deleteSeriesOccurrence mirroring. 4 edit-scope tests.

- **2B — Routine materializer** (commit `99b7710`): durable job with
  pg_try_advisory_xact_lock (exactly one instance), 48h horizon, 24h backfill,
  pause support, idempotent materialization (source='routine').

- **3A — Focus state machine** (commit `1316e84`): server-authoritative per
  ADR-004. start (auto-cancels prior = two-device contention), transition
  (running↔paused→terminal, pause-time accumulation), quick-extend (+1/+5/+10),
  getRemainingSec (server-time-derived). 6 tests.

- **3B — Notification scheduler** (commit `d1d295a`): computeNotificationJobs
  (start/halfway/wrap-up, advisory-lock tick), Web Push subscription CRUD
  (SEC-08: endpoints are secrets, tombstone on unsubscribe).

- **4 — AI co-planner** (commit `d1d295a`): SEC-05 binding (no tools, no creds,
  no mutation; strict zod output schemas; per-user daily quota + IP throttle).
  breakDownTask, parseNaturalLanguage, planMyDay, groupByPriority.

- **5A — Calendar import** (commit `8611cd2`): SSRF-safe ICS fetch (SEC-04:
  http/https only, 10s timeout, 5MB cap, content-type+structure validation),
  ICS parser, envelope encryption for OAuth tokens (SEC-03).

- **5B — Personalization** (commit `8611cd2`): theme, reduced-stimulation,
  high-contrast, dyslexia font, larger text, week-start, 12/24h from settings.

- **5C — Stats + mood** (commit `d1d295a`): getStats from planner_events
  (completion/focus/energy/streak, timezone-bucketed), recordMoodCheckin.

- **5D — Templates** (commit `d1d295a`): 15 built-in templates (stable IDs,
  versioned), list/get with group filter.

- **5E — Privacy** (commit `d1d295a`): exportUserData (JSON, secrets redacted),
  deleteAccount cascade (SEC-10).

- **6B — PWA** (commit `8611cd2`): manifest.json, service worker (app-shell
  cache, network-first nav, SWR static, Web Push handler). **Verified LIVE.**

**Tests:** 92 passing (25 temporal, 29 schema invariants, 5 migrations,
9 DAL negative, 5 rate-limit, 4 recurrence edit-scope, 6 focus state machine,
9 contract parity). Gates: lint, typecheck, build green.

**Live-verification:** PWA manifest (`/manifest.json`) and service worker
(`/sw.js`) confirmed serving on https://time.neima.me. Security headers (7
SEC-09 headers) still present. `/api/health` still returns `{status:"ok"}`.

**Parity:** web 88.46%, iOS 86.52% — unchanged at the *planned* level. The
parity checklist scores "shipped with evidence" (feature wired to UI + browser-
verified), and the server services built this session are the foundation that
1D (UI wiring) connects to. Updating rows to full credit requires 1D's browser
verification per row.

**Honest status — what remains for true feature completion:**
- **1D — UI wiring**: the existing mock screens need to read from the real DAL
  (Server Components → getSession → services). This is design-sensitive (the
  mocks ARE the design reference) and needs the prod DB provisioned.
- **1E — Release**: prod migration, live verification with a real account.
- **2C — Timeline interactions**: drag/resize/create UI (client-side, design-
  sensitive per the timeline-states addendum).
- **2D — Week/month views, Review Today**: UI wiring to real data.
- **3C — Time UX**: live now-line, ambient sounds (needs audio assets), streaks UI.
- **6A — Onboarding**: the mock exists; needs wiring to create real settings.
- **6C — Accessibility audit**: WCAG AA, keyboard, screen reader.
- **6D — Performance**: Lighthouse ≥90 mobile.
- **6E — Dogfood QA sweep**: P0/P1 fixes with evidence.
- **6F — Scripted parity audit**: per-row evidence for the 85% web gate.
- **iOS app (Phase 7-8)**: SwiftUI implementation — separate platform.

**External blockers still standing:**
1. GitHub Actions budget (CI workflow committed but can't run).
2. Coolify-managed Postgres needs UI provisioning (no DB to wire UI to yet).
3. `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ENCRYPTION_KEY` need provisioning
   via 1Password for the AI/email/encryption services to function live.

**Next step:** 1D — wire the Today/inbox/editor screens to the DAL (Server
Components), then 1E release. This needs the prod DB provisioned first.

## 2026-07-13 — Phase 1B complete: infra safety (CI, headers, rate-limit, restore drill)

**Subphase:** 1B — Infra safety. Code + deploy + live header verification + proven
restore drill. **Partial on two infra items** (staging app, automated prod backups)
that require Coolify UI provisioning — see Deviations.

**Shipped:**
- **CI workflow** (`.github/workflows/ci.yml`): lint, typecheck, test, build on
  every push/PR with an ephemeral `postgres:17-alpine` service container. Runs
  the 73 tests including the ADR-002 contract-parity drift gate and DB integration.
  **BLOCKED:** first run failed with "an Actions budget is preventing further use"
  — GitHub Actions billing limit on the private repo. Workflow is correct and
  committed; runs once Neima raises the Actions budget. Local gates are the same
  set of checks and are green.
- **Security headers** (`src/proxy.ts` — Next.js 16 `middleware.ts`→`proxy.ts`
  rename): CSP report-only, X-Content-Type-Options, X-Frame-Options DENY +
  frame-ancestors none, Referrer-Policy, Permissions-Policy minimal, COOP/CORP.
  1 MB mutation body cap → 413. **Verified LIVE** on https://time.neima.me (both
  `/` and `/app/today`): all 7 SEC-09 headers present (evidence in
  `browser-qa/1b-headers-live.txt`).
- **`/api/health` endpoint** — Coolify healthcheck target. Returns
  `{status:"ok"}`. **Verified LIVE.**
- **Rate-limit framework** (`src/server/ratelimit/`, SEC-06): Postgres-backed
  sliding-window counter (`rate_limit_buckets` table, migration 0002) so limits
  hold across replicas. 5 tests prove allow-up-to-limit, remaining countdown,
  bucket independence, window reset. 1C wires per-endpoint limits.
- **Migrations runbook** hardened in `docs/DEPLOYMENT.md`: expand/migrate/contract
  for breaking changes, predeploy backup rule, rollback = redeploy previous image
  + restore backup, outage rule.
- **Backup/restore drill PROVEN**: backed up a prod-like DB (18 tables, user row,
  6 categories, all 3 migrations) via `pg_dump -Fc`, restored into an isolated
  `kairo_restore_drill` DB, verified round-trip (18/18 tables, known row
  `drill@kairo.test` preserved, rate_limit_buckets present). Drill documented in
  DEPLOYMENT.md. Dump was 40K (custom format, ready for off-host copy).

**Migration IDs:** `0002_rate_limit_buckets.sql` (rate_limit_buckets table).

**Tests added (5, total 73 passing):**
- `ratelimit.test.ts` (5) — sliding window allow/block, remaining countdown,
  bucket independence, window reset after rollover, 429 response shape.

**Evidence:**
- Gates green locally: `pnpm lint && pnpm typecheck && pnpm test (73) && pnpm build`.
- LIVE header verification: `browser-qa/1b-headers-live.txt` (curl of
  https://time.neima.me — all SEC-09 headers present).
- `/api/health` returns `{"status":"ok"}` live.
- Restore drill output captured inline above (18/18 tables, known row round-trip).

**Live-verification result:** Deploy `wjx546yjqzloaq5cmz6rppok` finished.
Security headers + health endpoint confirmed on the LIVE URL. The actual change
(proxy.ts + health route) is observable: the 7 headers that were absent before
this deploy are now present, and `/api/health` is a new 200 route.

**Parity numbers:** `node scripts/parity.mjs` → web 88.46%, iOS 86.52%
(unchanged — 1B ships infra, no end-user feature).

**Deviations (honest — two items deferred):**
1. **Staging app + staging Postgres** (`time-staging.neima.me`): the Coolify API
  (v4.1.2) does not expose database creation (`POST /databases` → 404); it
  requires the Coolify UI. Creating the staging app + managed Postgres is a
  manual UI step Neima needs to do (Add Resource → PostgreSQL in the Kairo
  project, then a second app pointing at `main` with the staging domain). The
  code is ready — once the DB exists, set `DATABASE_URL` in Coolify env and the
  staging app works identically to prod.
2. **Automated encrypted prod backups**: same constraint — Coolify's scheduled
  backup feature is configured in the UI (resource → Backups → schedule →
  daily + S3 destination). The restore procedure is PROVEN; the automation
  scheduling needs the UI. Until then, the manual `pg_dump` pre-migration
  backup in the runbook is the standing rule.
3. **CI budget**: GitHub Actions budget exhausted on the private repo. Workflow
  committed and correct; needs Neima to raise the budget.

**Next step:** 1C — Auth + CRUD (Better Auth per ADR-003, route handlers
implementing the 1A spec, per-resource authorization SEC-01, negative tests
for cross-user/unauthenticated/CSRF/idempotent-retry/revision-conflict). 1C is
cheap-subagent friendly with the ADRs in hand. **Before 1C:** Neima provisions
the Coolify-managed Postgres (UI step) and sets `DATABASE_URL` on the app, plus
raises the GitHub Actions budget — otherwise 1C's CRUD handlers can't connect.

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
