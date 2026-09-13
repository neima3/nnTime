# Kairo — Production release contract (2026-09-13)

Companion to `2026-09-13-production-completion-program.md`. This is the
release *gate*, not a deploy runbook. The deploy runbook remains
`docs/DEPLOYMENT.md`.

## Never from this program

- Push or merge to `main` (Coolify auto-deploy is enabled).
- Production migrations, destructive QA, or Coolify API deploys without Neima.
- Tick 7B / 8B without physical-iPhone + live capability evidence.
- Fake staging (`time-staging.neima.me` was TLS-fail as of the trust plan).

## Required green before a PR is ready for human review

Same commands as `AGENTS.md`. Do not drop a flag, exclude a suite permanently
in repo config, or convert a failure into a skip to go green.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) splits the same truth across jobs:

| Job | Runner | What it proves |
|---|---|---|
| `build-test` | ubuntu-latest + Postgres 17 | lint, typecheck, Vitest **minus** the two `plutil` release suites, `pnpm build` |
| `native-contract` | macos-latest | OpenAPI ↔ Swift, `plutil` release contracts, generated client + app-hosted tests |
| `e2e` | ubuntu-latest + Postgres 17 | Playwright against the standalone server |

A Linux cloud agent **must not** rewrite iOS suites to skip. Record the
Apple-toolchain misses as environment skips in the P0 ledger. Use the
`build-test` Vitest invocation as the Linux-equivalent gate:

```bash
pnpm exec vitest run \
  --exclude tests/ios-release-contract.test.ts \
  --exclude tests/ios-release-script.test.ts
```

`tests/ios-generated-client-adoption.test.ts` still contains one test that
shells out to `swift package dump-package`. If `swift` is absent, record that
single test as an environment miss — do not delete or skip it in source.

## Parity floor

Do not ship a change that drops scripted parity below **89.74% web /
86.93% iOS**. Relocate ≠ drop credit. Deleting SoftStreaks is a stop.

## Track B reminder (not this PR)

B1 Google User Data Policy + OAuth clients.
B2 Coolify Google secrets + live `"google":true`.
B3 Resend + Apple Sign-In vars.
B4 Physical iPhone lifecycle.
B5 Staging DNS + Let's Encrypt.
B6 Off-host `pg_dump` before any schema deploy.

## This PR's release posture

Draft PR only. No deploy. No `main`. Next human review is the P0 ledger +
P1.1 ownership/atomicity tests.
