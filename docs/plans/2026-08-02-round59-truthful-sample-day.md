# Round 59 Truthful Sample Day Plan

**Goal:** Make the signed-out Today preview unmistakably a demonstration rather
than a stale real calendar day, while preserving the deterministic fixture and
all authenticated date behavior.

**Decision:** Keep the fixture deterministic for visual and browser contracts.
Do not substitute the server's timezone for the visitor's calendar date. On the
signed-out path only, replace the calendar-looking `Saturday / July 12` heading
with the explicit `Sample planner / A day with Kairo` label. Authenticated days
continue to use their real zoned weekday and date.

## Test-first implementation

- [x] Add an anonymous browser assertion that signed-out Today identifies the
  sample and does not render the stale July 12 heading.
- [x] Run the focused browser test and verify it fails on production behavior.
- [x] Update only the signed-out mock-day copy; do not alter activity fixture
  times, completion state, auth boundaries, or authenticated day formatting.
- [x] Run focused browser verification, unit/type gates, and desktop/mobile
  production-mode visual QA.
- [x] Run the full project gates and independent review, then update roadmap and
  progress ledgers.
- [x] Commit, push, wait for exact-SHA CI, deploy, and verify the live heading.

## Standing boundaries

- Production verification remains read-only.
- Phase 7B device/provider lifecycle evidence and Phase 8B Google activation
  remain external and are not redefined by this tranche.
