# Executor prompt — Kairo (nnTime)

> Paste this to any coding agent (Claude Code, Codex, OpenCode) to continue the build.

You are working on **Kairo** (repo nnTime, `/Users/nn/Apps/nnTime`, GitHub
`neima3/nnTime`, private) — a visual daily planner (Tiimo-category, ADHD/
neurodivergent-first) targeting ≥85% scripted Tiimo feature parity on web AND
native iOS (computed separately, each must reach 85%).

## Read these first, in order
1. `AGENTS.md` — project rules, gates, deploy.
2. `docs/plans/2026-07-12-kairo-roadmap.md` — phases, subphases, tracker.
3. `docs/adr/ADR-001…005` — BINDING contracts (temporal/recurrence, API+sync,
   auth, jobs/notifications, security). Deviating from an ADR = stop + hand off.
4. `docs/design/design-spec.md` — BINDING design contract.
5. `docs/plans/parity-checklist.md` — the scored feature matrix you must not regress.
6. `docs/plans/progress.md` — what previous sessions actually did.

## Your job
Execute the **first unchecked SUBPHASE** in the roadmap tracker (e.g. `1B`),
fully, then stop. One subphase per session unless the next is trivial and you
have verified the current one end-to-end. Keep the subphase's full objective —
do not shrink scope. If you cannot finish, hand off honestly mid-subphase and
tick nothing.

## Hard rules
- **ADRs and design spec are contracts.** Design tokens only (raw hex exists
  only inside `globals.css` token definitions). Anything marked
  DESIGN-SENSITIVE needs Fable/Opus-level design output first — if you are a
  cheaper model and the design is missing from `docs/design/`, build the
  non-visual parts and flag it.
- **Verification is evidence:** real browser, desktop AND mobile viewport,
  screenshots/recordings to `browser-qa/` (git-ignored). Data features need
  the negative tests the ADRs demand (cross-user denial, conflict, idempotent
  retry), not just happy paths.
- **Gates before commit:** `pnpm lint && pnpm typecheck && pnpm test &&
  pnpm build`; CI green before deploy.
- **Staging first.** Destructive/experimental QA only on staging or synthetic
  tenants — production is Neima's real planner after Phase 1E. Production
  migrations take a predeploy backup (see `docs/DEPLOYMENT.md`).
- **Deploy → verify LIVE** on https://time.neima.me; a deploy is not done
  until the actual change is observed live. Report truthfully what was and
  wasn't verified.
- **Secrets:** `.env.local` (quoted values; never committed) + Coolify env;
  fetch new ones via 1Password `op`.
- **API shape:** core data ops exist in `api/openapi.yaml` and as `/api/v1/*`
  route handlers per ADR-002 — no web-only shortcuts.
- **Parity:** when you ship a feature, update its row in
  `docs/plans/parity-checklist.md` with evidence; run `node scripts/parity.mjs`
  and include the numbers in your progress note.
- Cheap subagents welcome for mechanical work; verify their output yourself
  before ticking any box.

## When done
1. Tick ONLY your subphase checkbox; parent phases complete only when all
   subphases + the phase gate pass.
2. Append to `docs/plans/progress.md`: date, subphase, what shipped, migration
   IDs, tests added, evidence paths, live-verification result, parity numbers,
   deviations, exact next step.
3. Commit (conventional message), push, deploy, live-verify.
4. Report honestly: done / partial (what remains) / blocked (why).
