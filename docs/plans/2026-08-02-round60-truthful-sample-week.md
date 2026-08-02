# Round 60 Truthful Sample Week Plan

**Goal:** Make the signed-out Week preview unmistakably a demonstration and
remove navigation that falsely claims the fixed fixture is the visitor's
current week, while preserving authenticated dates and controls.

**Decision:** Keep the deterministic seven-day fixture because it demonstrates
Kairo's planner density and category system reliably. On the signed-out path
only, frame it as **Sample planner / A week with Kairo**, describe its count as
sample activities, and replace previous/current/next navigation with a static
**Sample week** badge. Authenticated Week retains its real zoned range,
highlighted current day, and complete week navigation.

## Test-first implementation

- [x] Add a signed-out browser contract for truthful sample copy and absence of
  real-week navigation.
- [x] Run the focused browser test and verify it fails on the current behavior.
- [x] Add an explicit preview/authenticated result contract to Week loading and
  change only signed-out header/navigation copy.
- [x] Run the focused browser test and core code gates.
- [x] Verify production-mode desktop/mobile visuals and complete an independent
  code review.
- [x] Update roadmap/progress, run every required gate, commit, push, pass
  exact-SHA CI, deploy, and verify the live route.

## Standing boundaries

- Production verification is signed-out and read-only.
- The deterministic sample activities and their editor/auth continuation links
  remain unchanged.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
