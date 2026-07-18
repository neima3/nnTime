# Review Wave 1 — Critical correctness + security quick-wins

> **For agentic workers:** Use subagent-driven-development. Checkbox steps. Frequent commits optional (orchestrator may batch).

**Goal:** Fix the worst user-facing correctness bugs and the highest-leverage security holes identified in the 2026-07-18 full-app review.

**Architecture:** Minimal, focused patches. Prefer pure functions + unit tests. Do not expand product scope (no full offline rewrite, no iOS).

**Tech Stack:** Next.js 16, TypeScript, Drizzle, Vitest, zod

---

### Task 1: Focus pause accounting + remaining freeze

**Files:**
- Modify: `src/server/services/focus.ts`
- Modify: `src/server/services/focus.test.ts`

**Bug:** On `running → paused`, code adds the *running* interval into `accumulatedPauseSec`. `getRemainingSec` always uses wall clock and keeps decaying while paused.

**Correct model:**
- `accumulatedPauseSec` = total completed pause duration only
- On pause: set `currentIntervalStartedAt = now` (pause start); do **not** change `accumulatedPauseSec`
- On resume: add `(now - currentIntervalStartedAt)` to `accumulatedPauseSec`; set `currentIntervalStartedAt = now`
- `getRemainingSec`: if `state === "paused"` and `currentIntervalStartedAt` set, freeze “now” at that pause start

- [x] **Step 1:** Add pure unit tests for `getRemainingSec` (running ~20m left after 5m; paused freezes; after resume pause time excluded)
- [x] **Step 2:** Fix `transitionFocusSession` pause/resume branches
- [x] **Step 3:** Fix `getRemainingSec`
- [x] **Step 4:** Run `pnpm test -- src/server/services/focus.test.ts`

---

### Task 2: ICS SSRF public-IP + manual redirects

**Files:**
- Modify: `src/server/services/calendar.ts`
- Modify: `src/server/services/calendar.test.ts`

**Requirements (ADR-005 SEC-04):**
- http/https only (already)
- Resolve hostname → address(es); reject loopback, link-local, private RFC1918, CGNAT 100.64/10, metadata 169.254.169.254, IPv6 ULA/link-local
- Manual redirects, max 3, re-verify host/IP each hop
- Keep 10s timeout + 5MB cap + structure checks
- Export `isPublicIp(ip: string): boolean` for unit tests (no live network required for IP classification tests)

- [x] **Step 1:** Implement `isPublicIp` + tests for blocked ranges
- [x] **Step 2:** Implement `fetchIcs` with `dns.promises.lookup` + manual redirect loop (`redirect: "manual"`)
- [x] **Step 3:** On blocked IP throw generic safe error message (no internal IP in client-facing string if possible)
- [x] **Step 4:** Run `pnpm test -- src/server/services/calendar.test.ts`

**Note:** In Node, after resolving IP you still need to prevent DNS rebinding on connect. Best-effort: resolve + reject private before fetch; document residual rebinding risk if fetch re-resolves. Prefer `lookup` option if available in undici.

---

### Task 3: Batch deny recursive fan-out + safer errors

**Files:**
- Modify: `src/app/api/v1/batch/route.ts`
- Modify: `src/server/api-errors.ts` (ConflictError retryable → false)

**Fixes:**
1. Reject any op whose path is exactly `/api/v1/batch` or starts with `/api/v1/batch?` (normalize: strip query, no trailing slash abuse)
2. Reject paths containing `//` or encoded `..`
3. ConflictError: `retryable: false` (ADR-002: 4xx terminal except 429)
4. Batch op catch: generic message, not `e.message`

- [x] **Step 1:** Apply denylist + path normalize
- [x] **Step 2:** Fix ConflictError retryable
- [x] **Step 3:** Extracted `isAllowedBatchPath` + `path.test.ts`

---

### Task 4: Day view expands RRULEs

