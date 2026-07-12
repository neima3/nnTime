# Executor prompt — Kairo (nnTime)

> Paste this to any coding agent (Claude Code, Codex, OpenCode) to continue the build.

You are working on **Kairo** (repo nnTime, `/Users/nn/Apps/nnTime`, GitHub
`neima3/nnTime`, private) — a visual daily planner (Tiimo-category, ADHD/
neurodivergent-first) targeting ≥85% Tiimo feature parity on web + native iOS.

## Read these first, in order
1. `AGENTS.md` — project rules, gates, deploy.
2. `docs/plans/2026-07-12-kairo-roadmap.md` — the phased plan + progress tracker.
3. `docs/design/design-spec.md` — BINDING design contract.
4. `docs/research/tiimo-features.md` — parity source of truth.
5. `docs/plans/progress.md` — what previous sessions actually did.

## Your job
Execute the **first unchecked phase** in the roadmap tracker, fully, then stop.
Keep the FULL phase objective — do not shrink scope to a cosmetic slice. If the
phase is huge, complete it in roadmap-task order and hand off cleanly mid-phase
with an honest progress note.

## Hard rules
- **Design:** implement exactly per `docs/design/design-spec.md`. Design tokens only
  (no raw hex, no default Tailwind palette colors, no new fonts). The mock screens in
  `src/app/app/*` are the visual reference — match their quality. Anything marked
  DESIGN-SENSITIVE or "screens to be designed" needs a Fable/Opus-level design pass
  first; if you are a cheaper model, build everything else and flag it in the handoff.
- **Verification is evidence, not narration:** test in a real browser (muted),
  desktop AND mobile viewport; save screenshots/recordings to `browser-qa/`
  (git-ignored). Never claim something works without having exercised it.
- **Gates before commit:** `pnpm lint && pnpm build` (and `pnpm test` once tests
  exist). Zero errors.
- **Deploy:** push to `main` → deploy via Coolify per `docs/DEPLOYMENT.md` → verify
  the change on https://time.neima.me — a deploy is not done until live-verified.
  Report truthfully what was and wasn't verified.
- **Secrets:** read from `.env.local` (never committed). New secrets: fetch with
  1Password CLI `op` and add to both `.env.local` and Coolify app env.
- **Data safety:** the production DB is Neima's real planner once Phase 1 ships.
  Destructive tests only against local/synthetic data.
- **API shape:** all core data operations must exist as REST `/api/v1/*` route
  handlers (zod-validated) so the future iOS app can consume them — no
  web-only shortcuts for core CRUD.
- Cheap subagents are welcome for mechanical work (bulk edits, tests, QA sweeps) —
  but their output must be verified by you before ticking any box.

## When done
1. Tick the phase checkbox in the roadmap; append a dated entry to
   `docs/plans/progress.md`: what shipped, evidence paths, live-URL verification
   result, deviations, and the exact next step for the following agent.
2. Commit (conventional message), push, deploy, live-verify.
3. Report honestly: done / partially done (what remains) / blocked (why).
