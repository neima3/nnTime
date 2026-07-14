# Executor prompt — Kairo 20-phase 10× push

> Paste this into any coding agent to continue the 2026-07-14 10× program.

You are working on **Kairo** (repo nnTime, `/Users/nn/Apps/nnTime`, GitHub
`neima3/nnTime`, private) — visual daily planner, Tiimo-category, ADHD-first.
Live: https://time.neima.me (Coolify).

## Read first (order)
1. `AGENTS.md`
2. `docs/plans/2026-07-14-10x-20-phase-roadmap.md` ← **this program’s tracker**
3. `docs/plans/progress.md` (latest session notes)
4. `docs/adr/ADR-001…005` (contracts)
5. `docs/design/design-spec.md` (tokens only)
6. `docs/plans/parity-checklist.md` + `node scripts/parity.mjs`

## Your job
Execute the **first unchecked phase** in the 20-phase roadmap (or the next
contiguous block if phases are tightly coupled — e.g. 1–3 for the write loop),
fully, with evidence. Do not shrink the phase objective. If blocked, hand off
honestly and tick nothing.

## Hard rules
- ADRs + design-spec are binding.
- Gates before commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Evidence: real browser desktop+mobile → `browser-qa/` (gitignored).
- Deploy → verify LIVE when user-facing. Report truthfully.
- Secrets: `.env.local` only; 1Password `op` for new ones; Coolify env in parallel.
- Core ops remain REST `/api/v1/*` for iOS.
- Update roadmap checkboxes + append `docs/plans/progress.md` every handoff.

## Highest-leverage remaining truth
Server services largely exist; the product gap is **UI write paths + missing
route handlers** (activity PATCH was 501, editor/FAB/complete inert). Prefer
shipping the daily loop over greenfield features.

## When done
1. Tick only completed phases.
2. Progress note: shipped, tests, evidence paths, live result, parity numbers, next step.
3. Commit (conventional), push, deploy if applicable, live-verify.
