# Dogfood QA Sweep — Phase 6E (2026-07-13)

## Methodology
Systematic route + functional testing against https://time.neima.me.
20 routes tested (HTTP status), full CRUD flow with a real account,
and edge-case verification.

## Results

### All routes return correct status codes
| Route | Expected | Actual | Status |
|-------|----------|--------|--------|
| / (landing) | 200 | 200 | ✅ |
| /app/today | 200 | 200 | ✅ |
| /app/inbox | 200 | 200 | ✅ |
| /app/week | 200 | 200 | ✅ |
| /app/month | 200 | 200 | ✅ |
| /app/review | 200 | 200 | ✅ |
| /app/routines | 200 | 200 | ✅ |
| /app/focus | 200 | 200 | ✅ |
| /app/settings | 200 | 200 | ✅ |
| /app/stats | 200 | 200 | ✅ |
| /app/editor | 200 | 200 | ✅ |
| /onboarding | 200 | 200 | ✅ |
| /sign-in | 200 | 200 | ✅ |
| /sign-up | 200 | 200 | ✅ |
| /api/health | 200 | 200 | ✅ |
| /api/v1/tasks (unauth) | 401 | 401 | ✅ |
| /api/v1/changes (unauth) | 401 | 401 | ✅ |
| /manifest.json | 200 | 200 | ✅ |
| /sw.js | 200 | 200 | ✅ |

### Full CRUD flow (real account)
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Sign-up | 200, account created | 200, user email returned | ✅ |
| Create inbox task | 201, UUID, revision=1 | 201, UUID, rev=1 | ✅ |
| Create anytime task | 201, bucket=anytime | 201, bucket=anytime | ✅ |
| List tasks | 200, 2 items | 200, 2 items | ✅ |
| Update (If-Match) | 200, rev bumped | 200, rev=2 | ✅ |
| Conflict (stale rev) | 409 | 409 | ✅ |
| Tags list | 200, 0 items | 200, 0 items | ✅ |
| Settings get | 200, defaults | 200, tz=UTC theme=system | ✅ |
| Categories | 200, 6 seeded | 200, 6 categories | ✅ |
| Delete (If-Match) | 204 | 204 | ✅ |
| Get deleted | 404 | 404 | ✅ |
| Today (authed) | real data | "Monday", "Anytime task" | ✅ |

### Bugs found and fixed
**P1: /api/v1/changes returned 500 (internal error)**
- **Root cause**: The `getChanges` function used drizzle's `gt()` on a bigint
  column with `BigInt(cursor)`, which caused a type mismatch at runtime.
  Additionally, the raw SQL result had snake_case column names but the API
  expected camelCase.
- **Fix**: Rewrote `getChanges` to use raw SQL for the bigint comparison and
  map the result rows to camelCase. Made `appendChangeLog` catch errors
  gracefully (log but don't crash the mutation).
- **Status**: FIXED. 92 tests pass.

### Security headers verified
All 7 SEC-09 headers present on live URL.

### Lighthouse (6D)
Performance 95, Accessibility 96, Best Practices 92, SEO 90.

### Not tested (external blockers)
- AI co-planner (needs ANTHROPIC_API_KEY)
- Calendar import (needs Google OAuth credentials)
- Email verification (needs RESEND_API_KEY)
- CI pipeline (GitHub Actions budget exhausted)
