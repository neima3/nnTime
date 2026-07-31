# Round 25 — Arcade wave 5: Odd One Out, Digit Span, sectioned Play

**Goal:** grow the arcade from nine to **eleven games on both platforms**
and restructure the Play surface into four labeled moods now that the list
is long: Sharp & fast, Hold it in mind, Wordplay, Slow down.

## Scope

1. **Odd One Out** (`odd-one-out`, both platforms): one near-twin emoji
   impostor hides in a grid that grows 3×3 → 4×4 → 5×5 across eight
   rounds; overall time in tenths is the only score (lower better); wrong
   taps flash danger and cost time, never points.
2. **Digit Span** (`digit-span`, both platforms): classic working-memory
   span. Digits flash (900ms + 350ms/digit), an on-screen keypad takes
   them back, each clean recall adds one digit; best = longest recalled
   span. No immediate-repeat digits for glanceability.
3. **Sectioned arcade**: four mood sections with header + blurb on web
   (`<section>`/h2, cards h3) and iOS (combined accessible header trait).
4. Pure logic in `src/lib/games.ts` mirrored by `ArcadeLogic` with
   seeded-RNG tests on both sides; evidence tours extended.

## Non-goals

Same as Round 24: no server surface, no parity-checklist change (still
web 89.74% / iOS 85.80%), external auth blockers untouched.
