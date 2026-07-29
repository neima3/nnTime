# Round 23 Executor Prompt

Continue Kairo Phase 8B by executing
`docs/plans/2026-07-29-round23-google-auth.md` exactly.

Read first:

1. `AGENTS.md`
2. `docs/plans/2026-07-29-round23-google-auth-design.md`
3. `docs/plans/2026-07-29-round23-google-auth.md`
4. ADR-003 and ADR-005
5. `docs/design/design-spec.md`
6. the latest entry in `docs/plans/progress.md`

Use strict TDD and preserve Better Auth as the sole identity/session
authority. Google must ship on web and iOS together, use verifiable ID tokens
on native, and provide explicit linking without silent account merges. Do not
implement Apple Reminders: record the approved privacy exclusion because
EventKit offers no read-only Reminders permission.

Do not mark Phase 8B complete without real browser Google OAuth plus a signed
physical-iPhone sign-in/link/relaunch/logout lifecycle. Simulator fixtures are
required UI evidence but do not satisfy the release gate. Run every required
web/native/release/parity gate, update the roadmap and progress truthfully,
commit, push, deploy if server configuration is activated, and verify the live
exact SHA.
