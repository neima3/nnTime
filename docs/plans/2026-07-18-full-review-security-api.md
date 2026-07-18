# Full review — Security / API

**Date:** 2026-07-18  
**Scope:** Auth, API routes, rate limiting, privacy, AI, SSRF, CSRF  
**Mode:** Read-only code review

## Summary

Kairo’s API layer generally follows SEC-01: handlers call `requireSession()`, DAL queries AND-scope by `userId`, and cross-user access returns 404. Highest real risks: incomplete SEC-04 SSRF on ICS import, batch self-fanout amplification, missing Origin/CSRF for `/api/v1` mutations, non-atomic optimistic concurrency (TOCTOU), and email verification off vs ADR-003. AI routes avoid server-side mutation authority; rate-limit helpers exist but are largely unwired.

## Issues

### Issue 1 — Severity: critical
- File: `src/server/services/calendar.ts:17-55`
- Description: `fetchIcs` does not implement ADR-005 SEC-04: no DNS → public-IP check; `redirect: "follow"` does not re-verify hops. Authenticated users can request internal addresses.
- Suggestion: Resolve hostname → IP(s); reject private/link-local/loopback/metadata; manual redirects (max 3) with re-check per hop.
- Status: open

### Issue 2 — Severity: high
- File: `src/app/api/v1/batch/route.ts:9-46`
- Description: Batch can nest `/api/v1/batch` itself → exponential fan-out. Self-HTTP with cookies. No batch-specific rate limit.
- Suggestion: Deny recursive batch; rate-limit; prefer in-process dispatch.
- Status: open

### Issue 3 — Severity: high
- File: `src/proxy.ts` (absence of Origin check)
- Description: No Origin/Sec-Fetch-Site for cookie-authenticated `/api/v1` mutations (ADR-003/005).
- Suggestion: Require trusted Origin or same-site Fetch-Metadata on mutations.
- Status: open

### Issue 4 — Severity: high
- File: `src/server/auth.ts:53-56`
- Description: `requireEmailVerification: false` while ADR-003 requires verification before first planner write.
- Suggestion: Gate planner writes until verified, or enable Better Auth verification.
- Status: open

### Issue 5 — Severity: high
- File: `src/server/dal/index.ts` (pattern)
- Description: Optimistic concurrency is check-then-act without `WHERE revision = $ifMatch`.
- Suggestion: Conditional UPDATE with revision in WHERE; empty → ConflictError.
- Status: open

### Issue 6 — Severity: medium
- File: rate limit middleware + AI routes
- Description: Fail-open on DB errors; `limitAI` only on breakdown; other AI routes use separate quota key; limitAPI/limitAuth unwired.
- Suggestion: Fail-closed for AI/auth/ICS; unify quota; wire limits.
- Status: open

### Issue 7 — Severity: medium
- File: AI plan-day/parse/group-priority catch blocks
- Description: Raw `e.message` leaked in 500 responses.
- Suggestion: Generic client message; log server-side only.
- Status: open

### Issue 8 — Severity: medium
- File: `idempotency_keys` schema only
- Description: ADR-002 Idempotency-Key table exists; handlers ignore header.
- Suggestion: Shared middleware: lookup/store 48h replay.
- Status: open

### Issue 9 — Severity: medium
- File: privacy export/delete
- Description: Incomplete export inventory; no rate limit; delete confirm header alone, no step-up.
- Suggestion: Document inventory; rate-limit; re-auth for delete.
- Status: open

### Issue 10 — Severity: medium
- File: `src/proxy.ts` CSP
- Description: Enforcing CSP with `script-src 'unsafe-inline'` vs ADR-005 SEC-09.
- Suggestion: Nonces/hashes; drop unsafe-inline when possible.
- Status: open

### Issue 11 — Severity: medium
- File: body size limit via Content-Length only
- Description: Chunked bodies may bypass 1MB guard.
- Suggestion: Enforce at reverse proxy + stream count.
- Status: open

### Issue 12 — Severity: medium
- File: task/activity zod schemas
- Description: Missing string max lengths; IANA TZ not validated.
- Suggestion: Cap title/notes; validate TZ via Intl.
- Status: open

### Issue 13 — Severity: medium
- File: `public/sw.js`
- Description: Caches navigation HTML (may include user-scoped content); no purge-on-logout.
- Suggestion: Network-only for authed app HTML; purge on logout.
- Status: open

### Issue 14 — Severity: medium
- File: focus session `activityOccurrenceId`
- Description: Accepted without ownership check; no FK.
- Suggestion: Verify occurrence belongs to userId before insert.
- Status: open

### Issue 15 — Severity: low
- File: `auth-session.ts`
- Description: All getSession errors → null/401, masking infra failures.
- Suggestion: 503 on auth/DB failure.
- Status: open

### Issue 16 — Severity: low
- File: ICS route error messages
- Description: Raw exception messages can aid SSRF probing.
- Suggestion: Generic client message.
- Status: open

### Issue 17 — Severity: low
- File: AI freeSlots lengths / taskId filtering
- Description: Soft prompt-injection boundary only (OK if no mutations).
- Suggestion: Cap freeSlots; filter returned taskIds to input set.
- Status: open

### Issue 18 — Severity: low
- File: some mutation responses
- Description: Missing `Cache-Control: private, no-store`.
- Suggestion: Set on all /api/v1 responses.
- Status: open

### Issue 19 — Severity: low
- File: health route
- Description: Discloses whether Anthropic key is configured.
- Suggestion: Omit third-party flags from public health.
- Status: open

### Issue 20 — Severity: nit
- File: auth-session tests
- Description: Placeholder tests only.
- Suggestion: Real authz integration tests.
- Status: open

## Strengths

- SEC-01 discipline on routes + DAL userId scoping
- If-Match required on many writes
- AI has no DB write authority
- Cookie defaults HttpOnly/SameSite=Lax/Secure in prod
- ICS partial hardening (protocol, timeout, size, rate limit)
- SW does not cache `/api/*`

## Priority fix order

1. ICS SSRF IP/redirect controls  
2. Batch denylist + rate limit  
3. Email verification gate  
4. Atomic If-Match updates  
5. Origin checks + account step-up  
6. AI quota/error hygiene + wire remaining rate limits  
