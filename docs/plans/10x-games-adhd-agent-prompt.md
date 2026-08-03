# Agent prompt — 10× Games + ADHD push (execute cold)

You are continuing Kairo (nnTime) at `/Users/nn/Apps/nnTime` — an ADHD-first
visual daily planner: Next.js 16 web app + native SwiftUI iOS app, deployed
via Coolify to https://time.neima.me (push to main triggers the webhook).

Execute `docs/plans/2026-08-03-10x-games-adhd-roadmap.md` phase by phase,
ticking its Progress tracker and appending a `docs/plans/progress.md` entry
after each shipped phase. Read `AGENTS.md` first; it binds.

Rules that have bitten agents before (do not relearn them the hard way):

1. Run the FULL web gates before EVERY commit — even iOS-only ones:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Web contract
   tests (`tests/ios-*.test.ts`) read iOS Swift sources and fail on drift.
   When you change an iOS architecture decision on purpose, retarget the
   contract test in the same push.
2. iOS: run `xcodegen generate` (from `ios/`) after adding Swift files or
   tests silently won't run. Use `./scripts/ios-xcodebuild.sh` (wraps
   -skipPackagePluginValidation). Trust "Executed N tests", never the
   SUCCEEDED banner alone. Gate: `./scripts/ios-main-thread-gate.sh`.
3. Game logic parity: pure logic lives in `src/lib/games.ts` and is mirrored
   verbatim in `ios/App/Features/Play/PlayArcadeLogic.swift`; both sides get
   seeded-RNG unit tests pinning identical outputs. Bank transcription may go
   to a cheap subagent; the seeded-parity tests are the verification.
4. Ship = commit (end message with
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` or your model's
   trailer) + push + watch the exact-SHA GitHub Actions run to green + poll
   Coolify deployments until drained + `curl https://time.neima.me/api/health`
   all ok + live spot-check of the feature + progress.md entry.
5. Design/visual work is NEVER for cheap models: Fable does it inline; other
   sessions route it to an Opus subagent. Tokens only (`src/app/globals.css`),
   no raw hex in components, no Inter, no pure #fff/#000. Verify both themes,
   high-contrast, reduced-stimulation, dyslexia-font, and a 390px viewport.
6. Browser verification uses the dev server on :3456 (`.claude/launch.json`,
   `BETTER_AUTH_URL=http://localhost:3456` in `.env.local`). Seed determinism
   by stubbing `Math.random` in-page during game play-throughs; restore after.
   Evidence goes to git-ignored `browser-qa/`.
7. Prod DB is Neima's real planner: read-only checks in prod, destructive
   tests only against local/synthetic accounts (`qa-*@kairo.test`).
8. Phases 5–7 add server surface: keep every data op on REST `/api/v1/*`
   with zod schemas — iOS consumes the same endpoints. Update
   `docs/plans/parity-checklist.md` + run `node scripts/parity.mjs` when
   feature scope changes.

If a phase is blocked by something only Neima can do (credentials, legal
acceptances, physical device), document it in progress.md and move on —
7B/8B remain user-gated and are NOT part of this push.
