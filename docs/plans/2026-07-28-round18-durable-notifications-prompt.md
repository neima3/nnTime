# Round 18 executor prompt — durable notifications

Execute
`docs/plans/2026-07-28-round18-durable-notifications.md` task-by-task.

Binding inputs:

1. `AGENTS.md`
2. `docs/adr/ADR-004-jobs-and-notifications.md`
3. `docs/plans/2026-07-28-round18-durable-notifications-design.md`
4. `docs/plans/2026-07-28-round18-durable-notifications.md`
5. `docs/design/design-spec.md`
6. `docs/DEPLOYMENT.md`

Use strict red/green TDD. Jobs must live in `notification_jobs`, never
`planner_events`. Database uniqueness is the duplicate barrier. Claims must be
atomic, transient delivery failures must remain retryable, and no claimed row
may be abandoned in `processing`. Keep activity copy privacy-minimal and never
log push endpoints, job payloads, planner notes, or user identifiers.

The forward migration may create tables, enums, and indexes but must not delete
or rewrite existing production planner history. Before deploying any migration,
create and validate the predeploy database backup required by
`docs/DEPLOYMENT.md`.

Finish with full web/OpenAPI/native gates, production-mode synthetic browser
proof, adversarial review, roadmap/parity/progress updates, commit and push,
exact-SHA GitHub Actions, exact-SHA Coolify deployment, and read-only live
verification. Do not create, edit, deliver, cancel, or inspect user-level
production planner or notification data during smoke testing.
