# Review Wave 2 — Hardening (post Wave 1)

> Execute after Wave 1 is green. Larger / riskier changes.

**Goal:** Close ADR-002 concurrency/sync holes and ADR-004 materializer so multi-device + recurrence are trustworthy.

## Tasks (summary)

### A. Atomic optimistic concurrency (DAL) — DONE
- Every UPDATE/DELETE: `WHERE id AND user_id AND revision = $ifMatch RETURNING *`
- Zero rows → re-read → ConflictError
- Apply to tasks, series, tags, routines, settings, focus
- Concurrent double-PATCH test

### B. change_log transactional — DONE
- Append log inside same transaction as entity write
- Fail mutation if log fails

### C. Routine materializer ADR-004 — DONE
- Unique identity for materialization (source_ref + occurrence_key)
- Advance `nextRunAt` past last materialized
- Wall fields in schedule TZ not UTC
- Double-run zero-duplicate test
- Wire cron/tick route + health lag (or document Coolify schedule)

### D. Idempotency-Key middleware — DONE
- Lookup `(userId, key)` → replay within 48h
- Store response on first success
- Wire POST creates (tasks + activities)

### E. OpenAPI ↔ handler inventory test — DONE
- Fail CI if OpenAPI path has no route or route has no OpenAPI (with allowlist for intentional private routes)
- Deferred paths allowlisted with comments

### F. Batch hardening — DONE (partial)
- Nested denylist + rate limit + path normalize (full in-process dispatch deferred)

### G. Client editScope UX — DONE
- Drag/review tomorrow use `this` + occurrenceKey
- Client “today” via planning zone helper
- Week/month RRULE expand

### H. Deploy / test honesty — DONE
- DEPLOYMENT gates: `lint && typecheck && test && build`
- `itDb` skip visibly when Postgres unavailable
- migrate-on-startup: track failure; health 503
- Origin/CSRF on `/api/v1` mutations

## Success criteria

- Concurrent PATCH same revision → one 409 ✅
- Double materializer run → zero duplicate series ✅
- Idempotent POST twice with same key → same resource ✅ (store wired)
- OpenAPI inventory green ✅
- Full gate green ✅ (155 tests)
