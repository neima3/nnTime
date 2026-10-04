# P3.2 feature readiness ledger — Task 3.2 capability audit

Starting ref: `65f28064b859593aaff4b8694435cb6400e0f68f` (`main` @ merge Round 95).
Branch: `cursor/task-3-2-capability-audit-a77e`.
Host: Linux cloud agent — **Swift / `plutil` / Xcode not available** (`native-contract` owns those gates).

Legend: **verified** = behavioral tests green on this host for the credited platform; **partial** = core path covered, gaps listed; **deferred** = honest P7 / not implemented; **n/a** = out of slice scope.

| Feature | Platform | Status | Behavioral tests / source | Blocker / gap |
|---|---|---|---|---|
| Calendar — ICS import + SSRF | web API | **verified** | `calendar.test.ts`, `calendar-ics-edge.test.ts`, `calendar-ics-temporal.test.ts`, `calendar-fetch-ssrf.test.ts` (redirect → private blocked) | — |
| Calendar — read-only imported blocks | web + DAL | **verified** | `shipping-idempotency.test.ts`, `recurrence.test.ts` (calendar series edit rejected), `activity-create.test.ts` | — |
| Calendar — Google OAuth sync, provider update/delete, revoke/disconnect | web + native | **deferred** | Settings UI copy only (`SettingsClient.tsx` ICS URL); no OAuth calendar routes in tree | P7 external provider proof; not a missing ICS path |
| Calendar — duplicate sync on re-import | web | **partial** | One-shot ICS POST creates new rows (`calendar/ics/route.ts`); no dedupe by UID yet | Re-import same feed duplicates — acceptable until live sync lands |
| AI — disabled provider | web API | **verified** | `ai-provider-behavior.test.ts` (503 without key); routes guard before quota | — |
| AI — quota / unavailable | web API | **verified** | `ai-quota.test.ts` | — |
| AI — malformed model output | web API | **verified** (this PR) | `ai-provider-behavior.test.ts` → 502 `bad_gateway`; `ai-schemas.test.ts` | — |
| AI — confirm-before-mutate | web UI | **verified** | `quick-capture-ai-accept-contract.test.ts`, `quick-capture-inbox-contract.test.ts`, `plan-day-accept-contract.test.ts` | — |
| AI — failed accept preserves input | web UI | **verified** | `quick-capture-ai-accept-contract.test.ts` (proposal cleared only on success) | — |
| Templates / routines | web + DAL | **verified** | `routine-bundle.test.ts`, `cascade.test.ts`, P2 e2e (`core-loop`, inbox-schedule) | iOS UI: `native-contract` |
| Stats / mood / review | web | **verified** | `stats.test.ts`, `stats-netting.test.ts`, `stats-client-empty-state.test.ts`, mood route tests, `review-window` + e2e review | — |
| Search — owned results + identity | web API | **verified** (this PR) | `search.test.ts`, `search/route.test.ts` (session-scoped DAL) | — |
| Search — navigation / empty / error | web + iOS | **partial** | Web ranking in `search.test.ts`; iOS `SearchView.swift` + transport tests in `KairoAPITransportTests` | Simulator UX not run on Linux |
| Search / deep link survives auth | web | **verified** | `auth-return.test.ts` includes `/app/search?q=…` | — |
| Preferences / onboarding isolation | web | **verified** | `prefs-bootstrap.test.ts`, `offline-account-boundary.test.ts`, `a11y-prefs.test.ts` | — |
| Games / rewards (20 games, no expansion) | web + iOS logic | **verified** | `games.test.ts`; iOS `PlayArcadeLogicTests` (Round 94–95) | Arcade UI keyboard/VO: macOS `native-contract` |

## Fixes landed in this slice (highest-severity gaps)

| Gap | Files | Test |
|---|---|---|
| ICS redirect could reach loopback after a public first hop | `calendar.ts` (existing SEC-04 loop) | `calendar-fetch-ssrf.test.ts` |
| Search API ownership not pinned at HTTP boundary | `search/route.ts` | `search/route.test.ts` |
| Malformed AI JSON/schema surfaced as opaque 500 | `map-ai-route-error.ts`, AI routes | `ai-provider-behavior.test.ts` |
| Auth return dropped search deep links (regression guard) | `auth-return.ts` (unchanged) | `auth-return.test.ts` + `/app/search?q=` |

## Explicit non-goals (per program)

- No P4 work, no new games, no GitHub Actions changes, no deploy, no secrets.
- Google/Apple live calendar OAuth proof → P7.
