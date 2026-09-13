# Kairo production completion program

> For agentic workers: use `superpowers:executing-plans` when available. Execute the task checkboxes in the companion plans, one independently verifiable slice at a time. This is a planning deliverable; no implementation or release is claimed.

**Goal:** Make Kairo a dependable, fully functional personal visual planner on web/PWA and native iOS, with independently evidenced ≥85% feature parity on each platform and a verifiable production release.

**Architecture:** Keep the existing Next.js server/service/DAL architecture, canonical REST/OpenAPI contract, Postgres persistence, and generated Swift client. Close correctness and operational gaps in existing workflows before introducing additional product scope.

**Stack:** Next.js 16.2.12, React 19, TypeScript, Tailwind tokens, Drizzle/Postgres, Better Auth, Vitest/Playwright, SwiftUI/XcodeGen/WidgetKit. Versions reflect package.json at planning time; executors inspect the installed lockfile and relevant bundled Next docs before coding.

**Baseline inspected:** 2026-09-13, clean `main` checkout at `6d3000d2a7d5580f581a5edf7911346f70103ec5`.

## Read and execute

1. `AGENTS.md`, original `2026-07-12-kairo-roadmap.md`, ADR-001 through ADR-005, design spec and its addenda.
2. This program, then `2026-09-13-core-workflows-plan.md` for P0–P3.
3. `2026-09-13-production-release-plan.md` for P4–P8.
4. `2026-09-13-grokbot-development-prompt.md` is the complete executor prompt.

All names above are relative to `docs/plans/` except AGENTS.md and the ADR/design references. The original roadmap remains the historical product contract. This program supplies the next execution order; it does not reopen completed work or claim that earlier gates passed again.

## Evidence and uncertainty

| Observation | Evidence inspected | Meaning for execution |
|---|---|---|
| A large web and native product already exists | `src/components/`, `src/server/`, `ios/App/Features/`, `ios/UnitTests/` | Improve and complete existing systems; do not scaffold replacements. |
| Round 93 reports 1389 tests, three green CI jobs, and a live illustration release | Most recent `progress.md` entry and git history | Historical evidence only. This planning pass did not rerun application gates, CI, a browser tour, or live/device QA. |
| Script currently prints web 89.74%, iOS 86.93% | Fresh `node scripts/parity.mjs` execution | Arithmetic verified, feature readiness not verified. |
| `planned` maps to credit 1; checklist mixes planning and shipping semantics | `scripts/parity.mjs`, `parity-checklist.md` | Add an evidence-based audit mode before using percentages as a release gate. Never preserve misleading credit simply to keep the number green. |
| 7B and 8B remain unchecked | Original roadmap | Production provider activation and signed physical-device auth evidence remain open in the records. Recheck actual availability. |
| Web and native start-focus calls omit occurrence linkage | `FocusClient.tsx`, `KairoAPI.swift`, Round 92 plan | Finish the capture → schedule → focus → complete loop through the shared contract. |
| Focus service inserts the supplied occurrence ID without a visible ownership lookup | `services/focus.ts`, POST route | High-priority source finding requiring an integration reproduction; no exploitation or production impact was tested. |
| Focus POST suppresses an event-write failure | POST route uses `appendPlannerEvent(...).catch(() => {})` | Investigate transaction rollback and audit-history consistency using injected failures; do not infer runtime behavior from the catch alone. |
| CSP Stage 1 is recorded complete, Stages 2–3 open | Round 92 and CSP staged plan | Preserve the bootstrap refactor; validate render-mode coverage before stricter enforcement. |
| HealthKit already has implementation and tests | `HealthKitManager.swift`, its tests, K04 evidence | Do not repeat the older unimplemented HealthKit plan. Device interaction proof remains incomplete in K04. |
| Backup-gated branches and owner-only operations are recorded | Trust/glanceability v2, B1–B6 | Inspect branches before reuse; do not merge a migration into auto-deploying main before its gate. |

This is a repository-grounded development plan, not a fresh Tiimo market survey or a full security audit. Existing parity inventory and exclusions remain the comparison baseline until separately researched.

## Product scope and approach

Three possible approaches were considered:

- Feature expansion first could raise inventory coverage but would leave known trust and release gaps unresolved.
- Release checks alone could improve operational confidence but leave incomplete core product loops.
- **Selected: complete vertical workflows, harden shared contracts, then prove release readiness.** Each phase produces a usable improvement with behavioral evidence, while owner-dependent release work has a separate queue.

The release scope is a personal planner: capture, Inbox/Anytime, scheduling and recurrence, routines/templates, calendar import, focus, review/stats, AI-assisted planning, personalization/accessibility, privacy, offline support within ADR-002, native glance surfaces, and documented authentication methods. Every advertised control must work, recover honestly, or clearly explain a real capability limitation.

Keep the Soft Focus design, clay illustration language, calm timeline, reduced-stimulation mode, semantic categories, and 18 existing games. Do not add another game, another Today helper, billing, family accounts, a community service, watchOS, or Android in this program. Those are separate expansions, not prerequisites for making the existing product complete. Existing exclusions and partial-credit design decisions cannot be silently reclassified as shipped features.

