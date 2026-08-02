# Round 62 Internal Reference Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:test-driven-development` and execute each checked step in order.

**Goal:** Keep Kairo's timeline-state design reference available to local
developers while returning the branded 404 in production.

**Architecture:** Put the environment decision in one pure helper so its
production and development behavior is unit-pinned. Call `notFound()` at the
top of the server page, before any rendering can stream, and remove the route
from the signed-out preview inventory. Add a CI-only browser assertion because
CI runs the deployable production standalone server while local Playwright
runs the development server.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Playwright.

---

### Task 1: Pin the route visibility contract

**Files:**
- Create: `src/lib/internal-reference-routes.test.ts`
- Create: `src/lib/internal-reference-routes.ts`

- [x] Write a Vitest contract asserting `production` is hidden while
  `development` and `test` remain visible.
- [x] Run `pnpm test src/lib/internal-reference-routes.test.ts` and confirm it
  fails because the helper does not exist.
- [x] Implement `shouldExposeInternalReferenceRoute(nodeEnv)` as the minimal
  pure predicate `nodeEnv !== "production"`.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Enforce a real production 404

**Files:**
- Modify: `src/app/app/timeline-states/page.tsx`
- Modify: `e2e/preview-auth-boundary.spec.ts`

- [x] Remove `/app/timeline-states` from the public preview inventory.
- [x] Add a CI-only Playwright contract that requests the route and expects
  HTTP 404, the branded `Lost track of time?` heading, and no internal binding
  copy.
- [x] At the top of the page component, call `notFound()` when the helper says
  the reference must be hidden; keep all existing local reference rendering.
- [x] Build and run the production standalone server, then verify the focused
  Playwright contract passes against it.

### Task 3: Release proof

**Files:**
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`

- [x] Record the dogfood finding, boundary, tests, and remaining external
  gates in roadmap and progress.
- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [x] Complete independent review and desktop/mobile production-mode QA.
- [ ] Commit and push; require exact-SHA GitHub CI success.
- [ ] Deploy the exact feature SHA through Coolify and verify live health,
  `/app/timeline-states` HTTP 404, branded 404 copy, no internal binding copy,
  and an unaffected public product route.

## Standing boundaries

- Production verification is signed-out and read-only.
- The design addendum content and local-development route remain unchanged.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
