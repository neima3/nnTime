# Executor prompt — Trust + Glanceability program

Paste this to an agent starting a session on this program.

---

You are continuing Kairo (nnTime) at `/Users/nn/Apps/nnTime`.

## Read first, in this order
1. `AGENTS.md` (gates, structure, standing rules)
2. `docs/plans/2026-08-13-trust-glanceability.md` — **the program**. Thesis, Track A/B, Slice 1,
   parity contract, migration contract, verification standard.
3. `docs/adr/ADR-001…005` — BINDING. ADR-001 (temporal/recurrence) and ADR-002 (API + offline sync)
   govern most of this program.
4. `docs/design/design-spec.md` — BINDING for anything visual. Tokens only.
5. `docs/plans/progress.md` — the last two or three rounds tell you what kind of bug this codebase
   actually produces.

## What to do
Execute **Slice 1 only**, in the order the plan gives, unless this prompt names a later Track A item:

> **Track A item to execute this session:** _(fill in — default: Slice 1)_

Do not start a Track B item. Track B needs Neima, a physical iPhone, DNS, the Coolify UI, or SSH.
When you reach one: print the checklist row, say exactly what is blocked, and stop.

## Hard rules
- **Do not simulate evidence.** A simulator is not an iPhone. A green `xcodebuild` banner is not a
  passing test — trust `Executed N tests`. Never tick 7B/8B without device evidence.
- **Gates before every commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, plus
  `pnpm test:e2e` for anything user-facing. iOS changes also need
  `./scripts/ios-main-thread-gate.sh` and `pnpm ios:release:preflight`.
- **Never run `pnpm build` while a dev server is running** — it corrupts the Turbopack cache and takes
  the app down. Stop the server first (`.claude/launch.json` runs it on :3456).
- **Parity floor:** `node scripts/parity.mjs` must stay ≥ **89.74% web / 86.93% iOS**. Moving a surface
  is not dropping it; deleting a credited surface is a stop.
- **Design tokens only** (`src/app/globals.css`). No raw hex, no default Tailwind palette, no new fonts.
  Anything visual is design-sensitive: strong model only, never a cheap subagent.
- **Core data ops stay REST** under `/api/v1/*` with zod, because the iOS app consumes them. Schema or
  contract changes go through `api/openapi.yaml` + `pnpm api:sync-ios`.
- **Production is Neima's real planner.** No destructive migrations, no prod seed/reset, no
  "just this once". Migrations are expand-only, one per deploy, with a predeploy dump (Track B6).
- Evidence goes to `browser-qa/` (git-ignored). Keep it out of commits.

## When you finish
1. Append a dated section to `docs/plans/progress.md` using the template at the bottom of the plan.
   Do not rewrite earlier entries.
2. Update the `Status:` line at the top of `docs/plans/2026-08-13-trust-glanceability.md`.
3. Commit, push, deploy per `docs/DEPLOYMENT.md`, then **verify on the live URL** — a 200 homepage does
   not prove the new code shipped. Pick a marker only the new build emits (a content-hashed chunk that
   is byte-identical to your local build is the strongest).
4. Report truthfully what you verified and what you did not.
