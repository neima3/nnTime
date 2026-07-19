# 10× ADHD Program — Wave 3: Play (2026-07-19)

**Goal:** give Kairo a playful heart — a "Brain breaks" arcade of quick,
honest mini-games (no brain-training overclaims, no doomscroll traps) plus
delight details that make the app feel alive. The time-estimation game is the
signature: it turns Kairo's core enemy (time blindness) into play. Research:
`docs/research/adhd-brain-games-2026.md` + prior ADHD research docs.

## Progress tracker
- [x] Phase 1: Research brain games + engagement mechanics (subagent)
- [x] Phase 2: /app/play arcade hub (DESIGN-SENSITIVE)
- [x] Phase 3: Game — Time Feel (time-estimation; the signature)
- [x] Phase 4: Game — Quick Tap (reaction time)
- [x] Phase 5: Game — Emoji Match (memory pairs)
- [x] Phase 6: Game — Steady Breath (box breathing, the calm one)
- [x] Phase 7: Break + app integration (focus break → play; More menu; nav)
- [x] Phase 8: Delight details — day-complete emoji rain + playful 404
- [x] Phase 9: Stats tie-in ("Brain breaks" card) + game logic unit tests
- [x] Phase 10: QA sweep, gates, ship, live verify

## Ground rules for all games
- Client-only (localStorage bests; no server surface, no accounts pressure).
- Sessions ≤ 2 minutes with a natural stop ("nice, back to your day?") —
  never infinite play, no streaks, no leaderboards; personal-best framing.
- Copy: "brain breaks", fun + honest — never "training"/"treatment".
- Tokens only; reduced-motion/reduced-stimulation respected; keyboard playable.
- Shared `GameShell` chrome: title, how-to line, best-score chip, exit,
  end-state with [Again] [Back to my day].

## Phase 2 — /app/play hub
Arcade grid of 4 game cards (pastel tiles, emoji, one-line hooks, personal
best shown when present) + a gentle header ("Five minutes of play counts as
rest."). Route registered in More menu + `g` shortcut. Evidence: screenshots
light/dark/mobile.

## Phase 3 — Time Feel (signature)
"Your brain vs the clock": press start → hold nothing → tap when you think
N seconds passed (N ∈ {5, 8, 12, 20} rounds, research-style reproduction
task). Per-round feedback ("you felt 12s as 9.4s — fast brain"), final
score = mean |error|% with kind framing + best. A quiet line ties to the
product: "This is the skill Kairo's timeline does for you."

## Phase 4 — Quick Tap
Wait for the tile to turn iris → tap fast. 5 rounds, early-tap caught
("jumped the gun — happens"), avg ms + best. Keyboard: space.

## Phase 5 — Emoji Match
4×4 pairs of category emoji; move count + time; best moves. Flip animation
(reduced-motion: instant).

## Phase 6 — Steady Breath
Box breathing 4-4-4-4, animated square + expanding ring, 4 cycles (~64 s),
haptic-free, with "longer" option (8 cycles). End: "steadier. back to it?"

## Phase 7 — Integration
Focus break state gets "or play a brain break →" link; break-over state
too. More menu tile ("Play — brain breaks between things"). Shortcut `g`.
NowBar untouched.

## Phase 8 — Delight
1. Day-complete moment: the first time a day hits all-done (per-day
   localStorage), a 2 s emoji-confetti rain (existing celebrate() burst ×
   several origins) over the banner. Reduced-motion/stim: skip.
2. `not-found.tsx`: playful on-brand 404 ("This page wandered off the
   timeline") with a link home + the ◔ mark.

## Phase 9 — Stats + tests
Stats "Brain breaks" card reading localStorage bests (time-feel best %,
quick-tap best ms, matches best moves, breaths taken count) — client-only,
hidden when empty. Unit tests for pure game logic (time-feel scoring, match
deck shuffle validity, reaction scoring) — cheap-subagent friendly.

## Phase 10 — Ship
Full gates, roadmap/progress updates, commit, push, Coolify deploy, live
verification of /app/play + one game E2E + 404 page.
