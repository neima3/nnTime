# Round 16 continuation prompt

Execute
`docs/plans/2026-07-28-round16-generated-native-client.md` from the first
unchecked task. Treat
`docs/plans/2026-07-28-round16-generated-native-client-design.md`, ADR-002,
ADR-003, and the project `AGENTS.md` as binding.

Use test-driven development for every behavior change. Keep the polished
SwiftUI presentation models and screens stable while moving all shipping
`/api/v1` transport to `KairoAPIClient`. Better Auth `/api/auth/*` remains the
only manual native HTTP boundary. Do not accept a package-only compile as proof:
force clean generation, generate the Xcode project, compile/test the real app,
and retain ignored QA evidence.

Do not mutate production planner data. Local synthetic mutations are required;
production verification is read-only. Before handoff, update the plan
checkboxes, roadmap evidence, and `docs/plans/progress.md`, obtain independent
review, run every web/native/browser gate, integrate and push, verify all CI
jobs, deploy the exact SHA through the documented Coolify workflow, and prove
the live revision is healthy.
