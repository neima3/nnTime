# Round 24 — Brain-breaks arcade expansion + cross-platform game parity

**Goal:** grow the Play arcade from six web / three iOS games to **nine games
on both platforms**, with identical logic contracts, ADHD-appropriate framing
(personal bests only, no shame copy, reduced-stimulation-safe), token-only
design in light and dark, and full gates + deploy + live verification.

## Scope

1. **Web — three new games** in `src/components/games/` on pure logic in
   `src/lib/games.ts` (seeded-RNG unit tests):
   - **Focus Finder** (`number-hunt`): 5×5 Schulte grid, tap 1→25, timed to
     tenths of a second, wrong taps flash danger but only cost time.
   - **Memory Trail** (`memory-trail`): nine tiles, glowing path starts at 3
     steps and grows each clean run; best = longest completed trail.
   - **Color Clash** (`color-clash`): 12 Stroop rounds, ~1 in 4 congruent;
     tap the ink, not the word; best = clashes won.
2. **iOS — full parity (3 → 9 games).** Port Emoji Match, Grammar Snap,
   Spell Check (quiz banks transcribed to `QuizBank.swift`, topic-spread
   picker, tricky-ones practice + redemption in `QuizGameView`), plus the
   three new games. Shared pure logic in `PlayArcadeLogic.swift` mirrors
   `src/lib/games.ts`; `PlayArcadeLogicTests` pins both platforms to one
   contract. Cards gain personal-best chips; game chrome gains a subtitle
   and an accessible "Exit game" label.
3. **Evidence.** Web: Playwright captures desktop/mobile × light/dark with
   zero horizontal overflow, plus in-browser end-to-end plays of all three
   new games. iOS: deterministic `KairoRound24ArcadeTour` on the offline
   fixture, light + dark, screenshots retained under ignored
   `browser-qa/round24-brain-games/`.
4. **Ship.** Full web + iOS gates, two feature commits, push → CI + Coolify
   auto-deploy, live verification on https://time.neima.me.

## Non-goals

- No server/API/DB changes (games remain fully client-local by design).
- No parity-checklist changes: the arcade is a beyond-Tiimo extra; scripted
  parity stays web 89.74% / iOS 85.80%.
- Phase 7B/8B external blockers (production auth providers, physical-device
  proof, Google consent acceptance) are untouched.
