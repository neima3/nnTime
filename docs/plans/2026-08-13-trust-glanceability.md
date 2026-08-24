# Kairo — Trust + Glanceability Plan v2

Status: Slice 1 shipped — see progress.md 2026-08-14 (Round 88).
A2 (iOS editor scopes) shipped — see progress.md 2026-08-14 (Round 89).


> **For agentic workers:** execute **Slice 1** only unless a later prompt names a later Track A item. Track B is human-gated. If a step needs Neima, a phone, DNS, Coolify UI, or SSH: **STOP and report**. Do not simulate evidence.
>
> **Goal:** Make the daily planner trustworthy at the moment of edit, and glanceable at the moment of looking — not add more features.
>
> **Architecture:** Server already implements ADR-001 scopes (`this` / `this_and_future` / `all`). The flagship web editor never asks, and always sends `all`. Client clocks ignore the planning zone. Today is over-furnished. Fix those. Do not grow the arcade or the helper stack.

**Tech stack:** existing Next.js 16 / React 19 / Tailwind v4 / Postgres + Drizzle / Better Auth / `/api/v1/*` / SwiftUI iOS. No new runtime deps.

**Status of this document:** v2, 2026-08-13. Reviewer independently verified every central v1 claim. v1 is superseded; do not execute v1.

---

## What changed in v2 (reviewer → plan)

| v1 problem | v2 fix |
|---|---|
| Agent vs human work mixed | Explicit **Track A / Track B**. Track B is a <1 hour Neima checklist. Agents STOP. |
| One-session slice was a closing hint | **Slice 1** is the first-class deliverable, at the top, with ordered steps and exact commands. |
| Phase 2 would silently strip Today | Screenshot gate (390 + 1440, light + dark), one-commit revert, one-tap acceptance tests, settings flag defaulting to current behavior. |
| `?nowMin=` as a production query param | **Killed.** Playwright clock for e2e. Any visual hook follows the existing localhost-only `ritualDebug` / `calibrationDebug` convention. |
| Plan forbade writing files, so an executor had nowhere to put it | Exact paths and contents named below. |
| Parity interaction unstated | Floor **89.74 web / 86.93 iOS**. Relocate ≠ drop credit. Delete SoftStreaks = stop. |
| Migrations underspecified | Per-migration expand/rollback + migrate-on-startup concurrency ruling. |
| DAL-split acceptance would break the barrel | Barrel keeps the exact public surface. `rg "^export async function" src/server/dal/index.ts` is zero *because* index becomes re-exports only. |

Nothing else is softened.

---

## Thesis (do not dilute)

Kairo is past the point where more surfaces help. The product Neima opens every morning is a visual day. Trust and glanceability are the product. Another game, another nudge, another chip on Today, is a regression even if it is pretty and even if a parity row could be stretched to cover it.

The single most valuable fact in this program, independently re-verified:

- `src/components/ActivityEditor.tsx:405` sends `editScope: "all"` on every save.
- `:464` deletes with `?editScope=all`.
- That file contains **zero** occurrences of `this_and_future` and **zero** scope prompt.
- `initialOccurrenceKey` exists on the props type and is never read. `/app/editor` never parses an occurrence query param. `TodayTimeline` `handleOpen` pushes `/app/editor?id=&date=` with no key. Week chips split `${seriesId}:${occurrenceKey}` and then drop the key.

The server is not the bug. The flagship editor silently rewrites a whole series. Timeline complete/drag/review already speak `this`. The editor is the hole.

Second: seven production `getHours()` call sites compute "now" in the browser zone, not the planning zone. Auckland already burned us once (`formatDayLabel`). Same class of bug, still live on Today, the editor, Anytime slotting, the current-activity ring, Daily Brief, and Peak Focus.

Third: Today is over-furnished. Above the timeline an authenticated morning can mount SoftStreaks, PickForMe, DailyBrief, PeakFocusNudge, DayRituals, plus LowBattery, DayLoadMeter, and TimezoneNudge. The day is the product. The helpers are furniture.

**Stop adding games. Stop adding Today helpers.** There are 18 arcade games. That is enough. The next session that adds a 19th, or another card above the timeline, is working the wrong thesis.

---

## Measured state (2026-08-13, post Round 87)

