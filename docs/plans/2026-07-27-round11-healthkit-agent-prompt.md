# Round 11 HealthKit — continuation prompt

Work in `/Users/nn/Apps/nnTime` and read `AGENTS.md`, the binding ADRs, `docs/design/design-spec.md`, and `docs/plans/2026-07-27-round11-healthkit.md` before editing.

Execute the first unchecked checkbox in the Round 11 plan. Follow strict red-green TDD for behavior changes. The scope is explicit opt-in plus write-only HealthKit mindful-session export after a server-authoritative focus completion. Do not add sleep reads, background delivery, clinical HealthKit capabilities, health-data API storage, or analytics.

Required proof before completion:

1. Focused HealthKit manager tests show a real RED compile failure before implementation and GREEN executed tests afterward.
2. Full web gates pass: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. XcodeGen succeeds; full iOS unit and UI bundles report nonzero `Executed` counts with zero failures.
4. A generic iOS device build with signing disabled compiles the HealthKit integration.
5. Simulator Settings screenshots exist in `browser-qa/round11-healthkit/`.
6. Docs state truthfully that a physical iPhone grant and sample-in-Health verification remain required.

Do not commit generated `ios/Kairo.xcodeproj` or `browser-qa/` artifacts. Update Round 10E, K04 evidence, stale F9/G9 provenance, and `docs/plans/progress.md` only when the corresponding evidence exists.
