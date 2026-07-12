<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kairo (nnTime) — Agent Guide

Visual daily planner (Tiimo category, ADHD/neurodivergent-first). Web app
(Next.js 16) + future native SwiftUI iOS app. Target: ≥85% Tiimo feature parity.

## Start here (reading order)
1. `docs/plans/2026-07-12-kairo-roadmap.md` — phased plan + progress tracker
2. `docs/design/design-spec.md` — BINDING design contract (tokens only, no improvising)
3. `docs/research/tiimo-features.md` — feature parity source of truth
4. `docs/plans/progress.md` — session-by-session handoff notes
5. `docs/DEPLOYMENT.md` — how time.neima.me deploys (Coolify)

If you were given no other instructions: execute `docs/plans/kairo-agent-prompt.md`.

## Commands / gates
- `pnpm dev` — dev server (port 3000; `.claude/launch.json` has a `nntime-dev` config)
- `pnpm lint && pnpm build` — REQUIRED green before every commit
- `pnpm test` — once vitest lands (Phase 1+)

## Structure
- `src/app/` — App Router. `/` landing; `/app/*` = product (today, week, focus,
  routines, settings). Currently high-fidelity mocks on `src/lib/mock.ts` data;
  phases 1+ wire them to real data. **Keep the visual quality — the mocks are the
  design reference.**
- `src/components/` — shared UI (AppShell).
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
