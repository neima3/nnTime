# Round 29 — Night Sky: a wind-down constellation trace (both platforms)

**Goal:** balance the arcade's moods — Slow down had two games to Sharp &
fast's five — with a genuinely calm, beautiful, zero-pressure surface.

## Scope

1. **Night Sky** (`night-sky`, both platforms): five small invented
   constellations (The Kite, The Little Cup, The River, The Door, The
   Fox) with normalized point sets shared verbatim between
   `src/lib/games.ts` and `ArcadeLogic`. Stars are tapped in order; lines
   draw as you go (SVG on web, `Path` on iOS). No timer, no score, no
   failure — the only number kept is a lifetime "skies traced" counter
   (`recordResult(..., "count")` on web; a new `PlayScores.recordCount`
   on iOS).
2. **Accessibility & calm:** 44pt star targets with lit/next state in
   their labels; the next-star pulse is motion-safe on web and minimal on
   iOS; tokens only, and dark mode reads as an actual night sky.

## Non-goals

No server surface, no parity-checklist rows, blockers untouched.
