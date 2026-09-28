# Round 95 — Arcade: two new games, a lighter hub, today's three remembered

Brief: "add and improve the games and continue developing and improving this
app like a 10x developer. commit/push/deploy and merge".

## Audit first (browser-qa/r95/audit, git-ignored)
All 18 games opened and played a step at 390×844 and 1440×900 — no runtime
errors, no broken states. What was actually wrong was around them:
- Phone hub was **4,754 px** tall — 18 full cards, one column.
- "Today's three" never acknowledged that you'd played any of them.
- Moods were lopsided for choosing: Slow down had 3 games.

## Shipped (web + native, logic mirrored and pinned on both sides)
| # | Change | Where |
|---|---|---|
| 1 | **Arrow Rush** (🏹, Sharp & fast) — flanker task, 20 rounds, balanced congruent/incongruent, 1.8 s window; best = right answers /20; end names the "decoy cost" (mean incongruent − congruent ms). ← → keys on web | `games.ts` `buildArrowRun/arrowRow/arrowSummary`, `ArrowRush.tsx`, `ArrowRushGame.swift` |
| 2 | **Slide Home** (🏡, Slow down) — untimed 3×3 sliding puzzle; tiles tinted by home row so solving paints three bands; every board has a par (IDA* shortest path) kept in 12–20; best = moves over par (fair across boards); arrow keys on web | `shuffleSlide/buildSlideBoard/slideShortest…`, `SlideHome.tsx`, `SlideHomeGame.swift` |
| 3 | Played-today log (`kairo-play-log`, one day kept): Today's three shows ✓ "played today" and "N of 3 played" | `recordPlay/playedOn` (web, via `recordResult`), `PlayLog` (iOS, via `PlayScores.record*` + Steady Breath finish) |
| 4 | Phone hub: compact rows (art · title · 2-line hook · best) instead of full cards — 4,754 → 2,945 px with two more games | `PlayClient.tsx` |
| 5 | MOOD_GAMES + daily-three pins updated on both platforms (new pins for 2026-08-03/04, 2026-09-28) | `games.test.ts`, `PlayArcadeLogicTests.swift` |

Found in QA and fixed: the solved Slide Home board used a success-green
backdrop that swallowed the mint bottom row in dark mode (tiles 7–8 looked
missing) → neutral well + success border/ring.

## Not done
- Clay tiles `tile-arrow-rush` / `tile-slide-home` — generating them spends
  Higgsfield credits; cards use the emoji fallback (by design in
  `GameArt`). Regenerate per `docs/design/illustrations.md` when approved.
