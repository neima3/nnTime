# Round 46 Signed-out Preview Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Kairo's signed-out product fixtures useful as read-only previews
without mounting protected effects or exposing mutation flows that terminate in
401 responses.

**Architecture:** Seed one fail-closed `signedIn` value from the existing
server-side session lookup in `/app/layout.tsx`, expose it through a focused
client context, and make the shared shell consume it before mounting any live
planner effects. Route-specific clients that fetch or mutate on mount are
placed behind a reusable signed-in boundary; existing server-loaded preview
fixtures remain visible. API handlers remain independently authenticated per
ADR-003/005.

**Tech Stack:** Next.js 16 App Router, React 19 Server/Client Components,
Better Auth, Vitest, Playwright.

---

## Requirements

- Signed-out visits to every public `/app/*` preview route issue no
  `/api/v1/*` request.
- Authenticated routes retain the current shared live-data and mutation
  behavior.
- Direct signed-out visits to Editor, Focus, Settings, Stats, and AI Planner
  render an actionable existing `SignedOutCard`, not a live client that first
  learns auth state from a 401.
- Week intentions and shared shell overlays do not mount while signed out.
- Today keeps its existing fixture, and its add action may navigate to the safe
  signed-out Editor boundary.
- No middleware-only security claim: all `/api/v1/*` authorization remains
  unchanged and independently enforced.

## File map

- Create `src/components/AppSessionBoundary.tsx`: focused context,
  `useAppSession()`, and `SignedInOnly` gate.
- Create `src/components/AppSessionBoundary.test.ts`: real render contracts for
  signed-in children, signed-out fallbacks, and fail-closed missing-provider
  behavior.
- Modify `src/app/app/layout.tsx`: provide the server-known session value on
  both personalization-success and default-preference render paths.
- Modify `src/components/AppShell.tsx`: consume session context, remove the
  optimistic `enableLiveData=true` default, and avoid mounting protected shell
  effects/overlays for previews.
- Modify `src/app/app/{today,editor,focus,stats,settings,planner,week}/page.tsx`:
  remove the Today-only override and gate route-specific live clients with
  existing signed-out presentation.
- Modify `e2e/preview-auth-boundary.spec.ts`: cover the entire signed-out route
  matrix plus Week-to-Editor behavior.
- Modify `docs/plans/progress.md`: record root cause, red/green evidence, parity,
  exact release proof, and the next external boundary.

### Task 1: Pin the regression red

- [x] Extend `e2e/preview-auth-boundary.spec.ts` with a matrix containing Today,
  Inbox, Week, Month, Focus, Routines, Play, Stats, Settings, Templates, Review,
  Planner, More, and Timeline States. For each route, wait for hydration and
  assert the collected `/api/v1/*` request list remains empty for a bounded
  observation window.
- [x] Add a Week interaction case that clicks the first `+ Add`, expects an
  actionable sign-in card on Editor, and still observes no protected requests.
- [x] Run the browser contract against the current production build and confirm
  it fails with the reproduced settings/day/stats/categories request sequence.
- [x] Add `AppSessionBoundary.test.ts` describing a fail-closed default,
  signed-out fallback, and signed-in child behavior; run it and confirm the
  missing module/API fails for the intended reason.

### Task 2: Establish one fail-closed session boundary

- [x] Implement `AppSessionBoundary.tsx` with an internal context default of
  `{ signedIn: false }`, an `AppSessionProvider`, `useAppSession`, and a
  `SignedInOnly({ children, fallback })` component.
- [x] Wrap both return paths in `src/app/app/layout.tsx` with
  `<AppSessionProvider signedIn={Boolean(session?.userId)}>`. Preserve the
  existing preference and hour-cycle behavior byte-for-byte inside the wrapper.
- [x] Run `pnpm test src/components/AppSessionBoundary.test.ts` and confirm all
  boundary behaviors pass.

### Task 3: Make the shared shell safe by default

- [x] In `AppShell.tsx`, remove `enableLiveData`; read `signedIn` from
  `useAppSession()` and pass it to `NowProvider`.
- [x] Mount `OfflineShell`, `NowStrip`, `QuickCapture`, `OneThing`, and
  `CommandPalette` only when `signedIn` is true. Keep navigation, UserMenu,
  ToastHost, and non-network presentation available to previews.
- [x] Remove the Today page's obsolete `enableLiveData={authed}` override.
- [x] Run focused Vitest contracts and typecheck.

### Task 4: Gate route-owned protected clients

- [x] Wrap `ActivityEditor` with `SignedInOnly` and an existing `SignedOutCard`
  explaining that sign-in is required to save planner activities.
- [x] Wrap `FocusClient`, `StatsClient`, `SettingsClient`, and the Planner page's
  `PlanDayClient` with route-appropriate existing `SignedOutCard` copy and
  token-only styling.
- [x] Wrap `WeeklyIntentions` with `SignedInOnly fallback={null}` so Week keeps
  its fixture without probing settings.
- [x] Keep the signed-out Routines fixture read-only, expose an actionable auth
  card, and prevent its player from mounting without a server-known session.
- [x] Run unit tests, lint, and typecheck.

### Task 5: Prove the production artifact

- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [x] Boot `.next/standalone/server.js` on an isolated port with an ephemeral
  Better Auth secret.
- [x] Run the expanded Playwright preview suite against the standalone server.
- [x] Inspect 390×844 Week-to-Editor and 1440×900 signed-out Settings/Stats
  screenshots; require no overflow and zero console errors/warnings.
- [x] Run `node scripts/parity.mjs`; parity must remain 89.74% web / 86.93% iOS
  because this hardens an existing feature rather than inflating credit.

### Task 6: Release and verify

- [x] Update `docs/plans/progress.md` and the ignored Round 46 QA report with
  local proof.
- [x] Commit the reviewed diff, fast-forward `main`, and rerun the merged tests.
- [x] Push `main`; require GitHub build/test, 13+ Playwright tests, generated
  native contracts, 377 iOS tests, Main Thread Checker, and unsigned iOS build
  to pass.
- [x] Require Coolify to finish the exact pushed SHA.
- [x] Re-run the signed-out route matrix and Week-to-Editor flow on
  `https://time.neima.me`; capture live mobile/desktop evidence and verify
  `/api/health` remains fully `ok`.

## Self-review

- Scope is one coherent auth-boundary subsystem; no data model, API, or parity
  credit changes are included.
- No placeholders or ambiguous auth behavior remain: missing context is
  explicitly signed out, and the server session is the only enabling signal.
- The implementation preserves ADR-003's UX-layer role and ADR-005's
  independent handler authorization.
