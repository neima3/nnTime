# Progress log

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
