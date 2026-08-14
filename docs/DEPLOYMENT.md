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
SHA and UTC build date. The archive gate verifies the app and widget
identities, versions, signatures, HealthKit/App Group entitlements, each
executable's privacy manifest, and provenance before export or upload.
`export` also unpacks and validates the distribution-signed IPA. Xcode output
is scrubbed of optional API-key values before it is written to release logs.

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
| `CRON_SECRET` | Bearer secret for `POST /api/v1/jobs/tick` (ADR-004 scheduler). Each tick records a scheduler run, materializes routines, computes deduplicated `notification_jobs`, atomically claims due work, and delivers or durably retries Web Push. Claims heartbeat during delivery; provider fan-out is capped at four concurrent requests and ten live subscriptions per account. The Origin/CSRF proxy guard skips this path because it uses bearer, not cookies. **The cron now exists — see below.** |
| `ANTHROPIC_API_KEY` | Optional; AI co-planner (503 if missing on AI routes) |
| `RESEND_API_KEY` | Enables password email and native magic-link delivery. `/api/v1/auth/capabilities` reports `magicLink: true` only when non-empty. |
| `APPLE_CLIENT_ID` | Apple **Services ID** used by Better Auth for the web OAuth provider. It is not the native bundle ID. |
| `APPLE_TEAM_ID` | Apple Developer team ID used to sign the server-generated client-secret JWT. |
| `APPLE_KEY_ID` | Key ID for the Sign in with Apple `.p8` private key. |
| `APPLE_PRIVATE_KEY` | Full `.p8` contents. Store as a Coolify secret; either real newlines or escaped `\n` are accepted. Never commit or print it. |
| `APPLE_APP_BUNDLE_IDENTIFIER` | Native App ID/bundle ID. Must be exactly `me.neima.kairo` or Apple remains disabled. |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth 2.0 **Web application** client ID; this is also the native server-client audience. |
| `GOOGLE_IOS_CLIENT_ID` | Google OAuth 2.0 **iOS** client ID for bundle ID `me.neima.kairo`. |
| `GOOGLE_CLIENT_SECRET` | Secret for the Google Web application client. Store as a Coolify secret; never add it to an iOS build setting. |

### Native authentication release checklist

Apple, Google, and magic link are fail-closed. `GET
/api/v1/auth/capabilities` exposes exactly `{ "magicLink": boolean, "apple":
boolean, "google": boolean }`. Apple becomes available only when all five
`APPLE_*` values above are present and the bundle identifier matches. Google
becomes available only when `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, and
`GOOGLE_CLIENT_SECRET` are all non-blank. A partial Google configuration is
disabled rather than guessed or exposed. Resend is independent.

Apple Developer configuration must include:

- App ID `me.neima.kairo` with Sign in with Apple and Associated Domains;
- Services ID matching `APPLE_CLIENT_ID`, configured for the web callback used
  by Better Auth at `https://time.neima.me`;
- associated domain `applinks:time.neima.me`;
- a key matching `APPLE_KEY_ID`, `APPLE_TEAM_ID`, and `APPLE_PRIVATE_KEY`.

Before a release, run:

```bash
pnpm api:check-ios
pnpm ios:release:preflight
curl -fsS https://time.neima.me/.well-known/apple-app-site-association
curl -fsS https://time.neima.me/api/v1/auth/capabilities \
  | node scripts/ios-release-contract.mjs --auth-capabilities-stdin
```

The AASA response must be served directly as JSON over HTTPS, include
`A45F46XD54.me.neima.kairo`, and route `/auth/callback`. The production
capability response must contain exactly `magicLink`, `apple`, and `google`,
all boolean. The providers being released must read `true`. A repository
preflight proves the checked-in contract; it does not substitute for this live
probe.

Phase 7B may be completed only after all of this physical-iPhone evidence is
recorded:

1. fresh install and email/password sign-in;
2. force-quit/relaunch with Keychain cookie restoration;
3. expired/revoked 401 signs out and purges account-local data;
4. magic link received on-device and opened through the associated domain;
5. Sign in with Apple succeeds on first authorization and after relaunch;
6. an existing password account explicitly links Apple from Settings without
   changing account scope;
7. logout purges session, cache, cookies, reminders, and account presentation
   state; and
8. cancellation, expired link/challenge, offline, and retry states remain
   actionable without false sign-out.

Use a synthetic/non-production planner account for mutable proof. Do not log
tokens, cookies, magic-link URLs, Apple identity tokens, or private keys.

### Google authentication activation

Google identity is separate from the optional Google Calendar connection. The
identity provider requests only basic identity for sign-in and account linkage;
it does not grant calendar access.

In one Google Cloud project, configure the OAuth consent screen and create:

