# Round 61 Truthful Sample Month Plan

**Goal:** Make signed-out Month explicitly a demonstration instead of pairing a
fictional July fixture with the visitor's real month/year and today semantics.

**Decision:** Keep the deterministic 31-day density fixture because it reliably
demonstrates Kairo's category overview. On the signed-out path only, frame it as
**Sample planner / A month with Kairo** and replace previous/current/next month
navigation—which relabels but does not change the fixture—with a static
**Sample month** badge. Authenticated Month retains its real zoned calendar,
today highlight, empty state, and complete month navigation.

## Test-first implementation

- [x] Add a signed-out browser contract for truthful sample copy and absence of
  real-month navigation.
- [x] Run the focused browser test and verify it fails on current behavior.
- [x] Consume Month's existing authenticated result contract and change only
  the signed-out header/navigation framing.
- [x] Run focused browser tests and core code gates.
- [x] Verify production-mode desktop/mobile visuals and complete independent
  review.
- [ ] Update roadmap/progress, run all required gates, commit, push, pass
  exact-SHA CI, deploy, and verify the live route.

## Standing boundaries

- Production verification is signed-out and read-only.
- The deterministic sample density fixture and authenticated calendar query
  behavior remain unchanged.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
