# Round 21 Native Sync Execution Prompt

Continue Kairo development in the isolated Round 21 worktree. Read, in order:

1. `AGENTS.md`
2. `docs/plans/2026-07-29-round21-native-sync-design.md`
3. `docs/plans/2026-07-29-round21-native-sync.md`
4. `docs/adr/ADR-002-api-and-offline-sync.md`
5. `docs/plans/2026-07-12-kairo-roadmap.md`
6. `docs/design/design-spec.md`
7. `docs/plans/progress.md`

Execute every task in the implementation plan test-first. ADR-002 is binding:
queue only replay-safe task creates and rebase-on-replay activity-status
changes; never general edits, deletes, checklist changes, focus actions, or
arbitrary HTTP. Preserve original idempotency keys. Re-read activity revision
immediately before status replay. Keep 409 pending, make deletion/terminal 4xx
explicit durable conflicts, preserve retryable failures with bounded backoff,
and use `/changes` only to invalidate and refetch authoritative state.

Keep the sync document protected and exactly account-scoped. Extend every
logout/account-switch/401 purge boundary. Reuse generated OpenAPI operations,
Kairo tokens, existing typography, and existing interaction patterns. No raw
hex in components. No production mutations.

Do not stop at compile success. Run the complete web, OpenAPI, Swift package,
iOS unit, Round 21 UI, release build, and release-preflight gates. Verify the
new UI at 390 points in light, dark, and accessibility XXXL; capture ignored
evidence in `browser-qa/round21-native-sync/`. Perform a full polish pass and an
independent ADR-focused code review, fix valid findings, then integrate, push,
deploy the exact SHA through Coolify, and verify the live runtime.

Keep Phase 7B open unless production provider credentials and physical-iPhone
proof genuinely become available. Report external blockers exactly; never
substitute simulator or local success for provider, device, TestFlight, or live
deployment proof.
