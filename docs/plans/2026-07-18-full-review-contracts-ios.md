# Full review — Contracts / iOS / deploy / tests

**Date:** 2026-07-18  
**Scope:** OpenAPI parity, iOS client, infra, ADR compliance, test quality  
**Mode:** Read-only code review

## Summary

Contracts look structured (OpenAPI 3.1, zod registry, DAL user-scoping, revision/If-Match), but ADR-002’s strongest guarantees are incomplete: Idempotency-Key is schema-only, contract-parity is name-only, many shipped `/api/v1/*` routes are outside OpenAPI while several OpenAPI paths have no handlers. iOS is a library scaffold, not a device-proven client. Batch uses self-HTTP; ICS SSRF partial; email verification off; DB tests silently no-op without Postgres.

## Issues

### 1. critical — Idempotency-Key not implemented
Table exists; no handler read/write/replay. Offline retries can double-create.

### 2. critical — OpenAPI path set ≠ real handlers
Spec-only: schedule task, checklist-items, occurrence-by-key, routine steps/schedules POST, categories PATCH.  
Handlers without OpenAPI: `/ai/*`, `/calendar/ics`, `/mood`, `/privacy/*`, `/stats`, `/tasks/import`.

### 3. high — Contract parity gate too weak
Name-only component checks; no path ↔ handler inventory.

### 4. high — Batch self-HTTP violates ADR-002

### 5. high — ICS SSRF incomplete (SEC-04)

### 6. high — iOS incomplete (sync stub, cursor type mismatch, no SIWA, tests instantiation-only)

### 7. high — Email verification off vs ADR-003

### 8. high — ADR-004 worker never scheduled (materializer/notifications exist, no cron)

### 9. medium — List responses omit `nextCursor`

### 10. medium — Day response schema drift

### 11. medium — 409 `retryable: true` (should be false for terminal conflict)

### 12. medium — CSP enforcing with unsafe-inline

### 13. medium — Migrate-on-startup swallows failure

### 14. medium — Parity ≥85% uses planned credit for iOS

### 15. medium — DB tests soft-skip without Postgres

### 16. medium — Deploy gates omit typecheck/test

### 17. low — Cookie/bearer gap for iOS

### 18. low — Dockerfile tracing includes incomplete

### 19. low — ESLint = Next defaults only

### 20. nit — Zod Error registry naming

## ADR compliance snapshot

| ADR | Reality |
|-----|---------|
| ADR-001 | Partial — day filter simplified; edit scopes partial |
| ADR-002 | High drift — idempotency, batch, nextCursor, OpenAPI |
| ADR-003 | Web auth yes; verification off; iOS stub |
| ADR-004 | Focus SM yes; worker never invoked |
| ADR-005 | SEC-01 strong; SEC-04 incomplete; CSP weak |

## Priority

1. Idempotency store  
2. OpenAPI ↔ handler inventory test  
3. Batch internal dispatch  
4. ICS SSRF  
5. Wire ADR-004 tick  
6. Fail tests when DB unavailable  
7. Deploy gates include typecheck + test  
