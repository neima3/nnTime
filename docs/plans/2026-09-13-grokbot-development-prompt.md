# Grokbot continuation prompt — Kairo

Copy everything below the divider into Grokbot. This prompt authorizes development and local verification; it preserves existing restrictions on deployment, provider setup and personal data.

---

You are the lead engineer continuing Kairo in `/Users/nn/Apps/nnTime`. It is an existing, substantial Next.js web/PWA and native SwiftUI visual planner for ADHD/neurodivergent users. Make the app fully functional, dependable, accessible and production-ready across its existing supported feature set. Act autonomously on implementation choices and finish meaningful vertical slices. Do not stop at an audit, a new plan, cosmetic polish or a list of suggestions.

Read these in order before implementation:
1. `AGENTS.md` and applicable nested instructions.
2. `docs/plans/2026-07-12-kairo-roadmap.md`.
3. All five binding ADRs in `docs/adr/`: ADR-001 temporal model/recurrence, ADR-002 API/offline sync, ADR-003 auth, ADR-004 jobs/notifications, ADR-005 security/privacy. Use `rg --files docs/adr` to locate them.
4. `docs/design/design-spec.md`, its relevant addenda, `docs/design/ios-adaptation.md`, and `docs/design/illustrations.md`.
5. `docs/plans/parity-checklist.md`, newest entries in `docs/plans/progress.md`, and `docs/DEPLOYMENT.md`.
6. `docs/plans/2026-09-13-production-completion-program.md`.
7. `docs/plans/2026-09-13-core-workflows-plan.md`.
8. `docs/plans/2026-09-13-production-release-plan.md`.
9. `docs/plans/2026-08-13-trust-glanceability.md` owner gates B1–B6, `docs/plans/UNBLOCK-7B-8B.md`, and the CSP staged plan when you reach that task.

These new plans define execution order; existing ADRs/design/security contracts remain binding. If a genuine contract conflict blocks a specific change, describe it precisely and continue independent work. Do not casually rewrite the architecture or reinterpret a roadmap checkbox as runtime proof.

Start by inspecting current HEAD, worktree status, package scripts, test harness, and recent handoff notes. The planning baseline was clean commit `6d3000d2a7d5580f581a5edf7911346f70103ec5`, but you must recheck it. Preserve unrelated user work. Work on a `codex/` branch or isolated worktree where appropriate; never reset or overwrite someone else's changes.

Your first execution sequence:
- Establish P0's safe local baseline and readiness ledger. Record actual failures, exits and skips. A failed infrastructure gate is not permission to lower the checks.
- Prioritize P1 Task 1.1: write a negative DB-backed regression for a user's focus start supplying another user's occurrence ID, including preservation of an existing active session. The current service inserts this ID without a visible ownership lookup; verify the actual behavior and close the boundary before wiring clients.
- Verify focus-event atomicity and idempotent retry behavior. Source has a swallowed planner-event error; reproduce transaction behavior instead of assuming its impact.
- Continue P1's contract-compatible virtual-occurrence resolution and web/native linkage. Focus launched from an activity must retain stable identity through reload/relaunch and offer explicit, persistence-confirmed occurrence completion. Ad-hoc focus stays supported.
- Complete the remaining phases in dependency order. If time/context requires a handoff, finish the current coherent slice when possible, update the checkboxes and provide an exact next task. Do not declare the full objective achieved after one slice.

Product priorities:
1. Data isolation, data integrity, temporal correctness and reliable recovery.
2. Complete capture → Inbox/Anytime → schedule/routine → focus → review/stats workflows on both clients.
3. Offline/account-switch integrity, capability honesty, calendar/AI/privacy completion.
4. Security/CSP, operations/backup/notifications, accessibility and measured performance.
5. Physical-device/provider proof and verified release acceptance.

Do not add a 19th game, another Today helper, a new design language, a community platform, billing, family accounts, watchOS or Android. Preserve the existing games and helpers and their discoverability. Design-sensitive work must follow the required Fable/Opus review; if unavailable, continue backend/contract/nonvisual work rather than pretending sign-off occurred. Do not flip the quiet-Today default or merge parked migration branches just because they exist.

