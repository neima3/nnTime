# Round 22 Executor Prompt — iOS Glance Surfaces

Continue Kairo from the first unchecked actionable roadmap item, Phase 8A.
Read, in order:

1. `AGENTS.md`
2. `docs/plans/2026-07-12-kairo-roadmap.md`
3. `docs/adr/ADR-003-auth.md`
4. `docs/adr/ADR-004-jobs-and-notifications.md`
5. `docs/adr/ADR-005-security.md`
6. `docs/design/design-spec.md`
7. `docs/design/ios-adaptation.md`
8. `docs/plans/2026-07-29-round22-ios-glance-surfaces-design.md`
9. `docs/plans/2026-07-29-round22-ios-glance-surfaces.md`

Execute the implementation plan task by task using strict test-first
development. Preserve the Round 19 security correction: widget and Live
Activity surfaces are read-only/open-app until a separately designed,
physical-device-proven secure extension session bridge exists. Do not restore
`KairoRemote`, shared cookie transport, AppIntent mutations, or optimistic
extension writes.

Use only the existing Kairo token vocabulary and the binding iOS adaptation.
Prove the real embedded extension on an iPhone simulator, save ignored evidence
under `browser-qa/round22-ios-glance-surfaces/`, run every repository gate, and
update the roadmap, parity checklist, and progress log truthfully. H03/H04 stay
partial even if Phase 8A's actionable read-only scope closes. Native-only work
does not require a Coolify deploy.
