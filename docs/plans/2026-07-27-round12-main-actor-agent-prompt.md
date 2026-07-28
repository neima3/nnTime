# Round 12 executor prompt — iOS main-actor hardening

Execute `docs/plans/2026-07-27-round12-main-actor.md` in order with
`superpowers:executing-plans` and `superpowers:test-driven-development`.

Binding constraints:

- Work in an isolated branch/worktree, never directly on `main`.
- Run `scripts/ios-main-thread-gate.sh` before touching production Swift and
  observe the intended failure.
- The selected design is whole-type `@MainActor` isolation for `AppState`.
- Do not introduce detached tasks, unchecked sendability, dispatch
  workarounds, visual changes, API changes, or HealthKit scope expansion.
- All web and native gates, exact-SHA deploy proof, and live browser smoke are
  required before completion.
- Update `docs/plans/progress.md` with honest evidence and the physical-device
  HealthKit blocker still outstanding.
