# Round 92 executor prompt — Honest loops

> Paste to any coding agent (Claude Code, grok, OpenCode, Codex) to continue
> or re-run this round. Read `AGENTS.md` first, then
> `docs/plans/2026-09-02-round92-honest-loops.md`.

You are continuing **Round 92** of Kairo (`/Users/nn/Apps/nnTime`). The plan
doc lists four tracks with owners. Work the track you were given; if none
was named, pick the first unchecked acceptance item whose track has no open
branch.

Rules that do not bend:
- Design tokens only (`src/app/globals.css`); no raw hex, no Inter, no default
  Tailwind palette. Design-sensitive changes (layout, new visual patterns)
  belong to Fable/Opus; cheaper models implement behavior and tests.
- Every behavior change ships with a vitest test next to the source
  (source-pin tests that `readFileSync` the component and assert on strings
  are house style — see `src/components/app-shell-accessibility.test.ts`).
- Gates before commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Do not merge `feat/quiet-today` or `feat/client-error-sink` (prod migrations
  gated on Neima's pg_dump — Track B6).
- Deploy = push to `main` (Coolify auto-deploys) → poll the deployment →
  verify on https://time.neima.me with a marker unique to the new build.
- Evidence over narration: real-browser screenshots (desktop + 390px mobile)
  into `browser-qa/r92/` (git-ignored). Report what was and was not verified.

Cheap-worker recipe used this round (headless, in a git worktree):

```bash
S=<scratch>; git worktree add -b <branch> $S/wt-x HEAD
ln -s /Users/nn/Apps/nnTime/node_modules $S/wt-x/node_modules; cp .env.local $S/wt-x/
cd $S/wt-x && grok -p "$(cat prompt.txt)" --max-turns 200 --always-approve --disable-web-search
cd $S/wt-x && opencode run --pure --auto --dir $S/wt-x -m zai-coding-plan/glm-5.3-flash "$(cat prompt.txt)"
```

Each worker commits on its branch and writes `SUMMARY.md`; the reviewer
merges into `main` after reading the diff and running the gates.

When done: tick acceptance boxes in the plan doc, append a dated section to
`docs/plans/progress.md` (what shipped, tests, evidence paths, live result,
parity numbers, deviations, exact next step), commit, push, deploy, verify.