1. A **Web application** OAuth client. Add `https://time.neima.me` as an
   authorized JavaScript origin and
   `https://time.neima.me/api/auth/callback/google` as an authorized redirect
   URI. For local testing, add `http://localhost:3000` and
   `http://localhost:3000/api/auth/callback/google` separately; never substitute
   localhost values in production.
2. An **iOS** OAuth client whose bundle ID is exactly `me.neima.kairo`. Its
   generated client ID becomes both `GOOGLE_IOS_CLIENT_ID` on the server and
   `KAIRO_GOOGLE_IOS_CLIENT_ID` in the iOS public build settings.

Use the Web application client ID for `GOOGLE_WEB_CLIENT_ID` and
`KAIRO_GOOGLE_SERVER_CLIENT_ID`. Derive the URL scheme by reversing that iOS
client ID (`<id>.apps.googleusercontent.com` becomes
`com.googleusercontent.apps.<id>`) and set it as
`KAIRO_GOOGLE_REVERSED_CLIENT_ID`. The repository release preflight rejects a
distribution app with blank, placeholder, or mismatched identifiers.

Mirror all three server values in the Coolify app and `.env.local`; apply all
three together. The iOS identifiers are public configuration, but belong in
ignored `ios/Signing.local.xcconfig` (or release build settings), not in source
with environment-specific values. After changing Coolify variables, redeploy
the exact pushed SHA even if no code changed.

Activation is complete only after this checklist passes:

1. `GET /api/v1/auth/capabilities` returns the exact three-field shape with
   `google: true`;
2. a real desktop and 390-point mobile browser complete Google sign-in, return
   to `/app/today`, survive reload, and log out cleanly;
3. an existing synthetic password account explicitly links the matching Google
   account from Settings without changing planner scope;
4. cancellation, wrong-email, already-linked, offline, and retry paths remain
   actionable without signing out a valid session;
5. a signed physical iPhone completes Google sign-in, force-quit/relaunch
   Keychain restoration, explicit linking, revoked/expired 401 purge, and
   logout purge; and
6. no log, screenshot, or test artifact contains an ID token, access token,
   cookie, client secret, or private OAuth redirect.

**Current Round 23 state (2026-07-29):** the repository code, simulator
transport/UI, and fail-closed release contract are implemented. A dedicated
Google Cloud project exists (`Kairo`, project ID `kairo-nntime-2026`, account
`neimarules@gmail.com`). The branding wizard contains the Kairo app name,
external audience, support account `neimarules@gmail.com`, and developer
contact `neima@nakhaee.us`, but setup stopped before accepting the Google API
Services: User Data Policy agreement. Consent configuration is therefore not
finalized, and no Web client, iOS client, or client secret exists. The
checked-in iOS public settings and this worktree's local Google server variables
remain blank; no Coolify variables were changed. Production browser OAuth and a
signed physical-iPhone lifecycle remain unproven, so Phase 8B stays unchecked.

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
- The in-process startup runner holds a database-scoped advisory lock while it
  checks, applies, and records migrations. This is required because Next build
  workers and horizontally scaled app processes do not share the module-level
  promise. `migrate-on-startup.integration.test.ts` exercises eight concurrent
  runners against one PostgreSQL database.
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
- `Content-Security-Policy` — **enforcing** (not report-only; the 6C tightening
  already shipped). Verify with
  `curl -sSI https://time.neima.me | grep -i content-security-policy`.
  Known remaining relaxation: `script-src` still allows `'unsafe-inline'` because
  the no-flash theme/a11y bootstrap is an inline `<script>` (`src/app/theme-script.tsx`,
  `src/app/app/layout.tsx`). Dropping it needs per-request nonces or hashed
  external files — tracked as A9 in `docs/plans/2026-08-13-trust-glanceability.md`.
  Do not "fix" it by landing a CSP that breaks first paint.
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
  (node global fetch — the runtime image has no curl). `/api/health` 503s when
  migrations or the database fail and, in production, when the scheduler is
  unconfigured, its newest completed run failed, or its latest success is more
  than five minutes old. A new process receives a five-minute `warming` grace
  period before the first recorded run. AI remains an optional check. After a
  deploy the app should read `running:healthy` in Coolify — if it reads
  `running:unknown`, the image predates this section.
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
**Verification contract:** consecutive executions one minute apart must return
`200 {"ok":true,…,"notifications":{…},"delivery":{…}}`, `/api/health` must
report `checks.scheduler:"ok"` with a recent `schedulerLagSeconds`, and the
latest `scheduler_runs` row must be `succeeded`. A created task is not evidence
— always read the executions list. Note the singular endpoint
(`/scheduled-tasks/{uuid}`) returns 404 on this Coolify version; only
`…/executions` works, so use that to inspect a task.
