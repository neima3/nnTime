# Round 49 Truthful Preview Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kairo's signed-out previews expose only real interactions and
give every authentication boundary an immediate, accessible path forward.

**Architecture:** Declare preview capability explicitly at shared component
boundaries. `TimelineCanvas` receives an interaction capability instead of
inferring it from callbacks, `SignedOutCard` receives its semantic heading
level from the route that owns it, and template cards render navigation when
signed out rather than a mutation-shaped button that cannot mutate. Authenticated
behavior and independently protected APIs remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright.

---

## Requirements

- Signed-out Today activities are readable groups but are not draggable,
  keyboard-editable, or advertised as editable.
- Signed-in Today preserves pointer, keyboard, resize, and editor behavior.
- Signed-out template cards provide direct `/sign-in` links without calling a
  protected API; signed-in cards preserve their apply mutation.
- Route-level Focus, Planner, and Editor auth boundaries expose their title as
  the page `h1`; embedded auth cards remain `h2` by default.
- No raw design values, API contract changes, or parity-credit changes.

## File map

- Modify `src/components/TimelineCanvas.tsx`: add an explicit `interactive`
  capability and conditionally expose semantics, handlers, and affordances.
- Modify `src/components/TodayTimeline.tsx`: derive timeline interactivity from
  the server-known `authed` prop.
- Modify `src/components/TemplatesClient.tsx`: render an auth link for signed-out
  cards and retain the mutation button for signed-in cards.
- Modify `src/components/EmptyState.tsx`: support an explicit route-level `h1`.
- Modify `src/app/app/{focus,planner,editor}/page.tsx`: opt route-level auth
  cards into `h1` semantics.
- Extend focused Vitest and Playwright contracts.
- Update `docs/plans/progress.md` with local and release evidence.

### Task 1: Pin production findings red

- [ ] Extend the timeline source contract to require an explicit capability and
  conditional interaction semantics.
- [ ] Extend the signed-out browser contract to assert Today activity groups
  have no keyboard shortcuts/tab stop, templates link directly to sign-in, and
  Focus/Planner/Editor each expose their auth title as `h1`.
- [ ] Run focused tests and record the intended failures.

### Task 2: Make timeline capability explicit

- [ ] Add `interactive?: boolean` with an authenticated-safe default of `true`.
- [ ] In read-only mode omit tab focus, edit/resize instructions, keyboard
  shortcuts, drag cursor/touch capture, and mutation handlers while preserving
  activity group labels and nested Focus navigation.
- [ ] Pass `interactive={authed}` from `TodayTimeline`.

### Task 3: Make authentication paths semantic and actionable

- [ ] Render template apply actions as `/sign-in` links when signed out and as
  mutation buttons when signed in.
- [ ] Add `headingLevel="h1" | "h2"` to `SignedOutCard`, defaulting to `h2`.
- [ ] Opt the route-level Focus, Planner, and Editor fallbacks into `h1`; leave
  embedded cards unchanged.

### Task 4: Verify the artifact

- [ ] Run focused red-to-green tests, then
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Run the complete Playwright suite against a production build.
- [ ] Inspect desktop and mobile screenshots, require no overflow or browser
  errors, and recompute parity without changing credit.
- [ ] Obtain an independent code review and resolve every actionable finding.

### Task 5: Release and prove production

- [ ] Record local proof in `docs/plans/progress.md` and commit the reviewed diff.
- [ ] Fast-forward `main`, rerun merged gates, push, and require the exact-SHA CI
  checks to pass.
- [ ] Deploy that exact SHA through Coolify and verify `/api/health` plus the
  three signed-out contracts on `https://time.neima.me`.
- [ ] Record exact release evidence, commit/push the handoff, and clean the
  Round 49 worktree.

## Self-review

- The slice is one accessibility/conversion contract for anonymous product
  previews, not three unrelated cosmetic changes.
- The implementation makes capabilities explicit without weakening API auth or
  changing authenticated planner behavior.
- The visual treatment reuses existing Kairo controls and tokens, so no new
  design direction or binding-spec deviation is introduced.
