# Round 68 — Onboarding step focus

## Production finding

A read-only production onboarding dogfood pass reproduced that activating
“Next” on Step 1 replaces the panel with Step 2 while focus falls back to the
document body. The new heading is not focused, leaving keyboard and screen-reader
users without a reliable cue that the step changed.

Ignored reproduction evidence lives under `browser-qa/round68-dogfood/`.

## Contract

- Focus the new `h1` after a user-triggered transition between onboarding steps.
- Cover both Step 1 → Step 2 and Step 2 → Step 3 transitions.
- Do not steal focus when a saved onboarding step is restored on initial load.
- Preserve draft persistence, signed-out boundaries, account creation return,
  anchor creation, and all existing visual treatment.
- Pin behavior with browser tests, then verify desktop/mobile rendering, full
  repository gates, exact-SHA CI, deployment, and live production behavior.

## Checklist

- [x] Reproduce twice in production with browser-local state only.
- [x] Capture screenshots, video, focus state, and report.
- [x] Add a failing browser focus contract for user-triggered step changes.
- [x] Implement the smallest focus-management fix.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [ ] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
