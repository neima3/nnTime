# Round 33 — Pattern Tiles: simultaneous spatial recall (both platforms)

**Goal:** give Hold it in mind its fourth resident with a mechanic the
arcade didn't have yet — simultaneous (not sequential) spatial memory,
Memory Trail's sibling.

## Scope

1. **Pattern Tiles** (`pattern-tiles`, both platforms): 3 tiles flash at
   once on a 4×4 grid (900ms + 250ms/tile), hide, and get tapped back in
   any order. Each clean recall grows the pattern by one up to the
   nine-tile cap; a miss kindly re-reveals the answer for a beat before
   the gentle end state. Best = largest pattern held.
2. **Shared contract:** `pickPatternTiles`/`patternShowMs` in
   `src/lib/games.ts` mirrored by `ArcadeLogic` with seeded pinning tests
   on both sides (distinctness, sorting, grid bounds, cap, timing).

## Non-goals

No server surface, no parity-checklist rows, blockers untouched.
