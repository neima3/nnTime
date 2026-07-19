# Executor prompt — 10× ADHD program

You are executing the 10-phase ADHD program for Kairo (nnTime).

## Read first
1. `AGENTS.md` (repo root) — commands, rules, deploy
2. `docs/plans/2026-07-18-10x-adhd-roadmap.md` — THE plan; tick boxes as you go
3. `docs/research/adhd-features-2026.md` — why these features
4. `docs/design/design-spec.md` — binding token contract

## Rules
- Work phase by phase in order unless a phase is blocked; each phase must be
  browser-verified (desktop + 375 px viewport, screenshots to `browser-qa/`)
  before its box is ticked.
- Design-sensitive phases (1, 2, 4, 8, 9): Fable/Opus only. Mechanical slices
  (phase 6 server + tests, phase 10 QA sweep): cheap subagents OK, but the
  orchestrator verifies output before ticking.
- Gates before every commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Dev server: `pnpm dev --port 3456` (port 3000 belongs to another app — never
  kill it). QA accounts: create `qa-*@kairo.test` users freely in local dev.
- Design: tokens from `src/app/globals.css` only; nothing ever turns red;
  celebration/overtime use peach/butter/mint/iris; honor
  `prefers-reduced-motion` AND the app's reduced-stimulation class on every
  animation.
- Copy voice: forgiving, concrete, short. Never "overdue/failed/missed".
- After all phases (or when stopping): update roadmap checkboxes +
  `docs/plans/progress.md`, commit, push, deploy via
  `docs/DEPLOYMENT.md` (Coolify API, env in `.env.local`), verify the live
  URL https://time.neima.me renders the new features, report honestly.
