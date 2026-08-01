# Round 40 — other-agent change audit and release hardening

Goal: independently review everything added after the last paused release
handoff, fix confirmed issues, run the complete release gates, and deploy an
evidence-backed current `main` before continuing ongoing 8C hardening.

## Reviewed range

- Baseline: `a22fc59` (Round 23 Google-auth release handoff)
- Audited head: `73c89dd` (Round 39 Live Activity controls)
- Scope: 80 changed files, 8,787 insertions and 547 deletions across web and
  native games, accessibility preferences, dependency hardening, database-test
  infrastructure, authenticated widgets, and Live Activity controls.

## Findings

1. **Green Light accepted late taps.** The game kept the large signal button
   active during the blank inter-stimulus gap. `tap()` checked only the overall
   playing stage, so a tap after the light disappeared could still score the
   previous stimulus. The input gate now also requires `showing`; a source
   contract test pins that timing boundary.
2. **Timeline cards nested interactive semantics.** Each draggable activity
   was exposed as `role="button"` while containing real checklist, focus, and
   completion buttons. The activity is now a labelled, focusable
   `role="group"` with `aria-roledescription="timeline activity"`, preserving
   its keyboard move/resize/edit shortcuts while keeping child actions distinct.
3. **Current-truth docs drifted after R38/R39.** The roadmap and D07 evidence
   still said authenticated widget mutations were blocked and all actions only
   opened the app. They now reflect the shipped network-first widget completion
   and app-process Live Activity controls.

No additional release-blocking defect was found in the reviewed R24–R39 code.
The App Group keychain design and `LiveActivityIntent` app-process design were
checked against Apple's platform contracts; their core premises are valid.

## Release gates

- Web: lint, typecheck, full Vitest suite, production build.
- Native: OpenAPI sync/adoption, iOS release preflight, XcodeGen app-hosted
  `KairoUnitTests`, and Main Thread Checker gate.
- Product: parity recompute; live read-only desktop/mobile browser sweep;
  actual Green Light, Night Sky, and Pattern Tiles gameplay; local browser
  verification of the repaired accessibility tree and blank-gap input guard.
- Delivery: push to `main`, wait for exact-SHA CI and Coolify deployment, then
  verify live health plus unique behavior markers in a real browser.

## Remaining external boundary

Phases 7B and 8B stay unchecked. Their remaining work is still limited to the
legal credential provisioning and physical-iPhone lifecycle in
`docs/plans/UNBLOCK-7B-8B.md`; this audit does not redefine those gates.