| Thing | Number / fact |
|---|---|
| Web parity | **89.74%** (70.0 / 78) |
| iOS parity | **86.93%** (76.5 / 88) |
| Combined | 86.93% |
| Unit tests | 138 files / 1313 tests |
| E2E | 48 passed / 4 skipped / 0 failed |
| Arcade | 18 games in `src/lib/games.ts` `GameId` |
| Live `GET /api/v1/auth/capabilities` | `{"magicLink":false,"apple":false,"google":false}` |
| Live CSP | enforcing `script-src 'self' 'unsafe-inline'` (`src/proxy.ts:12`) |
| `docs/DEPLOYMENT.md:301` | still says `Content-Security-Policy-Report-Only` — **stale** |
| `https://time-staging.neima.me/api/health` | HTTP 000, TLS failure |
| `getHours()` production sites | ActivityEditor 606/614, AnytimeRail 53, CurrentActivityRing 36/39, DailyBrief 36/61, PeakFocusNudge 58, LiveNowLine 20 (documented empty-zone fallback) |
| AppShell shortcuts | `:96` `window.location.href = route` (full reload) |
| Roadmap still open | 7B (physical iPhone auth), 8B (Google live + iPhone) |
| Latest drizzle file | `0009_durable_notification_jobs.sql` |
| DAL barrel | `src/server/dal/index.ts` — 2 classes, 1 type, 35 `export async function`s, ~1.4k lines |
| SoftStreaks parity row | **K01** credit 1 — "SHIPPED: SoftStreaks component" |

---

## Non-goals

| Do not | Why |
|---|---|
| Add a 19th game, a new Today card, or a new "helper" | Thesis. Furniture is the problem. |
| Invent `?nowMin=` or any other production-visible time knob | Repo convention is localhost-only debug params. Playwright has a clock. |
| Delete SoftStreaks / PickForMe / DailyBrief / DayRituals / PeakFocusNudge **code** | Relocate. Deleting K01 drops parity. |
| Silently ship the quiet Today as the new default | Neima has to see before/after first. |
| Touch Google / Apple / Resend env, DNS, Coolify TLS, or SSH | Track B. |
| Destructive tests against prod | Prod is Neima's real planner. |
| Fake a Track B result (staged TLS 200, iPhone screenshot, `google:true` on live) | Instant disqualify. |
| Deviate from ADR-001…005 or the design-token contract | Stop and hand off. |
| Rewrite CSP to kill `unsafe-inline` in Slice 1 | Real work, later Track A; Next inline bootstraps make it easy to break the app. |
| "Improve" iOS EditorSheet in the same Slice 1 commit as the web editor | Same bug class (`KairoAPI.updateActivity` defaults `editScope` to `.all`); its own slice. |
| Mass-refactor the DAL in Slice 1 | 6.3 is Track A, later, and must preserve the barrel. |

---

## ADR watch-outs (binding)

- **ADR-001.** All three edit scopes must be reachable from the flagship editor. `this` / `this_and_future` require `occurrenceKey`. Completed past occurrences are never mutated by series edits. `this_and_future` is a transactional split; occurrence identity survives. Do not invent a fourth scope. Planning timezone is the clock; `getHours()` is not.
- **ADR-002.** If-Match stays on every PATCH/DELETE. OpenAPI, zod, and iOS generated client stay in lockstep (`pnpm api:sync-ios` / `pnpm api:check-ios`). New settings fields are a contract change.
- **ADR-003.** Capabilities stay fail-closed. Do not render a Google button because a plan said "Phase 5". Live is `google: false` until Track B flips env.
- **ADR-004.** Scoped delete of a series must keep the existing focus-session cascade (already pinned in `cascade.test.ts`). Do not reintroduce a running session on a tombstoned activity.
- **ADR-005.** New tables get `user_id` in the same predicate. Cross-user → 404. `client_error_reports` redacts tokens, cookies, Authorization, ICS URLs, AI prompts. CSP: `unsafe-inline` is a convenience the ADR forbids as a destination, not a Slice 1 rewrite.

Design: tokens only (`src/app/globals.css`). No Inter, no raw hex, no default Tailwind palette. The scope prompt and the quiet Today are DESIGN-SENSITIVE — follow existing editor chips / Settings toggles; do not invent a new visual language.

---

## Track A vs Track B

An executing agent works **Track A** only. The moment a step is Track B, the agent prints the checklist item, what is blocked, and stops. It does not "try anyway". It does not produce a screenshot of a simulator and call it an iPhone. It does not curl staging until TLS works and then write "verified".

### Track A — agent-executable today

| ID | Item | Notes |
|---|---|---|
| **Slice 1** | Editor scopes + zone clock + AppShell push + CSP doc | Defined below. This session. |
| ~~A2~~ | iOS `EditorSheet` / `KairoAPI.updateActivity` scope prompt | **DONE** — Round 89, see progress.md 2026-08-14. |
| A3 | Phase 2 **behind the flag, default ON** | No visual change for Neima until he flips it. |
| A4 | Phase 2 screenshot pack + one-tap e2e | Gate, not a ship-default. |
| A5 | Phase 2 default-flip commit (one line) | Only after Neima has seen A4. |
| A6 | Remaining `getHours()` if Slice 1 missed a site | Should be none. |
| A7 | 6.3 DAL split with barrel preserved | Later. |
| ~~A8~~ | 6.2 `client_error_reports` **code + migration file** | **DONE** — branch `feat/client-error-sink`. Migration file only; not applied to prod (needs B6 pg_dump first, then a solo Coolify deploy — never in the same SHA as 4.3). |
| A9 | CSP tightening research + a real plan to drop `unsafe-inline` | Separate session. Do not land a broken CSP. |
| A10 | Unit/e2e/browser evidence, gates, `progress.md`, commit, push | Always. |
| A11 | Deploy + live-verify of Track A SHAs on `https://time.neima.me` | Only after gates. No destructive QA on prod data. |

