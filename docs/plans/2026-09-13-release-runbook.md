# Kairo release operations runbook (Task 5.1)

Executable checklist for **forward-only** Postgres migrations, predeploy backups, and
recovery. This document reflects the migration chain on **`main` at commit
`77823d3`** (ten SQL migrations, `0000`–`0009`). **Production dump/restore remains
unverified (B6)** until Neima runs the owner steps below on the Coolify host with a
current encrypted off-host backup.

## Migration chain inventory (`main`)

| # | File | Purpose |
|---|------|---------|
| 0000 | `0000_initial.sql` | Core planner schema + Better Auth tables |
| 0001 | `0001_seed_categories.sql` | Global category seed rows |
| 0002 | `0002_add_push_subs_revision.sql` | Push subscription revision column |
| 0003 | `0003_add_push_subs_keys.sql` | VAPID key columns on push subs |
| 0004 | `0004_reconcile_push_subs.sql` | Reconcile legacy push rows |
| 0005 | `0005_push_subs_unique_idx.sql` | Partial unique index on live subs |
| 0006 | `0006_rebuild_push_subs.sql` | **No-op** (`SELECT 1`) — superseded rebuild |
| 0007 | `0007_push_subs_doblock.sql` | **No-op** (`SELECT 1`) — DO-block variant retired |
| 0008 | `0008_push_subs_fk_fix.sql` | Authoritative push_subscriptions rebuild (FK → `"user"`) |
| 0009 | `0009_durable_notification_jobs.sql` | Durable notification jobs + scheduler runs |

**Next free number on `main`:** `0010`. Do not reuse numbers from parked branches
without rebasing the chain (`migration-chain.test.ts` forbids gaps/duplicates).

### Parked migration branches (not on `main`)

| Branch | Migration | Expand step | Old clients | Rollout |
|--------|-----------|-------------|-------------|---------|
| `feat/quiet-today` | `0010_today_helpers.sql` | `user_settings.today_helpers boolean NOT NULL DEFAULT true` | Absent column ignored until deploy reads it; default `true` preserves Today UI | **Deploy 1:** merge quiet-today alone after B6 backup |
| `feat/client-error-sink` (stacked on quiet-today) | `0011_client_error_reports.sql` | New `client_error_reports` table + index | No native dependency until clients POST errors | **Deploy 2:** merge after quiet-today is live; never ship both migrations in one deploy |

For each parked migration:

- **Predeploy backup gate:** B6 `pg_dump -Fc` off-host immediately before the deploy
  SHA that contains the migration (see checklist below).
- **Failure behavior:** in-process runner holds `pg_advisory_lock`, records each file in
  `__migrations`. A failed statement leaves the DB inconsistent — **do not** mark the
  release healthy; restore from the predeploy dump (forward-only; no `db:push` on prod).
- **Rollback / forward-fix:** redeploy the **previous Coolify image** + restore the
  predeploy backup. Forward-fix only after a fresh backup and a rehearsed SQL change on
  an isolated DB. Never auto-restore production on an ambiguous deploy failure.

## Runtime migration paths

| Path | When | Readiness |
|------|------|-----------|
| `src/server/db/migrate-on-startup.ts` | **Production Docker** (`CMD node server.js`), dev import of `@/server/db` | `/api/health` → `checks.migrate` fails closed on error |
| `pnpm db:migrate` | Local/CI drizzle-kit | Developer tool; not the container entrypoint |
| `scripts/migrate.ts` | Legacy standalone script | **Not used** in the Dockerfile; exits 0 on failure — do not rely on it for readiness |

Concurrent app workers serialize on advisory lock `hashtextextended('kairo-schema-migrations', 0)`.
Evidence: `migrate-on-startup.integration.test.ts` (eight parallel workers, one `0009` apply).

## Local rehearsal (synthetic — no production data)

Automated proof (Vitest, requires local Postgres + `pg_dump`/`pg_restore`):

```bash
export TEST_DATABASE_URL='postgresql://kairo:kairo@localhost:5432/kairo_test'
pnpm exec vitest run src/server/db/recovery-rehearsal.integration.test.ts \
  src/server/db/migrate-on-startup.integration.test.ts \
  src/server/db/migration-chain.test.ts
```

