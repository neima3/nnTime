# Round 17 executor prompt — offline mutation integrity

Execute
`docs/plans/2026-07-28-round17-offline-integrity.md` task-by-task.

Binding inputs:

1. `AGENTS.md`
2. `docs/adr/ADR-002-api-and-offline-sync.md`
3. `docs/plans/2026-07-28-round17-offline-integrity-design.md`
4. `docs/design/design-spec.md`

Use strict red/green TDD. Do not queue general edits, deletes, checklist
changes, focus mutations, imports, settings, push subscriptions, or
multi-resource promotions. Keep user input when local persistence fails. Treat
terminal conflict bodies as personal data and render only the approved generic
server-version copy.

Finish with full web/native gates, production-mode Playwright, ignored
desktop/mobile evidence, adversarial review, roadmap/progress updates,
commit/push, exact-SHA CI, Coolify deploy, and read-only live verification.
Production planner and mood mutations are prohibited.