### Track B — human-gated. Agent STOPS.

Print this checklist. Do not start the item.

| # | Who | Minutes | Exact action | Done when |
|---|---|---|---|---|
| B1 | Neima | ~10 | Accept **Google API Services User Data Policy** on Cloud project `Kairo` (`kairo-nntime-2026`, `neimarules@gmail.com`). Create Web + iOS OAuth clients per `docs/DEPLOYMENT.md` / `docs/plans/UNBLOCK-7B-8B.md`. | Clients exist. |
| B2 | Neima | ~5 | Set Coolify secrets `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Set iOS public IDs. Redeploy current SHA. | Live `GET https://time.neima.me/api/v1/auth/capabilities` has `"google":true`. |
| B3 | Neima | ~20 | `RESEND_API_KEY` + five Apple Sign-In Coolify vars. Redeploy. | Live capabilities `magicLink` / `apple` match what was actually provisioned. |
| B4 | Neima + phone | ~30 | `./scripts/ios-device-install.sh <TEAM_ID>` and the DEPLOYMENT.md physical lifecycle (password, magic link, Apple, Google, Keychain relaunch, linking, 401 purge, logout). | 7B / 8B can be ticked with device evidence. |
| B5 | Neima | ~10 | Staging DNS: `time-staging.neima.me` A/AAAA → public VPS. Coolify app + Let's Encrypt. | `curl -sSI https://time-staging.neima.me/api/health` is HTTP 200, not TLS fail. |
| B6 | Neima | ~10 | Before any 4.3 / 6.2 prod deploy: SSH to the Coolify/Postgres host and `pg_dump` per `docs/DEPLOYMENT.md` SEC-07. Restore drill if not done this quarter. | Dump file exists off-host; progress note records it. |

B1–B4 already live in `docs/plans/UNBLOCK-7B-8B.md`. v2 does not replace that page; it classifies it as Track B so an agent does not stall inside "Phase 5".

**Stop rule:** if you catch yourself writing "I couldn't do the iPhone pass so I used the simulator and ticked 7B", you have failed. Leave 7B/8B unchecked.

---

## Slice 1 — the one-session deliverable

**Name:** Round 88 / Slice 1 — *Honest edit, honest clock, no reload*.

**Sized to finish and ship in one session.** No schema. No Today deletion. No Track B. No iOS EditorSheet. No DAL split.

### Ordered work

1. **Write the program files** (this plan forbade v1 from writing; the executor must).
2. **Occurrence identity into the editor.**
3. **Scope prompt + honest save/delete.**
4. **Planning-zone clock at every `getHours()` site except the documented LiveNowLine fallback.**
5. **AppShell shortcuts use the router.**
6. **Correct the stale CSP sentence in `docs/DEPLOYMENT.md`.**
7. **Verify, gate, hand off, commit, push, live-verify.**

### Files the executor writes first

| Path | What goes in it |
|---|---|
| `docs/plans/2026-08-13-trust-glanceability.md` | This entire v2 document. Add a one-line status under the title: `Status: Slice 1 in progress` then `Status: Slice 1 shipped <sha>` when done. |
| `docs/plans/trust-glanceability-agent-prompt.md` | Pasteable prompt. Contents: read AGENTS.md → this plan → execute **Slice 1 only** → Track A/B split → stop-don't-simulate → exact verification commands below → append `progress.md` → do not tick 7B/8B. |
| `docs/plans/progress.md` | **After** Slice 1, append a dated section (template at the bottom of this plan). Do not rewrite old entries. |

Do not add a new checkbox to `docs/plans/2026-07-12-kairo-roadmap.md` for Slice 1. This is a quality program on top of a finished Phase 6, not a new roadmap phase.

### Step 2 — occurrence identity

**Modify**

- `src/app/app/editor/page.tsx` — read `occurrenceKey` (or `occurrence`) from `searchParams`; pass `initialOccurrenceKey`.
- `src/components/TodayTimeline.tsx` `handleOpen` (~262) — include `occurrenceKey` from the activity when present.
- `src/app/app/week/page.tsx` ~288 — the chip id is `${seriesId}:${occurrenceKey}`; pass both (`id=` and `occurrenceKey=`).
- Any other `/app/editor?id=` construction (`grep` it). Create flows stay keyless.

**Do not** invent a second editor route.

### Step 3 — scope prompt

**Modify** `src/components/ActivityEditor.tsx`.

