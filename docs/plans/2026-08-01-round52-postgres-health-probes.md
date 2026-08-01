# Round 52 Postgres Health Probe Accuracy Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both GitHub Actions Postgres service health checks probe the
database each job actually creates, eliminating false FATAL connection noise.

**Architecture:** Keep the existing Postgres 17 service, credentials, ports,
and application URLs. Change only each Docker health command from PostgreSQL's
implicit user-named database to its explicit synthetic job database. Pin the
mapping structurally so future database renames cannot silently drift from the
readiness probe.

**Tech Stack:** GitHub Actions YAML, Postgres 17 `pg_isready`, Vitest.

---

## Requirements

- `build-test` probes `kairo_test` and E2E probes `kairo_e2e`.
- Each probe retains the `kairo` user, 5-second interval/timeout, and ten
  retries.
- Service image, credentials, ports, application `DATABASE_URL`, and test
  behavior remain unchanged.
- Hosted service logs contain zero `FATAL database "kairo" does not exist`.

## File map

- Modify `.github/workflows/ci.yml`: add the correct `-d` database to each
  `pg_isready` health command.
- Add `tests/ci-postgres-health-contract.test.ts`: parse workflow services and
  pin job-to-database readiness mappings plus unchanged timing policy.
- Update this plan and `docs/plans/progress.md` with red/green, review, exact CI,
  deployment, and live proof.

### Task 1: Pin the readiness drift red

- [x] Preserve the 25 build-test and 29 E2E false-FATAL lines from run
  `30715801239` as baseline evidence.
- [x] Add the structural health-probe contract and observe both mappings fail.

### Task 2: Correct both probes

- [x] Add `-d kairo_test` to build-test and `-d kairo_e2e` to E2E.
- [x] Preserve every other service and timing option.
- [x] Run focused plus full local gates green.

### Task 3: Review and release

- [x] Obtain independent review and resolve every actionable finding.
- [x] Fast-forward `main`, rerun merged focused gates, push, and require exact-SHA
  GitHub CI success.
- [x] Require both completed Linux service logs to contain zero false-FATAL
  database line while preserving unit and **21/21** browser coverage.
- [x] Require Coolify exact-SHA deployment plus read-only live health, record the
  handoff, and clean the feature worktree.

## Self-review

- `pg_isready` now targets the same database endpoint name as each job instead
  of PostgreSQL's incorrect implicit user-named database. It remains a server
  acceptance probe, not a query-level application health check.
- This changes no application query, schema, migration, data, or production
  deployment setting.
- Remaining Postgres image locale/trust initialization notices are external
  container startup messages, not misdirected application probes.
