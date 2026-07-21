# Kairo — 20-Phase 10× Program (2026-07-20)

**Goal:** push both platforms toward "the ultimate ADHD app": bring the
web's beloved features to iOS (parity), pay down the real accessibility &
performance debts I explicitly deferred, and add genuinely useful new ADHD
capabilities — all verified with evidence, nothing cosmetic-only.

Grounding: web is mature (today/inbox/week/focus/play/routines/stats/review/
templates/planner + 4 ADHD waves). iOS has Auth/Today/Week/Inbox/Focus/More/
Onboarding + widgets + Live Activity. **iOS is missing** Play (games), Stats,
Routines, Review, Pick-for-me, Inbox tend. **Real debts:** contrast token
pass (a11y), prod-build Lighthouse.

## Execution model
- Design/visual/interactive phases → Opus (main loop, me).
- Mechanical (tests, data, mechanical ports, audits) → Sonnet subagents,
  verified before ticking.
- Each phase: build/gates green + evidence (screenshot or test) before tick.
- Commit in logical batches; deploy web to Coolify at the end + verify live.

## Progress tracker
### iOS parity — bring the loved web features native
- [x] P1: iOS Stats screen (completion bars, streak, focus totals)
- [x] P2: iOS Pick-for-me (decision breaker on Today + Inbox)
- [x] P3: iOS Routines (list + player with per-step timers)
- [x] P4: iOS Review Today (I-did-it / move / let-go)
- [x] P5: iOS Play — Brain breaks arcade (Time Feel, Quick Tap, Breath)
- [x] P6: iOS Inbox tend + low-battery + capture polish

### Web — pay down real debts + hardening
- [x] P7: Accessibility token pass — WCAG AA contrast across surfaces
- [x] P8: Prod-build Lighthouse — measure + fix real perf wins (live: perf 100, a11y 100)
- [x] P9: Web a11y sweep — keyboard/ARIA on overlays (subagent + accesslint)
- [x] P10: Security review pass of API surface (subagent)
- [x] P11: Test coverage — server/service unit tests for gaps (subagent)

### New ADHD capabilities
- [x] P12: Reward garden / visual progress — growth that isn't a streak
- [x] P13: Weekly reflection — gentle patterns digest on Stats
- [x] P14: Focus soundscape polish + session presets (named rituals)
- [x] P15: Smart "when am I most focused" nudge (uses focus-hours data)
- [x] P16: Energy-aware Plan-my-day (respect low-battery + energy tags)

### Polish + ship
- [x] P17: Landing page conversion polish + real product shots
      ("Signature moments" showcase — Reward Garden / Focus rituals / Routines,
      built as crafted theme-aware mocks matching the hero. Live-verified;
      Lighthouse held perf ~98–100 / a11y 100.)
- [x] P18: Onboarding refinement (web) — resumable, progress feel
- [x] P19: Cross-platform copy + empty-state audit (subagent)
- [x] P20: Full gates + deploy + live verify (web) + iOS suite green
      (web: lint+typecheck+344 tests+build green, live-verified; iOS: full
      unit+UI suite TEST SUCCEEDED)

## Rules
Tokens only; nothing turns red; forgiving copy; browser/simulator evidence
per phase. Web deploy verified on time.neima.me. iOS verified on simulator.