Behavior:

- One-off (`repeat === "none"`): keep today's save; `editScope: "all"` is correct for a non-recurring series. Delete confirm stays one question.
- Recurring (`repeat !== "none"` **or** the loaded series has an `rrule`): show a three-way control **before** save, using the existing chip pattern (see the repeat chips at ~658). Labels, in this order:
  - **Just this time** → `this` + `occurrenceKey`
  - **This and future** → `this_and_future` + `occurrenceKey`
  - **Every time** → `all`
- Default the control to **Just this time**. Today's silent default is the bug.
- Remove the faint line at ~711–715 ("Saving updates every occurrence of this activity."). That sentence is the lie.
- Delete of a recurring series: replace `confirm("Delete this activity?")` with the same three scopes. Wire `?editScope=` + `occurrenceKey` as the DELETE route already expects (`src/app/api/v1/activities/[id]/route.ts:209–231`). Default delete scope is `this`.
- If `this` / `this_and_future` is chosen and `occurrenceKey` is missing: do not save; setError asking to reopen from the day view. Do not silently fall back to `all`.
- Scope `this` must not send `rrule` (master-only). If the user changes the repeat chips while scope is `this`, move the scope control to **This and future** visibly.
- Keep `If-Match`. Keep the existing 409 copy.

Server already implements the three scopes (`src/server/services/recurrence.ts`, route tests). Do not reimplement the split.

**Tests to add** (fail first, then implement):

- Source pin: `ActivityEditor.tsx` no longer contains a naked `editScope: "all"` on the recurring path. A one-off may still send `all`.
- Source pin: `this_and_future` appears in `ActivityEditor.tsx`.
- Component or e2e: open a daily series from Today with an occurrence key, save "Just this time", request body is `editScope: "this"` + that key; sibling days unchanged.
- E2E: "This and future" calls the route with that scope (body or a mocked fetch) and does not send `editScope: "all"`.
- E2E: delete "Just this time" hits `DELETE ...?editScope=this&occurrenceKey=`.

Reuse `src/app/api/v1/activities/[id]/route.test.ts` and `src/server/services/recurrence.test.ts` — do not duplicate DST/split cases.

### Step 4 — planning-zone clock

Replace `new Date().getHours()` at:

| File | Lines | How |
|---|---|---|
| `ActivityEditor.tsx` | 606, 614 | Already has `tz` state from `/api/v1/settings`. Use `dateToMinutesFromMidnight(new Date(), tz)`. |
| `AnytimeRail.tsx` | 53 | Already receives `zone`. Same helper. If `zone` is empty (signed-out demo), keep local clock. |
| `CurrentActivityRing.tsx` | 36, 39 | Prefer the existing `nowMin` prop. Callers that have a live now-line must pass it. Fallback: accept an optional `zone` and use the helper; if neither, local clock. |
| `DailyBrief.tsx` | 36, 61 | Take `zone` from `today/page.tsx` (already in scope). |
| `PeakFocusNudge.tsx` | 58 | Same. |

**Leave** `LiveNowLine.tsx:20` `nowMinutesLocal()` as the documented fallback when `zone` is empty (signed-out demo). That is not a bug.

**Leave** `e2e/calibration-hint.spec.ts:21` — test code.

Do **not** add `?nowMin=`. For e2e that needs a frozen "now":

```ts
await page.clock.install({ time: new Date("2026-08-13T14:00:00") });
```

If a human QA hook is truly needed to force DailyBrief/DayRituals windows, follow the existing convention **exactly**:

```ts
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  const p = new URLSearchParams(window.location.search).get("timeDebug");
  // parse HH:MM → minutes; ignore otherwise
}
```

Same guard as `DayRituals.tsx:72–78` (`ritualDebug`) and `TodayTimeline.tsx:54–62` (`calibrationDebug`). On `time.neima.me` the param is inert even if present. Do not read it in Server Components. Do not document it on a user-facing surface.

**Test:** a unit test that `dateToMinutesFromMidnight` at a UTC instant in `Pacific/Auckland` is not `getHours()` of that Date in a CI `UTC` or `America/*` zone. Source pin: the five files above contain no `getHours(` after Slice 1.

### Step 5 — AppShell navigation

**Modify** `src/components/AppShell.tsx:96`.

```ts
// today: window.location.href = route;
router.push(route);
```

Use the existing `useRouter` from `next/navigation` (add the hook if the file is a client component — it already is: it uses `window`). Do not reload the world for `t` / `i` / `w` / `f` / `s` / `g` / `n`.

**Leave** `SettingsClient.tsx:629` `window.location.href = "/"` after account deletion / sign-out. That reload is the point (session cookie gone; client stores must die).

