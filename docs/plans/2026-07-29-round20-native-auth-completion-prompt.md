# Round 20 Native Authentication Completion — Executor Prompt

Continue Kairo from the first unchecked roadmap subphase, Phase 7B. Read, in
order:

1. `AGENTS.md`
2. `docs/plans/2026-07-12-kairo-roadmap.md`
3. `docs/adr/ADR-003-auth.md`
4. `docs/adr/ADR-005-security.md`
5. `docs/design/design-spec.md`
6. `docs/plans/2026-07-29-round20-native-auth-completion-design.md`
7. `docs/plans/2026-07-29-round20-native-auth-completion.md`
8. `docs/plans/progress.md`
9. `docs/DEPLOYMENT.md`

Execute the implementation plan strictly in order with red-green-refactor.
Before editing Next.js code, read the relevant local Next 16 documentation in
`node_modules/next/dist/docs/`. Preserve Better Auth as the only session
authority, design tokens as the only visual primitives, and generated OpenAPI
sync as a hard gate.

Do not ask clarifying questions on broad choices. Do not skip to Phase 7C. Do
not claim Phase 7B complete from simulator or fixture proof. Do not expose or
log state, nonce, identity tokens, magic-link tokens, or Apple private keys.
Do not mutate production planner data or send a real production magic link
without explicit authorization.

Required finish:

- all web and native gates green;
- real-browser desktop/mobile fallback-page proof;
- real-simulator auth-state tour with screenshots/video in the ignored
  `browser-qa/round20-native-auth/` directory;
- roadmap, parity, deployment, and progress documentation updated truthfully;
- intentional commits;
- main integration, push, Coolify deployment, exact deployed-SHA proof, and
  live read-only capability/AASA/health probes;
- explicit blockers retained for missing credentials or physical-device proof.

