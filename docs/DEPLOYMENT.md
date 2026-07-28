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
1. Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green. Commit +
   push to `main`.
2. **Auto-deploy IS enabled** (verified 2026-07-24): pushing to `main` starts a
   build on its own. A manual trigger is only needed to redeploy the same commit
   (e.g. after changing env vars) — and if you push *and* trigger, you get two
   builds, the second queued behind the first:
   ```bash
   set -a; source .env.local; set +a
   curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_API_URL/deploy?uuid=$COOLIFY_APP_UUID"
   ```
3. Poll: `GET $COOLIFY_API_URL/deployments/{deployment_uuid}` until
   `status: finished`, or watch the queue drain with
   `GET $COOLIFY_API_URL/deployments` (it lists only queued/in-progress builds).
4. Verify live (mandatory): `curl -sSI https://time.neima.me` → 200, then load the
   site in a browser, smoke the changed routes, screenshot to `browser-qa/`.
   A 200 homepage alone doesn't prove the new code is live — check for the change.
   Pick a marker unique to the new code: a string only the new build emits, or a
   rule only the new stylesheet contains
   (`curl -s <page> | grep -o '/_next/static/[^"]*\.css'`, then grep that file).
   Markers shared with the old build (a token both versions reference) will
   "confirm" a deploy that never landed.
5. Report truthfully what was and wasn't verified.

## Native iOS distribution

Kairo's iOS release is produced from the XcodeGen application target and kept
separate from the Coolify web deployment. The authoritative commands are:

```bash
pnpm ios:release preflight
pnpm ios:release archive
pnpm ios:release export
pnpm ios:release upload
```

The driver writes only to git-ignored `artifacts/ios-release/`, preserves Xcode
logs, and refuses a dirty release checkout. It derives a positive build number
from `KAIRO_BUILD_NUMBER` or the git commit count and embeds both the exact git
SHA and UTC build date. The archive gate verifies the app and widget identities,
signature, HealthKit/App Group entitlements, root privacy manifest, and
provenance before export or upload.

`export` uses App Store Connect distribution signing but does not upload.
`upload` is the Apple-side mutation and requires an existing verified archive.
Authentication comes from the signed-in Xcode account or from all three
optional environment variables below; their values are never printed:

| Var | Purpose |
|-----|---------|
| `KAIRO_ASC_KEY_PATH` | Absolute path to the App Store Connect API `.p8` key |
| `KAIRO_ASC_KEY_ID` | App Store Connect API Key ID |
| `KAIRO_ASC_ISSUER_ID` | App Store Connect API Issuer ID |

Never report “available in TestFlight” from a successful `xcodebuild` upload
alone. Confirm that App Store Connect accepted the build and completed
processing. Keep the exact Apple validation error when upload or processing
fails; do not weaken the repository or archive gate to work around it.

## App env vars
Set in Coolify UI (app → Environment Variables) AND mirrored in `.env.local`.
Phase 1+ requires `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Canonical origin |
| `TRUSTED_ORIGINS` | Optional comma-separated extra Origins allowed for cookie-auth API mutations (always allows `https://time.neima.me` + `http://localhost:3000`) |
| `CRON_SECRET` | Bearer secret for `POST /api/v1/jobs/tick` (ADR-004 scheduler). Each tick materializes routines, computes notification jobs, and delivers due web-push nudges (`deliverDueNudges`). The Origin/CSRF proxy guard skips this path because it uses bearer, not cookies. **The cron now exists — see below.** |
| `ANTHROPIC_API_KEY` | Optional; AI co-planner (503 if missing on AI routes) |

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

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (added
  2026-07-27; no `preload` on purpose — that's a hard-to-undo commitment).
  Browsers only honor HSTS over TLS, so it's inert on local http dev.

## Container health + monitoring (8C, 2026-07-27)

- The **Dockerfile carries a `HEALTHCHECK`** hitting `/api/health` every 30 s
  (node global fetch — the runtime image has no curl). `/api/health` 503s
  only on the hard dependencies (DB unreachable / migrations failed); AI and
  scheduler are explicitly optional there, so the check cannot flap on soft
  failures. After a deploy the app should read `running:healthy` in Coolify —
  if it reads `running:unknown`, the image predates this section.
- The **Coolify-side healthcheck toggle** (app → Health Checks → path
  `/api/health`, port 3000) is complementary and needs the UI or a
  write-scoped token: the CLI/API token in `.env.local` is **read-only**
  (GETs work; PATCH `/api/v1/applications/{uuid}` returns Unauthenticated).
  Same limitation applies to verifying scheduled DB backups by API — confirm
  those in the UI (database resource → Backups: daily schedule + retention
  per the section above).

## Scheduled push cron (H1 → I3, live 2026-07-24)

Scheduled reminders need something to call `POST /api/v1/jobs/tick`. That is now
a **Coolify scheduled task** on the `kairo` app — not an external service — so it
lives and dies with the app:

| field | value |
|---|---|
| name | `kairo-jobs-tick` |
| task uuid | `hfhf3aequ16o5si78jh7uq5i` |
| frequency | `* * * * *` (every minute; the delivery window is ±2 min) |
| command | `node -e "fetch('http://127.0.0.1:3000/api/v1/jobs/tick', …Bearer process.env.CRON_SECRET…)"` |

The command runs **inside the app container**, so it reaches the server over
loopback and reads `CRON_SECRET` straight from the container env — no public
round trip, no secret duplicated anywhere. It uses `node -e` with global fetch
because the runtime image is `node:24-alpine`, which has no `curl`.

Manage it with:
```bash
set -a; source .env.local; set +a
# list tasks
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_API_URL/applications/$COOLIFY_APP_UUID/scheduled-tasks"
# execution history — the only proof it actually fires
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_API_URL/applications/$COOLIFY_APP_UUID/scheduled-tasks/hfhf3aequ16o5si78jh7uq5i/executions"
```
**Verified:** consecutive executions one minute apart, each returning
`200 {"ok":true,…,"delivery":{…}}`. A created task is not evidence — always read
the executions list. Note the singular endpoint
(`/scheduled-tasks/{uuid}`) returns 404 on this Coolify version; only
`…/executions` works, so use that to inspect a task.