**Test:** source pin that `AppShell.tsx` does not contain `window.location.href`. Keyboard e2e: from `/app/today`, press `i`, URL is `/app/inbox` without a full document reload (Playwright `page.evaluate(() => performance.navigation.type)` is unreliable under SPA — assert no `requestfinished` for the Next document, or simply that the inbox heading appears and `performance.getEntriesByType('navigation').length` stays 1 if you captured it at start). A source pin plus a heading assertion is enough.

### Step 6 — stale CSP doc

**Modify** `docs/DEPLOYMENT.md:301`. State the truth:

- App sends enforcing `Content-Security-Policy` (not Report-Only), via `src/proxy.ts`.
- Current `script-src` is `'self' 'unsafe-inline'`.
- ADR-005 still wants this tightened; that is Track A item A9, not done.

Do not change `src/proxy.ts` in Slice 1.

### Slice 1 verification (exact)

```bash
# 1. Source pins / unit
pnpm test -- src/app/api/v1/activities/\[id\]/route.test.ts \
  src/server/services/recurrence.test.ts \
  src/lib/adapters-series.test.ts

# 2. Full gates (REQUIRED before commit)
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# 3. E2E against the running :3456 server
pnpm test:e2e

# 4. Parity must not move
node scripts/parity.mjs
# expect: Web 89.74% / iOS 86.93%  (or higher; never lower)
```

Browser (agent-browser or Playwright), authenticated if `.env.local` allows, otherwise the signed-out editor is the wrong surface — use a local user:

- Desktop 1440 and mobile 390, **light and dark**.
- Recurring activity: scope control visible; default is not "Every time".
- Save "Just this time" does not rewrite tomorrow's occurrence (reload Tomorrow).
- Keyboard `i` / `t` still navigate.
- Today now-line still sane after the clock change.

Dump shots to `browser-qa/slice-1/` (git-ignored).

### Slice 1 done when

- [ ] Recurring save/delete cannot fire `editScope=all` without an explicit "Every time" choice.
- [ ] `occurrenceKey` travels Today → editor → PATCH/DELETE for `this` and `this_and_future`.
- [ ] No production `getHours()` except `LiveNowLine` fallback and e2e.
- [ ] AppShell shortcuts do not assign `window.location.href`.
- [ ] `DEPLOYMENT.md` no longer claims Report-Only.
- [ ] Gates green. Parity unchanged. Live SHA on `https://time.neima.me` shows the scope control on a recurring edit (or a truthful "not live-verified because …" if deploy is blocked).
- [ ] `progress.md` appended. 7B/8B still unchecked.

---

## Files an executor will touch after Slice 1 (map, not a hunt)

