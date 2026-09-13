# P0 readiness ledger — 2026-09-13

Baseline SHA: `6d3000d2a7d5580f581a5edf7911346f70103ec5` (`main`).
Host: Linux cloud agent (no Xcode / `plutil` / `swift`).
Gates were **not** lowered. Failures and skips below are environment facts.

## Environment that made DB tests honest

`TEST_DATABASE_URL` default (`postgresql://nn@localhost:5432/kairo_test`)
failed here: `pg_hba` matches `scram-sha-256` before `trust`, so a passwordless
URL cannot connect. First baseline therefore **skipped** the ephemeral-Postgres
suites (`[setup] could not ensure test DB`).

Local Postgres 16 was installed for this session. Subsequent runs used
`TEST_DATABASE_URL=postgresql://nn:nn@127.0.0.1:5432/kairo_test` (password
matches the role; not a repo secret). That is how the 144 skips became
executions. Do not commit a `.env.local`.

## Baseline on unchanged `6d3000d` (passwordless URL — DB skipped)

| Gate | Exit | Result |
|---|---|---|
| `pnpm lint` | **0** | clean |
| `pnpm typecheck` | **0** | clean |
| `pnpm test` | **1** | 158 files / 1389 tests: **1239 passed, 6 failed, 144 skipped** |
| `pnpm build` | **0** | Next.js 16.2.12 standalone compile OK |

Failed tests (Apple toolchain missing — **not** product regressions):

| File | Tests | Why |
|---|---|---|
| `tests/ios-release-contract.test.ts` | 1 failed | `plutil` ENOENT |
| `tests/ios-release-script.test.ts` | 4 failed | `plutil` missing; dirty-tree preflight returned 69 vs expected 67 because `plutil` fails first |
| `tests/ios-generated-client-adoption.test.ts` | 1 failed | `swift package dump-package` (no Swift) |

144 skips: DB integration `itDb` hooks (honest skip when Postgres auth failed).
**Not** converted to passes.

## After P1.1 + P1.1b (password URL — DB executed)

Linux-equivalent of CI `build-test` (same excludes as `.github/workflows/ci.yml`):

```bash
pnpm exec vitest run \
  --exclude tests/ios-release-contract.test.ts \
  --exclude tests/ios-release-script.test.ts
```

| Gate | Exit | Result |
|---|---|---|
| `pnpm lint` | **0** | clean |
| `pnpm typecheck` | **0** | clean |
| CI-equivalent Vitest | **1** | **157 files: 156 passed / 1 failed. Tests: 1375 passed, 1 failed, 0 skipped** |
| `pnpm build` | **0** | compile OK; migrate notices on local `kairo_test` only |

The remaining Vitest failure is the same pre-existing environment miss:
`swift package dump-package` in `ios-generated-client-adoption.test.ts`.
Nine other tests in that file passed. CI `native-contract` (macos-latest)
owns Swift/`plutil`. This agent did **not** skip or rewrite that test.

New coverage this branch (all executed, 0 skips):

- 3 DB tests in `src/server/services/focus.test.ts` (cross-user / unknown /
  owned occurrence)
- 2 DB tests in `src/server/services/focus-event-atomicity.test.ts`
- 1 DB test in `src/server/dal/isolation.test.ts` (`getOccurrence`)
- 2 route tests (POST + terminal PATCH no longer swallow planner-event errors)

Arithmetic check: CI-equivalent set on baseline was 1389 − 21 (the two
excluded `plutil` files) = 1368 tests. Plus 8 new tests = **1376**, matching
1375 + 1 environment fail.

## CI job map (unchanged)

| Job | This host | Honest status |
|---|---|---|
| `build-test` lint / typecheck / build | ran | green |
| `build-test` Vitest + Postgres | ran (local PG 16) | green except `swift dump-package` |
| `native-contract` | not runnable | skip — needs macOS / Xcode / `plutil` |
| `e2e` | not run this session | skip — Playwright + app server; not required for P1.1 service boundary |
| iOS main-thread / TestFlight | not run | skip — Track B / Mac |

## Human-gated (printed, not simulated)

Trust-glanceability **B1–B6** and `UNBLOCK-7B-8B` (Google policy, Coolify
secrets, Resend/Apple, physical iPhone, staging TLS, off-host `pg_dump`).
Live capabilities were not probed with write access. No Coolify deploy.

## Verdict

P0 is a **measured** baseline, not a lowered one. Product gates that this
environment can run are green. Apple-only suites remain the macOS CI job.
P1.1 ownership + event atomicity are proven on ephemeral Postgres.
