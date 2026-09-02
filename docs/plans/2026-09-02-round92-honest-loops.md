# Round 92 — Honest loops (end-user polish across the core loops)

Status: SHIPPED — 2026-09-02, live on https://time.neima.me at `16547d0`
(Fable, with grok-4.6 + glm-5.3-flash workers). See progress.md for the
deploy record; open follow-ups: Focus `activityOccurrenceId` linking (contract
change), CSP Stages 2–3, B6-gated branches.

> **Goal:** make the product Neima opens every morning look and function better
> for an actual end user — no new surfaces, no new games, no new Today cards.
> Fix what a person hits in the capture → plan → do → review loop, on a phone
> and on a laptop, then ship it live.

## How this round was chosen (evidence, not vibes)

Hands-on pass on a fresh local account (`qa-r92@kairo.test`, seeded with a
realistic day) at 1440×900 and 390×844, plus two independent code audits run
in throwaway worktrees:

- **grok-4.6** (`grok -p`, read-only): 15 ranked end-user defects with
  file:line evidence. Every item used below was re-verified in the source.
- **glm-5.3-flash** (`opencode run -m zai-coding-plan/glm-5.3-flash`):
  state-coverage inventory (loading / empty / error / refetch / control names)
  for all 15 signed-in routes.

Baseline gates: lint, typecheck, **140 files / 1339 tests** green; parity web
89.74% / iOS 86.93%.

### What the hands-on pass found

| # | Surface | Defect | Severity |
|---|---|---|---|
| H1 | Desktop sidebar | At ≤900px viewport height (every laptop) the sticky `h-dvh` sidebar overflows: the AI co-planner card is clipped and the identity/shortcuts footer is pushed off-screen. | P1 visual, flagship |
| H2 | Inbox (mobile) | Task titles truncate to 2–3 characters ("Cal…", "Or…") because the inline action group eats the row. | P1, core loop |
| H3 | Today header (mobile) | Streak / Low battery / Pick for me / Review / day switcher wrap into three rows before the timeline starts. | P1 glanceability |
| H4 | Quick-capture FAB | The floating pencil overlaps the editor sheet's controls and the Focus ritual chips on mobile. | P2 |
| H5 | Sidebar identity | Name/email flash an `animate-pulse` skeleton on every document load although the server already knows the session. | P2 |
| H6 | Console | React warns "Encountered a script tag while rendering React component" on every client navigation into `/app` (the per-user prefs bootstrap script is in the React tree). Same script blocks CSP Stage 1. | P2 / ADR-005 |

### What the audits found (verified)