## Ordered phases and completion tracker

| Phase | Priority | Deliverable | Dependency / exit |
|---|---|---|---|
| P0 | P0 | Reproducible baseline, evidence ledger, ranked defects | First; never call stale test counts current |
| P1 | P0 | Secure occurrence-linked focus on both clients | P0; authorization, history, identity and replay proof |
| P2 | P1 | Capture → plan → do → review and temporal integrity | P1 for linked-focus acceptance; other regressions can run independently |
| P3 | P1 | Offline/account boundaries and complete advertised feature behavior | P0; P1/P2 shared invariants preserved |
| P4 | P1 | CSP, auth/API security, privacy lifecycle | P0; CSP staged separately from migrations |
| P5 | P1 | Recovery, scheduler delivery, monitoring, provenance | Local preparation anytime after P0; production ops use owner gates |
| P6 | P1 | Web/PWA/native accessibility and performance evidence | P2/P3; stabilize behavior before final visual QA |
| P7 | Release blocker | Physical-device authentication, integration and native distribution proof | Provider, device, backup and release permissions supplied |
| P8 | Release blocker | Evidence-based parity and production acceptance | All mandatory gates complete; no unresolved release blockers |

- [ ] P0 baseline and evidence ledger accepted.
- [ ] P1 occurrence-linked focus complete.
- [ ] P2 core workflow and temporal integrity complete.
- [ ] P3 recovery and feature completeness complete.
- [ ] P4 security and privacy gates complete.
- [ ] P5 operational readiness demonstrated.
- [ ] P6 accessibility and performance acceptance complete.
- [ ] P7 device and native release evidence complete.
- [ ] P8 production acceptance complete.

Use these checkboxes for this program. Update original roadmap 7B/8B only when their physical/provider gates actually pass. A failed or blocked task stays unchecked; record the exact independent task selected next.

## Session sizing and execution rules

Each numbered task in the companion plans is a bounded work unit. Split a task further before editing if it crosses multiple independently releasable behaviors. For implementation, write the failing behavioral regression, run it, make the smallest coherent change, rerun the focused tests, then run the required global gates before committing. Do not write an entire speculative implementation from this program in a single change.

Priority within a phase: data isolation/loss → broken advertised behavior → recovery → accessibility → performance → visual refinement. An independently reproduced critical flaw preempts the default first task; record why. Existing passing flows need verification, not gratuitous rewrites. Do not spend an entire execution session revising plans while implementable tasks remain.

Use current source to select exact edit points; named files in the plans are verified starting points, and proposed new files are explicitly labeled. No runtime dependencies are required by this program. New dependencies, contract changes, and migrations require a concrete justification and review of the applicable contracts, not a broad redesign.

For design-sensitive work, preserve the approved patterns and required Fable/Opus sign-off. If that reviewer is unavailable, complete nonvisual work and leave the specific new design blocked. Grokbot must not claim it supplied someone else's sign-off.

## Owner gates and authority

The existing trust/glanceability plan explicitly reserves provider credentials/configuration, production DNS/TLS/host access, physical-phone actions, and B6 backup work to Neima. Preserve those assignments unless Neima explicitly authorizes a change. Prepare exact runbooks and reviewable changes first; record the blocker and continue independent local tasks. Do not reinterpret this planning request as authorization to deploy, upload to Apple, send email, spend money, or change production data.

In particular, pushing `main` may auto-deploy. A production-migration branch must remain off main until the required backup/restore and deployment authorization are satisfied. Do not reuse a historical dump or backup claim as current proof. Do not print credentials or record personal planner content in QA artifacts.

## Definition of production-ready

- All mandatory supported workflows pass persisted-state assertions using synthetic accounts, including errors, retries, stale revisions, account switching and app restarts.
- No open reproducible P0/P1 defects; lower-severity residuals have explicit scope, impact, and release disposition.
- Required lint/typecheck/test/build, contract, E2E, native and CI checks pass for the release revision. Skips and cancelled jobs are explicitly accounted for.
- Evidence-based parity is ≥85% independently for web and iOS; unsupported claims do not receive credit. Existing script output remains a baseline, not a substitute.
- Fresh backup/isolated restore proof, migrations/recovery instructions, working scheduler/notification evidence and observable failures exist.
- Production build provenance matches the intended app code; changed live routes are verified in a browser. A health 200 or old CSS marker is insufficient.
- Physical device proof closes 7B/8B and any claimed HealthKit/push/widget capability. TestFlight availability requires processed Apple-side evidence; public App Store launch requires a separately authorized release.
- Privacy disclosures, processor inventory, accessibility checks and support/recovery instructions match the implementation.

## Handoff record

Every execution session adds a dated entry to `progress.md`: selected task; before/after behavior; files and migrations; tests with counts/exits/skips; browser/device evidence paths; commit and CI status; deployment/Apple status; unresolved risks; owner action with its source; exact next unchecked task. Preserve older entries. Keep screenshots, video, logs, signing artifacts and synthetic credentials out of commits.