| Later item | Create | Modify |
|---|---|---|
| A2 iOS scopes | — | `ios/App/Features/Today/EditorSheet.swift`, `ios/App/API/KairoAPI.swift` (~647 default `.all`), matching unit tests |
| A3–A5 Phase 2 | `drizzle/0010_today_helpers.sql` (shipped on `feat/quiet-today`; 6.2 stacks on it as 0011), e2e `e2e/today-helpers.spec.ts` | `src/server/db/schema.ts`, `src/server/schemas/user-settings.ts`, `api/openapi.yaml` (+ `pnpm api:sync-ios`), `src/app/app/today/page.tsx`, `src/components/SettingsClient.tsx`, `src/app/app/stats/page.tsx` / inbox / review as destinations |
| A7 DAL split | `src/server/dal/{tasks,activities,routines,taxonomy,settings,events}.ts` (names flexible; group by the existing section comments) | `src/server/dal/index.ts` becomes re-exports. **Do not change** import lines in `isolation.test.ts` / `cascade.test.ts`. |
| ~~A8 error reports~~ | **DONE** — `drizzle/0011_client_error_reports.sql` (stacked after 4.3's 0010), `src/app/api/v1/client-errors/route.ts`, `src/server/redact.ts`, `src/server/dal/client-error-reports.ts`. Branch `feat/client-error-sink`, not yet merged/deployed (B6 pg_dump gate). | schema, OpenAPI, privacy deletion cascade, rate limit — all shipped. |

---

## Parity contract

`node scripts/parity.mjs` is a gate on every commit in this program.

**Floor:** web **89.74**, iOS **86.93**. If a change would print below either number, **do not commit**. Revert the checklist edit and the code that forced it.

| Surface | Parity row | Rule |
|---|---|---|
| SoftStreaks | **K01** Planning streaks — credit 1, evidence cites `src/components/SoftStreaks.tsx` | Relocating to Stats (still shipped, still reachable) → **keep credit 1**, update the evidence sentence. Deleting the component → credit 0, web falls below the floor → **forbidden**. |
| PickForMe | no row | Already mounted on Inbox (`InboxClient.tsx:344`). Moving it off Today does not touch the script. |
| DailyBrief | no row | Kairo-original. Relocate, don't delete. |
| PeakFocusNudge | no row | Peak hour already lives in Stats / insights. Relocate. |
| DayRituals | no row | Evening carry already overlaps Review. Relocate the morning start, don't delete the file. |
| Recurrence scopes | **B12** already credit 1 | Slice 1 makes the web editor match the evidence sentence ("edit scopes"). Do not bump the number. |
| Games | various Play rows | Do not add or remove games. |

If you are unsure whether a relocate needs a checklist sentence update: update the sentence, rerun the script, confirm the percentages did not drop.

---

## Migration contract

Two schema adds exist in this program. Neither is Slice 1.

Coolify is a **single container**. `src/server/db/migrate-on-startup.ts` still runs per Node worker. That is fine:

- Module-level promise serializes inside one process.
- `pg_advisory_lock(hashtextextended('kairo-schema-migrations', 0))` serializes across workers/processes.
- `__migrations` records applied files.
- Partial applies skip `already exists` and then insert the filename.
- `migrate-on-startup.integration.test.ts` already fires **eight concurrent** `runMigrationsForUrl` calls at one database.

**Ruling:** additive `CREATE TABLE` / `ADD COLUMN … NOT NULL DEFAULT` is safe for this deploy topology. Do not disable the runner. Do not add a second migration path. One expand deploy at a time (never 4.3 and 6.2 in the same SHA).

Track B **B6** (`pg_dump`) runs before the SHA that contains the migration is deployed to prod. The agent prepares the SHA and waits.

### 4.3 — `today_helpers` (typed column, not jsonb)

v1 parked a "prefs column" under Phase 4. v2 moves it next to Phase 2 — that is what it is for. ADR-001: core settings are typed columns. Do not stuff this into `notification_prefs`.

```sql
-- drizzle/0010_today_helpers.sql
ALTER TABLE "user_settings"
  ADD COLUMN "today_helpers" boolean NOT NULL DEFAULT true;
```

- Default **true** = today's furniture stays. Shipping this migration + the Settings toggle is **not** a visual change.
- Zod + OpenAPI + iOS generated client + `updateSettings` / `getOrCreateSettings` all grow the field in the same SHA (ADR-002).
- Settings copy: **Show helpers on Today** — on by default. Off hides the five surfaces listed in Phase 2.

**Rollback:** stop reading the column (code revert). Column may remain (`DEFAULT true` is harmless). Do **not** `DROP COLUMN` in a panic deploy. Contract drop is a later unused-column cleanup, not a hotfix.

**Expand/contract:** this is expand-only. No backfill. No contract step required.

### 6.2 — `client_error_reports`

**Shipped as `drizzle/0011_client_error_reports.sql`** (branch `feat/client-error-sink`, stacked on `feat/quiet-today`,
not yet merged to main): A3–A5 (4.3 `today_helpers`) had not landed when A8 ran, so
The branch stacks on feat/quiet-today, whose 0010_today_helpers.sql takes the next free number (per this section's own
"next free number if 0010 is taken" caveat, read the other way: 0010 was free).
**Merge order is fixed: feat/quiet-today (0010) first, then feat/client-error-sink (0011)** —
check `drizzle/` for the actual latest file before assuming either number.

```sql
-- drizzle/0011_client_error_reports.sql
CREATE TABLE "client_error_reports" (
  "id" uuid PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "message" text NOT NULL,
  "stack" text,
  "path" text,
  "release" text
);
CREATE INDEX "client_error_reports_user_id_created_at_idx"
  ON "client_error_reports" ("user_id", "created_at");
```

- DAL insert scopes by session `user_id`. Ignore any client-supplied owner.
- Rate limit (SEC-06) on the route. Cap `message`/`stack` length in zod.
- Redact `Authorization`, cookie, `set-cookie`, bearer, ICS URLs, magic-link tokens (SEC-03/05).
- Privacy deletion cascade must include this table (`src/server/services/privacy.ts`).
- Isolation test: Mallory cannot read Alice's rows (404/empty, not 403).

**Rollback:** stop writing (code revert). Table may stay empty. Drop later. Do not drop in the same hotfix as a bad writer.

**Do not deploy 6.2 in the same Coolify release as 4.3.**

---

## Phase 1 — Honest recurrence (Slice 1 ⊂ this phase)

Slice 1 ships the web editor. After that, still Track A:

- **A2.** iOS `EditorSheet.save` / `deleteEditing` must prompt the same three scopes. `KairoAPI.updateActivity` currently forces `.all` when `editScope == nil` (`ios/App/API/KairoAPI.swift` ~647). Default nil to a required explicit value from the sheet, or default to `.this` when an occurrence key exists. Pin with `KairoAPITransportTests`.
- Source pin: web `ActivityEditor` and iOS `EditorSheet` both contain `this_and_future`.

Do not "fix" iOS by sending `this` without a key.

---

## Phase 2 — Quiet Today (Track A, gated)

**Diagnosis stands.** Today is over-furnished. v2 does **not** allow a session to silently remove SoftStreaks / PickForMe / DailyBrief / DayRituals / PeakFocusNudge from the screen Neima uses daily.

### Required sequence

1. **Expand (4.3).** Ship `today_helpers boolean NOT NULL DEFAULT true` + Settings toggle. Today unchanged.
2. **Wire the flag.** When `today_helpers === false`, do not mount those five on `src/app/app/today/page.tsx`. Keep TimezoneNudge, LowBattery, DayLoadMeter, DayDoneRain, AnytimeRail, Review, day chrome.
3. **One-tap homes for every removed affordance** (hard acceptance, not prose). From `/app/today`, each primary action is reachable in **one** tap:

   | Removed from Today | One-tap destination | Why this counts |
   |---|---|---|
   | SoftStreaks | New header control **Rhythm** (or equivalent) → `/app/stats`, which mounts `<SoftStreaks>` | Stats is currently under More = two taps. That fails the test. Add the header control. |
   | PickForMe | Bottom **Inbox** tab (already mounts `<PickForMe>`) | One tap. |
   | DailyBrief | Existing header **Review** | One tap. Brief copy may move onto Review's empty/morning state; do not lose the greeting's information. |
   | DayRituals (evening carry) | Header **Review** | Review already carries leftovers. |
   | DayRituals (morning start) | Header **Review** or Focus, whichever already starts the day | Must still start the first block in one tap. |
   | PeakFocusNudge | Bottom **Focus** tab | One tap. Peak-hour insight stays on Stats. |

4. **Screenshot gate** before any default flip. Capture, into `browser-qa/phase-2/` (git-ignored):

   | | 390 | 1440 |
   |---|---|---|
   | Light, helpers ON (current) | required | required |
   | Light, helpers OFF (flag) | required | required |
   | Dark, helpers ON | required | required |
   | Dark, helpers OFF | required | required |

   Eight images. Authenticated Today. Same account, same day. Show them in the progress note (paths, not blobs). **Do not flip the default in the same commit as the first wiring.**

5. **One-commit revert path.** The default flip is its own commit: `today_helpers` default `true → false` (schema default + Settings default + any seed). Revert that commit and Today looks like today. Do not squash it into the wiring commit.

6. **Human look.** Stop after the eight shots. Neima flips the Settings toggle on live/staging himself. Only then A5.

### Hard acceptance tests (Playwright)

- `today_helpers=true`: all five still appear under the conditions they appear today (morning, authed, etc.). Use Playwright clock or the **localhost-only** `ritualDebug` / `timeDebug` hooks — not a production query param.
- `today_helpers=false`: none of the five mount on `/app/today` (assert absence of their distinctive accessible names / test ids). Add stable `data-testid`s if needed.
- `today_helpers=false`: from `/app/today`, one click reaches SoftStreaks (via Rhythm → Stats), PickForMe (Inbox), Review, Focus.
- Keyboard and skip-to-content still work. Now-line still scrolls into view (Round 87).

### Flag rules

- Production preview = Settings toggle (real column). That is how Neima sees it on `time.neima.me`.
- Localhost-only `?todayHelpers=off` is allowed as a QA shortcut, same hostname guard as `ritualDebug`. Inert in production. Do not tell users about it.
- Do not add `?nowMin=`.

---

## Phase 3 — Glanceable shell

Slice 1 already replaces `window.location.href` in AppShell.

Remaining, Track A, after Phase 2 default is decided:

- Do not add more header chips than Phase 2 just spent. Rhythm + Review + day switcher is the budget.
- Command palette and KeyboardShortcuts already `router.push`. Leave them.
- If Today still feels noisy with helpers ON, that is a flag conversation, not a new component.

---

## Phase 4 — Time that matches the plan (no schema)

Slice 1 owns the `getHours()` list. Phase 4 is the leftover correctness, still Track A:

- Any new "is it morning?" check uses `dateToMinutesFromMidnight(now, zone)` or `useLiveNowMin(true, zone)`.
- DayRituals already uses a live nowMin + `ritualDebug`. Pass planning-zone minutes in, not `getHours()`.
- `clientToday()` must stay zone-aware wherever it feeds a write (PeakFocusNudge's protect-peak already uses `detectTimezone()` — prefer the settings timezone when the user is authed).
- **No `?nowMin=`.** Playwright `page.clock` or localhost `timeDebug`.

v1's 4.3 prefs column now lives with Phase 2.

---

## Phase 5 — Auth capabilities (Track B)

Code is done. Live is `{"magicLink":false,"apple":false,"google":false}`.

An agent that opens `src/server/auth.ts` and "enables Google" without env is vandalizing the fail-closed contract.

**Agent action:** if asked to "do Phase 5", print Track B items B1–B4 and stop.

**Do not** tick 7B or 8B. `docs/plans/UNBLOCK-7B-8B.md` remains the human runbook.

---

## Phase 6 — Ops honesty (mixed)

### 6.1 Staging origin (Track B — B5)

`https://time-staging.neima.me/api/health` → HTTP 000 / TLS failure. Confirmed.

Agent: write the missing DNS/Coolify steps into `docs/DEPLOYMENT.md` if they are not already crisp. Do not claim staging works. Do not point a local preview at that host and call it staging.

### 6.2 Client error reports (Track A code, Track B apply)

See Migration contract. Ship code + `0011_*.sql` to main only after B6 dump. One expand deploy. Isolation + redaction tests mandatory.

### 6.3 DAL split (Track A) — barrel is the public surface

v1 acceptance "`rg '^export async function' src/server/dal/index.ts` is zero" is **kept**, and it means index.ts is re-exports only — **not** that the functions disappear.

`isolation.test.ts` and `cascade.test.ts` import by name from `./index`. Call sites import from `@/server/dal`. Both must keep compiling with **zero import-line edits** (re-pointing every route is out of scope and is how SEC-01 tests get accidentally skipped).

`index.ts` after the split looks like:

```ts
import "server-only";
export type { Db } from "./types";
export { ConflictError, NotFoundError } from "./errors";
export {
  listTasks, getTask, createTask, updateTask, deleteTask,
  listChecklistItems, scheduleTask,
} from "./tasks";
export { assertOwnedActivityReferences } from "./references";
export {
  listActivitySeries, getActivitySeries, createActivitySeries,
  deleteActivitySeries, listOccurrences, listUserOccurrences, upsertOccurrence,
} from "./activities";
export { listTags, createTag, getTag, updateTag, deleteTag, listCategories } from "./taxonomy";
export { getOrCreateSettings, updateSettings } from "./settings";
export { getChanges, appendChangeLog, appendPlannerEvent } from "./events";
export {
  listRoutines, getRoutine, createRoutine, updateRoutine, deleteRoutine,
  listRoutineSteps, listRoutineSchedules, createRoutineSchedule, updateRoutineSchedule,
} from "./routines";
```

Exact grouping can follow the section banners already in the file. **The exported names are the contract.** Adding or renaming a symbol is a different task.

Acceptance:

- `rg "^export async function" src/server/dal/index.ts` → 0 matches.
- `rg "^export class" src/server/dal/index.ts` → 0 matches (classes live in `errors.ts` and are re-exported).
- `pnpm test -- src/server/dal/isolation.test.ts src/server/dal/cascade.test.ts src/server/dal/dal.test.ts` green.
- `rg "from \"@/server/dal\""` call sites unchanged.
- No behavior change. No schema.

### 6.4 CSP doc (Slice 1)

Done in Slice 1. Tightening `unsafe-inline` is A9, later.

### 6.5 Live capabilities honesty

Already fail-closed. Agent does not "fix" live `google:false`.

### 6.6 Prod host / SSH (Track B — B6)

Anything that needs a shell on `cool.neima.me` or the Postgres box — dump, restore drill, reading prod logs, confirming disk — is B6. Agent writes the commands into the progress note and stops.

---

## Verification standard (every Track A ship)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- `pnpm test:e2e` against :3456.
- `node scripts/parity.mjs` ≥ 89.74 / 86.93.
- Real browser, 390 and 1440, light and dark, for any UI change. Phase 2 requires the eight-shot matrix before default flip.
- Live URL checked for deploys. Say what was not checked.
- iOS: if you touched Swift, `./scripts/ios-main-thread-gate.sh` and trust "Executed N tests".
- No Track B evidence fabricated.

---

## `progress.md` template (append, do not rewrite)

```md
## 2026-08-13 — Round 88 / Slice 1: honest edit, honest clock

- **Shipped:** …
- **SHA:** …
- **Migrations:** none
- **Tests added:** …
- **Evidence:** browser-qa/slice-1/… (git-ignored)
- **Live:** verified / not verified (why)
- **Parity:** web x% / iOS y% (must be ≥ 89.74 / 86.93)
- **Deviations:** …
- **Track B still blocked:** B1–B6 (unchanged)
- **Next:** A2 iOS editor scopes  |  or Phase 2 expand (4.3) if Slice 1 is live
```

---

## What an agent does on Monday morning

1. Read `AGENTS.md`, this plan, `docs/plans/progress.md`.
2. Write `docs/plans/2026-08-13-trust-glanceability.md` and `docs/plans/trust-glanceability-agent-prompt.md` if they are not already in the tree.
3. Execute **Slice 1** in the order above.
4. If Slice 1 is already shipped, execute the next **Track A** row that is not waiting on a human look (A2, or Phase 2 expand-only).
5. If the next row is Track B or "wait for Neima to see the eight shots": stop and say so.

Do not ask questions. Do not start a 19th game. Do not delete Today furniture in the same session as the first honest save.
