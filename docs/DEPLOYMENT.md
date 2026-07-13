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

**Schema migrations runbook (Phase 1A establishes the pattern; 1B hardens):**
- Migrations are forward-only, numbered (`drizzle/0000_initial.sql`, …).
- Regenerate after schema changes: `pnpm db:generate`.
- Apply to a DB: `pnpm db:migrate` (uses `DATABASE_URL`).
- **Predeploy backup before every production migration** (SEC-07; full drill in
  Phase 1B). Until 1B ships the backup automation, run a manual `pg_dump` of
  the prod DB before applying any migration.
- Breaking schema changes use expand/migrate/contract across two deploys with a
  compatibility window for old clients (ADR-002).
- Rollback = redeploy the previous image + restore the predeploy backup
  (forward-only means no `db:rollback`).

**Healthcheck endpoint** `/api/health` returns `{status:"ok"}` once 1B ships
the route; for 1A it is not yet implemented (no route handlers this phase).
