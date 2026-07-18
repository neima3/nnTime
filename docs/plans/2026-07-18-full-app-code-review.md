# Full app code review — Kairo (nnTime)

**Date:** 2026-07-18  
**Mode:** Complete static review via 4 domain agents (security/API, DAL/services, UI/client, contracts/iOS)  
**Working tree at review start:** clean (`main`)

## Domain reports

| Domain | Report |
|--------|--------|
| Security / API | `docs/plans/2026-07-18-full-review-security-api.md` |
| DAL / services / temporal | `docs/plans/2026-07-18-full-review-dal-services.md` |
| UI / client | `docs/plans/2026-07-18-full-review-ui-client.md` |
| Contracts / iOS / deploy | `docs/plans/2026-07-18-full-review-contracts-ios.md` |

## Executive summary

The product has a **strong skeleton**: design-token discipline, SEC-01 user scoping in the DAL, If-Match on many writes, real focus state machine, temporal/DST tests, and AI routes that do not mutate data. It is **not yet safe as a multi-device offline planner or a recurrence-primary daily driver**.

Production risk clusters in:

1. **Correctness** — day view never expands RRULEs; focus pause math inverted; checklist toggles rewrite the series template for all future days; routine materializer cannot meet ADR-004.
2. **Security** — ICS SSRF incomplete (SEC-04); batch can self-fanout; email verification off vs ADR-003; CSP still allows `unsafe-inline`.
3. **Sync/API contract** — Idempotency-Key schema-only; OpenAPI ↔ handlers drift; batch uses self-HTTP; `409 retryable: true` is wrong; lists omit `nextCursor`.
4. **Ops** — migrate-on-startup can mark failure as success; ADR-004 worker never scheduled; deploy gates skip `typecheck`/`test`; DB tests soft-skip without Postgres.

## Critical / high findings (actionable)

| Sev | Area | Finding |
|-----|------|---------|
| critical | Day | `getResolvedDay` filters by series `dtstartLocal` only — no `expandSeries` |
| critical | Focus | Pause adds *running* time to `accumulatedPauseSec`; remaining decays while paused |
| critical | UI | Checklist toggle uses `editScope: "all"` + template `done` flags |
| critical | Security | ICS fetch: no public-IP / redirect re-verify |
| critical | Contract | Idempotency-Key not implemented |
| high | UI | Drag/editor/review “tomorrow” always `editScope: "all"` |
| high | UI | Live now-line uses browser local TZ, not planning zone |
| high | DAL | Optimistic concurrency is TOCTOU (no `WHERE revision = ?`) |
| high | DAL | Routine materializer: no dedupe, `nextRunAt` never advances |
| high | DAL | `change_log` non-transactional / best-effort |
| high | API | Batch nested fan-out + self-HTTP |
| high | Auth | `requireEmailVerification: false` |
| high | Ops | ADR-004 materializer/notification tick never scheduled |

## Strengths

- Design tokens honored in components; Soft Focus system intact
- DAL `userId` scoping + NotFound for cross-user (when DB tests run)
- Zone/DST math and RRULE expand unit tests exist
- Focus partial unique index; AI suggestion-only
- Cookie defaults HttpOnly / SameSite=Lax / Secure in prod

## Fix waves (plans)

| Wave | Plan | Goal |
|------|------|------|
| **1** | `docs/superpowers/plans/2026-07-18-review-wave1-critical-fixes.md` | Ship critical correctness + security quick-wins with tests |
| **2** | `docs/superpowers/plans/2026-07-18-review-wave2-hard-hardening.md` | Atomic revisions, materializer, idempotency, OpenAPI inventory |
| **3** | (later) | Origin/CSRF, email verification product decision, ADR-004 cron, iOS |

Wave 1 is executed in this session. Wave 2 is planned for the next session.