**Files:**
- Modify: `src/server/services/day.ts`
- Modify: `src/lib/adapters.ts` (occurrenceKey + checklist override merge if needed)
- Modify: `src/app/app/today/page.tsx` (if status map shape changes)
- Create: `src/server/services/day.test.ts` (pure expansion helper preferred)

**Approach:**
1. Export a pure helper e.g. `expandSeriesForDay(series, bounds, zone)` that:
   - Extracts wall-clock fields from `dtstartLocal` in `series.tz` via `Intl` / zone helpers
   - Calls `expandSeries` from `src/server/temporal/recurrence.ts` over `[bounds.start, bounds.end)`
   - For one-off (`rrule` null), still produces the single occurrence if it overlaps the day
2. For each occurrence, merge override from `listUserOccurrences` keyed by `(seriesId, occurrenceKey.getTime())`
3. Return activities as series-shaped objects with:
   - `dtstartLocal` = occurrence `startAt` (or override startAt)
   - `durationMin` = override or series
   - `occurrenceKey` available for client
   - status/done from override
   - checklist from `checklistOverride` if present else template
4. Prefer returning richer activity DTOs rather than `occurrenceStatusBySeries` only by seriesId (seriesId alone collapses multi-instance)

- [x] **Step 1:** Write failing test: DAILY series with dtstart yesterday appears on today
- [x] **Step 2:** Implement expansion in `getResolvedDay`
- [x] **Step 3:** Wire today page adapter to use occurrenceKey + checklist override
- [x] **Step 4:** Run tests

**Export wallClock:** If `wallClock` in `zone.ts` is private, either export `instantToWallClockFields` or duplicate minimal Intl formatting in the day service.

---

### Task 5: Checklist toggle is occurrence-scoped (editScope this)

**Files:**
- Modify: `src/server/schemas/activity-series.ts` — add `checklistOverride` optional on update
- Modify: `src/components/TodayTimeline.tsx` — `handleToggleStep` uses `editScope: "this"`, `occurrenceKey`, `checklistOverride` (not series template)
- Optionally ReviewClient tomorrow: use safer scope if easy (else leave for Wave 2)

- [x] **Step 1:** Add `checklistOverride` to `activitySeriesUpdate` zod schema (same shape as occurrence schema)
- [x] **Step 2:** Client toggle: `editScope: "this"`, pass `occurrenceKey` from activity, body field `checklistOverride: [{label, done}]`
- [x] **Step 3:** Ensure complete already uses `this` (it does)

---

### Task 6: Live now-line uses planning zone

**Files:**
- Modify: `src/components/LiveNowLine.tsx`
- Modify: callers that use `useLiveNowMin` (TimelineCanvas / TodayTimeline / today page)

**Approach:**
- `useLiveNowMin(live, zone?: string)` — if zone provided, use `dateToMinutesFromMidnight(new Date(), zone)` from adapters (client-safe pure function already in `src/lib/adapters.ts`)
- Pass `zone` from today page through TimelineCanvas

- [x] **Step 1:** Update hook signature
- [x] **Step 2:** Thread `zone` from TodayTimeline/Canvas
- [x] **Step 3:** Smoke typecheck

---

### Task 7: AI route error hygiene (quick)

**Files:**
- `src/app/api/v1/ai/plan-day/route.ts`
- `src/app/api/v1/ai/parse/route.ts`
- `src/app/api/v1/ai/group-priority/route.ts`
- `src/app/api/v1/calendar/ics/route.ts` (generic ICS error if easy)

Replace catch blocks that return `e.message` with generic `"An unexpected error occurred"` / `"Unable to import calendar"`.

---

### Task 8: Gates

- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (145 tests)
- [x] Update `docs/plans/progress.md` with Wave 1 results
- [x] Wave 1 items fixed in code; domain reports retain full findings for Wave 2

---

## Out of scope for Wave 1

- Full atomic If-Match across entire DAL
- Routine materializer rewrite
- Idempotency-Key middleware
- OpenAPI path inventory CI
- Email verification product change
- Origin CSRF middleware
- Offline queue wiring from all mutations
