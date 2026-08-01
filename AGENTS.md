<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kairo (nnTime) — Agent Guide

Visual daily planner (Tiimo category, ADHD/neurodivergent-first). Web app
(Next.js 16) + future native SwiftUI iOS app. Target: ≥85% Tiimo feature parity.

## Start here (reading order)
1. `docs/plans/2026-07-12-kairo-roadmap.md` — subphased plan + progress tracker
2. `docs/adr/ADR-001…005` — BINDING contracts (temporal/recurrence, API+sync,
   auth, jobs/notifications, security). Deviating = stop and hand off.
3. `docs/design/design-spec.md` — BINDING design contract (tokens only)
4. `docs/plans/parity-checklist.md` — scored feature matrix (+ `scripts/parity.mjs`)
5. `docs/plans/progress.md` — session-by-session handoff notes
6. `docs/DEPLOYMENT.md` — how time.neima.me deploys (Coolify)

If you were given no other instructions: execute `docs/plans/kairo-agent-prompt.md`.

## Commands / gates
- `pnpm dev` — dev server (`.claude/launch.json` runs it on port 3456; auth
  trusts that origin via `BETTER_AUTH_URL=http://localhost:3456` in `.env.local`)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — REQUIRED green
  before every commit; `pnpm test:e2e` reuses the running :3456 dev server
- iOS gates: `./scripts/ios-main-thread-gate.sh` (xcodegen + app-hosted tests +
  Main Thread Checker; trust "Executed N tests") and `pnpm ios:release:preflight`
- `node scripts/parity.mjs` — recompute parity percentages after feature work

## Structure
- `src/app/` — App Router. `/` landing; `/app/*` = the real product (today,
  inbox, week, month, focus, routines, play, stats, settings, templates,
  review, planner) on live `/api/v1/*` data. **Keep the visual quality — the
  design bar is the product.**
- `src/components/` — shared UI (AppShell, feature clients); `games/` holds the
  14-game brain-breaks arcade whose pure logic lives in `src/lib/games.ts` and
  is mirrored verbatim by iOS `ArcadeLogic` (both sides unit-pinned).
- `ios/` — native SwiftUI app (XcodeGen; `ios/App/Features/*`). Debug tour
  fixtures: `-kairoOfflineFixture`, `-kairoTodayFixture`,
  `-kairoFocusDoneFixture`, `-kairoThemeFixture light|dark`.
- `src/app/globals.css` — the entire design token system. Never add raw hex in components.
- `docs/` — plans, design spec, research, deployment.

## Rules
- Design tokens only; new screens marked DESIGN-SENSITIVE need Fable/Opus design
  sign-off. No Inter, no pure #fff/#000, no default Tailwind palette colors.
- Core data ops must exist as REST `/api/v1/*` (zod) — the iOS app consumes them.
- Evidence over narration: real-browser verification (desktop + mobile viewport),
  screenshots/video to `browser-qa/` (git-ignored). Deploys verified on the LIVE URL.
- Secrets: `.env.local` only (never committed); fetch new ones via 1Password `op`.
  Coolify env must be updated in parallel.
- Once Phase 1 ships, the prod DB is Neima's real planner — no destructive tests
  against prod.
- Update roadmap checkboxes + `docs/plans/progress.md` at every hand-off.

## Deploy
Coolify (public VPS `cool.neima.me`) → https://time.neima.me. Push to `main` does
NOT auto-deploy unless the Coolify app has auto-deploy enabled — check
`docs/DEPLOYMENT.md`, deploy, then verify live.
