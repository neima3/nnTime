# Deployment — time.neima.me

**Instance:** Coolify public VPS — `https://cool.neima.me` (173.212.218.55).
`*.neima.me` DNS already points here. (Do NOT use `coolify.nak.im` — that's the
home-lab instance.)

**App:** name `kairo`, project `Kairo`, server `localhost`
(`g6gsqmd4wghi3wmqzih11ca9`), source: GitHub App (id 1) → `neima3/nnTime`,
branch `main`, build pack **dockerfile** (repo `Dockerfile`, Next.js standalone,
port 3000), domain `https://time.neima.me`.
App UUID: see `COOLIFY_APP_UUID` in `.env.local` (also visible in the Coolify UI).

**Credentials:** `.env.local` (gitignored) has `COOLIFY_API_URL` +
`COOLIFY_API_TOKEN` (+ `COOLIFY_APP_UUID`). Token source of truth: 1Password item
"cool.neima.me coolify api" (vault **AI**, item `4apenih3hzviy2o2jjlonbdh54`) —
retrieve with `op item get 4apenih3hzviy2o2jjlonbdh54 --fields credential --reveal`
(prompts biometrics). NOTE: token contains a `|` — keep it single-quoted in env files.

## Deploy procedure
1. Gates: `pnpm lint && pnpm build` green. Commit + push to `main` (Coolify builds
   from git — pushing alone does NOT deploy unless auto-deploy webhook is enabled).
2. Trigger:
   ```bash
   set -a; source .env.local; set +a
   curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_API_URL/deploy?uuid=$COOLIFY_APP_UUID"
   ```
3. Poll: `GET $COOLIFY_API_URL/deployments/{deployment_uuid}` until
   `status: finished` (or list via `GET /applications/$COOLIFY_APP_UUID`).
4. Verify live (mandatory): `curl -sSI https://time.neima.me` → 200, then load the
   site in a browser, smoke the changed routes, screenshot to `browser-qa/`.
   A 200 homepage alone doesn't prove the new code is live — check for the change.
5. Report truthfully what was and wasn't verified.

## App env vars
Set in Coolify UI (app → Environment Variables) AND mirrored in `.env.local`.
As of Phase 0 none are required at runtime. Phase 1+ adds `DATABASE_URL`,
`BETTER_AUTH_SECRET`, etc.

## Postgres provisioning (Phase 1A+)

Kairo uses a Coolify-managed Postgres on the same VPS. One database per
environment (staging gets its own app + DB; prod is the live planner).

**Provisioning a managed Postgres in Coolify:**
1. Coolify UI → project `Kairo` → Add Resource → **PostgreSQL**.
2. Name it `kairo-pg` (prod) or `kairo-pg-staging`. Use the `localhost` server.
3. After creation, Coolify exposes a `postgresql://...` connection string in
   the resource's "Connection" tab. Copy it.
4. In the **kairo** app (and staging app) → Environment Variables → add
   `DATABASE_URL='postgresql://user:pass@host:port/dbname'` (quoted; the value
   contains special chars). Mirror it in local `.env.local`.

**Local dev (Phase 1A):** Homebrew `postgresql@17`, database `kairo_dev`:
```bash
psql -d postgres -c "CREATE DATABASE kairo_dev;"
# .env.local:
DATABASE_URL='postgresql://nn@localhost:5432/kairo_dev'
```
The Dockerfile does NOT run migrations (forward-only migrations run via
`pnpm db:migrate` in the deploy step, see migrations runbook below).

**Schema migrations runbook (Phase 1B hardened):**
- Migrations are forward-only, numbered (`drizzle/0000_initial.sql`, …).
- Regenerate after schema changes: `pnpm db:generate`.
- Apply to a DB: `pnpm db:migrate` (uses `DATABASE_URL`).
- **Predeploy backup before EVERY production migration** (SEC-07): run the
  backup procedure below before applying any migration to prod. No exceptions.
- **Breaking schema changes use expand/migrate/contract** across two deploys:
  1. *Expand*: add the new column/enum value (additive, old code keeps working).
  2. *Migrate*: deploy the new code that writes both old + new; backfill.
  3. *Contract*: after the compatibility window (≥1 release for old clients,
     per ADR-002), remove the old column/enum value.
- **Rollback** = redeploy the previous image + restore the predeploy backup
  (forward-only means no `db:rollback`). Previous image tag is visible in the
  Coolify deployments list.
- **Outage rule**: if a migration fails mid-apply, the DB is in an unknown
  state — restore the predeploy backup immediately, do not attempt a partial
  forward-fix without re-running the full predeploy-backup step.

**Healthcheck endpoint** `/api/health` returns `{status:"ok"}` (Phase 1B). Set
this as the Coolify healthcheck path so the proxy marks the container unhealthy
if the app stops serving. Deeper liveness (DB roundtrip, scheduler lag per
ADR-004) is layered in once those subsystems exist (1C/2B).

## Backups & restore (SEC-07 — Phase 1B)

**Backup procedure (run before every prod migration + on the schedule below):**
```bash
# On the Coolify VPS (SSH or Coolify terminal), target the prod Postgres.
# The connection string is in the Coolify Postgres resource "Connection" tab.
PGPASSWORD=<password> pg_dump -h <host> -U <user> -d <db> -Fc -f /tmp/kairo-prod-$(date +%Y%m%d-%H%M%S).dump
# Off-host copy (REQUIRED — a backup on the same host dies with the host):
# scp it to object storage, another server, or download via Coolify's file manager.
```
- **Schedule**: automated encrypted daily backups via Coolify's built-in
  Postgres scheduled-backup feature (resource → Backups → schedule → daily).
  Configure the off-host destination (S3-compatible) in the same screen.
  Retention: 30 daily + 12 monthly. Monitoring: Coolify alerts on backup failure.
- **Manual pre-migration backup**: always `pg_dump` immediately before applying
  a migration to prod, in addition to the scheduled backups.

**Restore drill (MUST be proven before prod has real data — Phase 1B gate):**
```bash
# 1. Restore the dump into an ISOLATED database (never the live prod DB).
createdb kairo_restore_drill
PGPASSWORD=<password> pg_restore -h <host> -U <user> -d kairo_restore_drill /tmp/kairo-prod-<timestamp>.dump
# 2. Verify row counts / a known row round-trip.
psql -h <host> -d kairo_restore_drill -c "SELECT count(*) FROM users;"
# 3. Drop the drill DB.
dropdb kairo_restore_drill
```
Record the drill result (date, source dump, row counts, who ran it) in the
progress note for the subphase that ships real data. The drill is repeated
periodically (Phase 8C ongoing hardening).

## Security headers (SEC-09 — Phase 1B)

Applied by `src/proxy.ts` (Next.js 16 — `middleware.ts` is renamed `proxy.ts`)
on every non-static response:
- `Content-Security-Policy-Report-Only` (tighten to enforcing in 6C once the
  app is exercised; report endpoint `/api/csp-report` for violations).
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` minimal (camera/microphone/geolocation/cohort disabled)
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
- Request-body size cap (1 MB) on mutations → 413.

**Verified live**: after each deploy, check the headers are present on the live
URL (`curl -sSI https://time.neima.me | grep -i 'content-security\|x-frame\|nosniff'`).
Headers may also be set at the Coolify proxy layer; the app-level ones are the
source of truth.