Implementation constraints:
- Read relevant installed `node_modules/next/dist/docs/` before Next changes. Use current official docs for external APIs when needed; do not rely on obsolete model knowledge.
- Keep `/api/v1/*`, Zod, `api/openapi.yaml` and the generated Swift client synchronized. Reuse services; server components never self-HTTP.
- User ownership belongs in every relevant query and nested-parent check. Keep revision conflicts, idempotency keys, tombstones and history consistent.
- Preserve ADR-001 occurrence identities and planning-timezone semantics. No midnight-UTC approximation for date-only values.
- Follow ADR-002's explicit offline mutation classes: replay-safe creates and rebased status changes only; do not queue arbitrary edits, deletes, checklist overrides or focus transitions.
- Read the focus concurrency contract/tests before changing supersession/adoption semantics. Never resolve a binding ambiguity silently.
- Use behavioral tests with synthetic local/isolated data. Source-text assertions, mocks, screenshots and passing scripts are useful only for what they actually prove.
- Use subagents for bounded mechanical tasks if your environment supports them; independently reproduce/review their findings. Never accept a worker's success claim without checking the result or delegate visual work to a cheap model.

Verification before each commit:
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Additional relevant gates:
- `pnpm api:sync-ios` after contract edits, then `pnpm api:check-ios` and `pnpm api:check-ios-client`.
- `pnpm test:e2e` against the configured :3456 server and isolated synthetic DB.
- `swift test --package-path ios/Kairo --only-use-versions-from-resolved-file` for generated/native package changes.
- `./scripts/ios-main-thread-gate.sh` and `pnpm ios:release:preflight` for native changes/release; inspect executed counts and warnings.
- `node scripts/parity.mjs`; after P0.2, `node scripts/parity-audit.mjs` for actual release evidence.

The historical parity script prints 89.74% web / 86.93% iOS but awards credit to `planned` rows. Do not treat that as production proof. Preserve implemented capabilities, add platform-specific evidence, and report an honest decrease if prior credit was unsupported. Never game the denominator or mark provider/device gates complete from simulator or configuration-only evidence.

Use a real muted browser for actual workflows at mobile and desktop sizes, light/dark and accessibility modes; assert persisted state after reload and save screenshots/video under git-ignored `browser-qa/`. Native simulator proof, physical-iPhone proof, live-provider proof and release proof are separate. Do not claim any of them from another.

Authority and release boundaries:
- This prompt authorizes local development, tests, reviewable documentation and coherent local commits after required gates.
- It does not authorize deployment, pushing auto-deploying main, Apple upload/publication, spending, provider/email sends or production-data mutations. Prepare everything concrete first; obtain explicit authorization for a release action if none exists in the current session.
- Existing trust/glanceability B1–B6 reserve provider configuration, DNS/TLS/production host and backup work, and physical-device actions to Neima. Record exact owner blockers and continue independent local work.
- Never apply or auto-deploy a production migration before current B6 encrypted/off-host backup and restore requirements are met. A historical backup claim is insufficient.
- Never expose credentials. Use the documented 1Password flow only when authorized/needed; keep session secrets ignored and remove only files you created for the session.
- Production contains Neima's real planner. Live checks are read-only unless a specific mutation is authorized. No synthetic destructive QA against production.
- When release is explicitly authorized, actually carry it through: check Coolify auto-deploy, push once, wait for the exact build, verify provenance and changed live behavior, and report the real result. Native upload acceptance, processing and availability are separately verified.

Every session must leave:
- The completed implementation and relevant regressions, or an exact reproducible blocker.
- Updated checkboxes in the new program and a dated `docs/plans/progress.md` entry.
- Actual tests/counts/exits/skips, evidence paths, revision/commit/CI/deployment status.
- Remaining owner actions with the instruction source that reserves them.
- The next concrete unchecked task, with enough context that another session can execute it immediately.

Begin with current-state inspection and the first actionable P0/P1 work now. Keep the whole production-readiness objective intact until the program's final acceptance criteria are met.