| # | File | Defect | Severity |
|---|---|---|---|
| G1 | `PlanDayClient.tsx` accept() | drops `taskId` → confirming an AI proposal creates a duplicate instead of consuming the task | **P0** |
| G2 | `AnytimeRail.tsx` schedule()/slotIt() | schedule drops `taskId`; slot-it POSTs an activity and ignores the DELETE result | P1 |
| G3 | `review/page.tsx` + `ReviewClient.tsx` | Review lists still-upcoming blocks as "didn't happen"; let-go / move-tomorrow mutate future work | P1 |
| G4 | `TimelineCanvas.tsx` / `TodayTimeline.tsx` | done-toggle has no intended state and no in-flight lock (double tap can't undo); generic failures roll back silently | P1 |
| G5 | `QuickCapture.tsx` save() | plain save never refreshes; Inbox keeps `useState(initialItems)` so a capture on the open Inbox looks lost | P1 |
| G6 | `QuickCapture.tsx` magicParse() | failure toast says "captured as plain text" but nothing is saved | P1 (silent loss) |
| G7 | `FocusClient.tsx` | a session started from a Today block never links the occurrence; finishing never offers to mark the block done | P1 |
| G8 | `RoutinesClient.tsx` create() | no try/finally (Save can stick); list is `useState(initial)` so the new routine doesn't appear | P1 |
| G9 | `RoutinesClient.tsx` scheduleToday() | "Use today" opens a title-only stub with none of the steps | P1 |
| G10 | `ActivityEditor.tsx` | edit-mode fetch failure leaves a blank form silently; commitDelete has no try/catch | P1 |
| G11 | `TimezoneNudge.tsx` | apply() fails silently | P1 |
| G12 | `TimelineCanvas.tsx` | complete / focus controls are 24–32px hit targets on touch | P2 |
| F1–F10 | Settings / Routines / WeeklyIntentions / Focus / DayRituals / Stats / `/app` error boundary / control names | mutations without try/catch, swallowed errors, unnamed selects, no zero-data state, no `/app` boundary | P2 |

## Tracks

| Track | Owner | Items | Branch |
|---|---|---|---|
| **A — layout + flagship interactions** (design-sensitive) | Fable, main checkout | H1, H2, H3, H4, G3, G4, G7, G12 | `main` |
| **B — core-loop correctness** | grok-4.6 worker | G1, G2, G5, G6, G8, G9, G10 | `fix/core-loops` |
| **C — hardening** | glm-5.3-flash worker | G11, F1–F10 | `fix/error-handling` |
| **D — shell bootstrap + identity** | grok-4.6 worker | H5, H6 (CSP Stage 1 per `docs/plans/2026-08-24-csp-unsafe-inline-plan.md`) | `feat/shell-bootstrap` |

Workers run headless in git worktrees under the session scratchpad with
`node_modules` symlinked; each commits on its branch and writes `SUMMARY.md`.
Fable reviews every diff, merges into `main`, runs the full gates, and ships.

## Non-goals (unchanged from the trust/glanceability program)

- No 19th game, no new Today helper, no new route.
- `feat/quiet-today` and `feat/client-error-sink` stay parked: both carry a
  prod migration and are gated on **B6** (Neima's `pg_dump`) — see
  `docs/plans/2026-08-13-trust-glanceability.md` Track B. Not merged here.
- No Track B items (Google/Apple/Resend env, staging DNS, physical iPhone).
- No CSP header change yet (Stage 1 is the pure refactor; Stage 2/3 later).

## Acceptance

- [x] Sidebar fits a 1440×760 viewport with the NOW card mounted; nothing clipped. (`after/today-laptop-*.png`)
- [x] Inbox rows at 390px show the full title (two lines max) with actions on their own row. (`after/inbox-mobile-*.png`)
- [x] Today at 390px: title row + one horizontally scrollable chip row; timeline starts within ~260px. (`after/today-mobile-*.png`)
- [x] Quick-capture pencil hidden on `/app/editor` and `/app/focus`. (`after/editor-mobile-*.png`, `after/focus-mobile-*.png`)
- [x] AI plan accept and Anytime schedule/slot consume the task (no duplicates). (source pins; `/schedule` endpoint)
- [x] Quick capture on the open Inbox shows the new row; magic-add failure saves plain text. (hands-on: badge 3→4, no reload)
- [x] Review lists only blocks whose end has passed; upcoming ones are counted, not judged. (`src/lib/review-window.test.ts`)
- [x] Done-toggle is idempotent under double tap and every failure is toasted.
- [x] Focus from a block offers one-tap "Mark done" on completion (hands-on: lands on Today with the block ✓). Linking `activityOccurrenceId` on start is deferred — it is an OpenAPI/iOS contract change (the day payload has no occurrence row id).
- [x] Routine create shows the routine; "Use today" carries emoji + steps.
- [x] Editor load failure and delete failure are visible and recoverable.
- [x] Sidebar identity renders from the server session (no skeleton on load). (SSR HTML carries name/email; `UserMenu.test.ts`)
- [x] No "script tag" React warning on client navigation; bootstrap script text is constant + hash-pinned. (console clean after `Today → Inbox`; `prefs-bootstrap.test.ts`)
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; `pnpm test:e2e` green (50 passed / 4 skipped); parity 89.74 / 86.93.
- [x] Deployed to https://time.neima.me on the exact SHA and live-verified with a marker unique to this build (build `bhmft2emhgmiqg0bc67qnunl` on `b855611`; live CSS carries `no-scrollbar` / `max-height:820px` / `line-clamp`).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e            # reuses the :3456 dev server
node scripts/parity.mjs  # must not drop below 89.74 / 86.93
node browser-qa/r92/shoot.mjs   # desktop+mobile × light+dark evidence → browser-qa/r92/
```

Evidence lives in `browser-qa/r92/` (git-ignored).