The rehearsal suite seeds a synthetic account (task → schedule → recurrence override,
`change_log`, `planner_events`), dumps with `pg_dump -Fc`, restores into an isolated
database name, and asserts row-level integrity — not merely a zero exit code.

Manual operator mirror (same semantics as SEC-07 in `docs/DEPLOYMENT.md`):

```bash
# 1) Backup (custom format)
pg_dump -h … -U … -d … -Fc -f /secure/kairo-$(date +%Y%m%d-%H%M%S).dump

# 2) Off-host encrypted copy (required)

# 3) Restore drill into an isolated DB — never the live planner DB
createdb kairo_restore_drill_YYYYMMDD
pg_restore -h … -U … -d kairo_restore_drill_YYYYMMDD --no-owner --no-acl /secure/kairo-….dump

# 4) Integrity spot-checks (synthetic or anonymized — never copy prod into browser-qa/)
psql -d kairo_restore_drill_YYYYMMDD -c "SELECT count(*) FROM __migrations;"
psql -d kairo_restore_drill_YYYYMMDD -c "SELECT count(*) FROM activity_series;"
psql -d kairo_restore_drill_YYYYMMDD -c "SELECT count(*) FROM change_log;"

# 5) Drop drill DB when finished
dropdb kairo_restore_drill_YYYYMMDD
```

## Production operator checklist (B6 — owner)

Complete **before any migration-bearing deploy** to production. Do **not** store dumps
under `browser-qa/` or other ordinary QA paths.

| Step | Action | Evidence to record |
|------|--------|-------------------|
| 1 | Confirm target Git SHA and Coolify deployment list note the **previous image** tag/SHA | Screenshot or deployment UUID in `progress.md` |
| 2 | `pg_dump -Fc` prod DB to encrypted storage **off-host** | Path/ bucket id (no credentials), byte size, SHA-256 |
| 3 | Timestamp + retention label (30 daily / 12 monthly per DEPLOYMENT) | UTC timestamp, retention policy name |
| 4 | Access control: who can read/delete backups | Role or bucket policy name only |
| 5 | Optional: `pg_restore --list` on the dump file | Exit 0, non-empty catalog |
| 6 | Apply migration via deploy (in-process runner) | `/api/health` → `checks.migrate:"ok"`, `status:"ok"` |
| 7 | **Restore drill on prod dump** (quarterly) | Isolated DB row counts — **still B6 if not run this quarter** |

**Outage / failed migration mid-apply:** stop traffic promotion, mark app unhealthy
(migrations fail → `/api/health` 503), **restore predeploy backup** to a scratch instance
first to validate, then follow explicit owner decision for production restore — never
automatic on ambiguous failure.

## Deploy ordering for parked features (after B6)

1. Backup (step 2 above).
2. Merge + deploy `feat/quiet-today` only → verify Settings toggle + unchanged default Today.
3. After stable health, backup again.
4. Merge + deploy `feat/client-error-sink` → verify `POST /api/v1/client-errors` 401 when signed out.

## Scheduler and notifications (Task 5.2)

See **`docs/plans/2026-09-13-task-5.2-durable-scheduling.md`** for architecture trace,
ADR-004 alignment, delivery-stage vocabulary, and alert thresholds.

**Quick operator checks (no production mutation):**

1. Coolify → app → scheduled tasks → `kairo-jobs-tick` → **executions** (not just
   task existence): consecutive **200** responses ~1 minute apart.
2. `GET /api/health`: `checks.scheduler` is `ok` or bounded `warming`; `schedulerLagSeconds`
   < **300** when `ok`.
3. On 503: read `checks.migrate`, `checks.db`, `checks.scheduler`; for `failed` /
   `lagging`, inspect latest `scheduler_runs` row and Coolify tick logs.

## What remains unverified

- **B6 production `pg_dump` / off-host encrypted storage / prod restore drill** on the
  current schema (0000–0009 live, 0010+ parked).
- Coolify scheduled-backup UI configuration (API read-only token cannot confirm).
- Physical Web Push / iOS local notification observation (P7 — mocked provider only in 5.2).
- Any recovery action against Neima's live planner without explicit authorization.
