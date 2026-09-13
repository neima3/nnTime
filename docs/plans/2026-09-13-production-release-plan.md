# Kairo security, operations and release implementation plan

> For agentic workers: use `superpowers:executing-plans` when available. Follow the production completion program and preserve the existing owner gates. A prepared release is not a deployed or published release.

**Goal:** Demonstrate secure, recoverable operation, accessible performance, real native integration, and release provenance for the completed planner.

**Architecture:** Harden the existing app and worker, retain the shared API and platform-specific notification channels, and release backward-compatible slices through the existing Coolify and native pipelines.

**Stack:** Existing Next proxy/CSP, Postgres-backed jobs and limits, Docker/Coolify, GitHub Actions, browser QA, XcodeGen/native release scripts.

## P4. Security and privacy

### Task 4.1 — API/auth boundary regression matrix

Existing files: `src/server/auth.ts`, `auth-session.ts`, `auth-capabilities.ts`, `src/server/ratelimit/`, `src/server/api-errors.ts`, `src/app/api/v1/`, `src/server/schemas/`, `src/server/dal/isolation.test.ts`, `src/server/native-mutation-origin.test.ts`, `src/server/services/ai.ts`, `calendar.ts`, `privacy.ts`.

- [ ] Inventory handlers and schema coverage using existing contract inventory tests. For each mutation family record auth, ownership/parent ownership, Origin/CSRF, body limit, revision, idempotency and rate-limit behavior. Do not assume middleware proves handler security.
- [ ] Add missing negative integration coverage for unauthenticated, cross-user and nested foreign-parent access; stale revision; repeated logical mutation; malformed body; and CSRF. Verify the same service used by server components.
- [ ] Verify signup verification-before-write, password reset, magic-link expiry/replay, redirect safety, session revocation and fail-closed capabilities. Determine actual implementation compliance with ADR-003; do not infer it from login screens.
- [ ] Test AI schema rejection, atomic quota contention and absence of autonomous writes; test ICS private/loopback/metadata addresses, IPv6, redirect rebinding and response caps using controlled local fixtures. Never target real internal endpoints.
- [ ] Run `pnpm audit --prod` and record actionable dependency findings. Verify fixes against official package advisories/release notes at execution time, update minimally, and rerun gates; do not bulk-upgrade the stack without cause.

Exit: all reproduced high-risk flaws fixed with behavioral tests; untested boundaries remain listed as unverified. A source scan alone is not a security audit pass.

### Task 4.2 — Stage and enforce a compatible CSP

Read `docs/plans/2026-08-24-csp-unsafe-inline-plan.md` in full. Existing files: `src/proxy.ts`, `src/app/theme-script-code.ts`, `src/app/app/prefs-bootstrap.ts`, bootstrap tests, `next.config.ts`, and relevant installed `node_modules/next/dist/docs/` guidance. Proposed test: `e2e/csp-production.spec.ts`.

- [ ] Rebuild a current route/render-mode census. Include landing, auth, onboarding, privacy, app documents, 404/not-found/error shells, RSC navigation/prefetch, generated social images and service worker; do not copy the old static allowlist blindly.
- [ ] Preserve Stage 1 static script text/hash integrity. Introduce fresh request nonces on genuinely dynamic documents and forward the appropriate request policy so framework scripts receive the nonce.
- [ ] Keep the existing enforcing policy while the strict candidate is report-only. Use production `pnpm build` output, not dev-mode eval behavior, to test hydration and navigation.
- [ ] Record browser `securitypolicyviolation` events in E2E; cover auth, Today, Focus, Settings, AI confirmation, games, refresh and offline return in light/dark modes. Assert nonce freshness between independent documents and no shared nonce-bearing cached HTML.
- [ ] Document any remaining static-route relaxation as unresolved security work. Prove a supported static hash policy or an explicitly evaluated dynamic-render strategy before claiming complete ADR-005 compliance. The earlier staged exception is not the final release destination.
- [ ] Enforce only after a clean candidate-policy tour; repeat the browser tests under enforcement. Keep changes isolated so reverting the policy does not revert unrelated product fixes.

Use browser-collected reports initially. If a server report receiver becomes necessary, separately plan body limits, shared rate limits, aggressive URL/token redaction, bounded retention and unauthenticated-abuse tests. Do not post unauthenticated CSP data to the session-only client-error sink.

### Task 4.3 — Verify privacy lifecycle end to end

Files: `src/server/services/privacy.ts`, `privacy-deletion.test.ts`, database schema, auth/provider/push services, web Settings, `ios/App/Features/More/SettingsView.swift`, `ios/App/PrivacyInfo.xcprivacy`, privacy page.

- [ ] Build a synthetic account containing every supported owned resource, jobs, provider fixtures, focus history and pending sync work. Export and verify data is complete and scoped to that account.
- [ ] Delete only the synthetic account in a local/isolated environment. Assert session revocation, rows/jobs/subscriptions/provider links removed or handled per retention policy, and caches/Keychain/widget state purged after the deletion response.
- [ ] Inject provider revocation/network failure and prove bounded retry or truthful residual handling; do not claim all upstream data deleted when it is not confirmed.
- [ ] Check representative failure logs and artifacts for cookies, bearer tokens, email/reset links, ICS URLs, AI text and Health data. Add redaction regressions with unmistakably synthetic canary values.
- [ ] Reconcile privacy disclosures and Apple manifests/labels with actual permissions, processors, retention and HealthKit behavior. Health samples stay device-local under the existing design.

## P5. Operations and recovery

### Task 5.1 — Local recovery and migration rehearsal

Files: `docs/DEPLOYMENT.md`, `Dockerfile`, `scripts/migrate.ts`, `src/server/db/migrate-on-startup.ts`, migration-chain tests, `drizzle/`, CI.
Proposed document: `docs/plans/2026-09-13-release-runbook.md`.

- [ ] Inventory the actual migration chain and parked branches. Do not assume previously proposed migration numbers remain free or cherry-pick historical migrations unchanged.
- [ ] For each new migration document schema expansion, old-client compatibility, safe rollout ordering, predeploy backup gate, failure behavior and rollback/forward-fix procedure. Preserve forward-only conventions; never use `db:push` against production.
- [ ] Rehearse backup → isolated restore → integrity checks using synthetic local data. Verify representative planner rows, event history, recurrence and sync consistency, not just a successful restore process exit.
- [ ] Exercise duplicate app startup/migration locking and restart after failure. Confirm an incomplete migration cannot report healthy readiness.
- [ ] Write the production operator checklist for encrypted/off-host backup location, timestamp, retention, restore result and access controls. Do not copy production data into ordinary QA directories. Actual production dump/restore work remains B6.
- [ ] Preserve pre-migration and previous-image references. A destructive production restore is a separate explicit decision; never run it automatically on an ambiguous deploy failure.

Acceptance: local rehearsal evidence and an executable owner runbook exist; production recovery stays unverified until B6 supplies current evidence.

### Task 5.2 — Durable scheduling and delivery

Files: `src/server/services/scheduler-runs.ts`, `notification-delivery.ts`, `notification-policy.ts`, `notifications.ts`, `routine-materializer.ts`, corresponding integration suites, `src/app/api/health/route.ts`, scheduler deployment sections.

- [ ] Trace the actual deployed-worker/cron architecture from code and runbook. Record discrepancies with ADR-004 and resolve the documentation/contract decision without silently changing worker topology.
- [ ] Test two concurrent workers, process restart, expired lease, missed tick/backfill, retry exhaustion, expiry and delivery failure with synthetic fixtures. No duplicate routine instances or repeated logical notifications.
- [ ] Test notification cancellation after edit/delete/completion, timezone/quiet-hours changes, stale 410 subscriptions and privacy mode. Assert at-most-one active job for each dedup identity and honest terminal/retry states.
- [ ] Distinguish “job created,” “provider accepted,” and “notification observed.” Delivery on a physical installed PWA/iOS device is a P7 gate, not established by a mocked push response.
- [ ] Verify health reflects meaningful DB/migration/scheduler failures. Record thresholds from actual policy; document actionable alerts for failed backups, stale scheduler, repeated job failure and elevated request errors.

If client telemetry is needed, inspect parked `feat/client-error-sink` first. Revalidate current schema/OpenAPI/ownership/rate limits/redaction/deletion cascade, prepare locally, and hold its migration off auto-deploying main until B6. Adding telemetry is not a reason to log planner contents.

### Task 5.3 — Release provenance and CI reliability

Files: `.github/workflows/ci.yml`, `Dockerfile`, `src/app/api/health/route.ts`, `docs/DEPLOYMENT.md`, native release scripts.

- [ ] Verify CI runs DB integration, contract tests, E2E and native package/app gates. Check that skips/cancellations cannot masquerade as a completed release gate.
- [ ] Add or verify server-side build provenance (commit and build time) with no env/secret dump. If deployment currently relies on unique asset markers, record the marker and exact app-code SHA until a reliable provenance endpoint exists.
- [ ] Verify a clean, pinned install and production build. Capture local output separately from CI results.
- [ ] For an authorized web release, check actual Coolify auto-deploy state, push once, avoid duplicate manual triggers, wait for the matching build's terminal result, then verify provenance and changed live routes in a browser.
- [ ] Never mutate Neima's real planner for a smoke test. Use read-only live checks; request specific authorization for any live synthetic-account write that is actually needed, or keep write proof on isolated staging.

## P6. Accessibility, performance and product polish

### Task 6.1 — Verify the complete interaction matrix

Files: affected `src/components/` and `src/app/app/` surfaces, `src/app/globals.css`, `docs/design/design-spec.md`, `docs/design/ios-adaptation.md`, `docs/design/illustrations.md`, native feature views and UI tours.

- [ ] Capture core signed-in workflows at 390×844, 1440×900 and 1440×760; check 320px/reflow and 200% zoom. Cover light, dark, reduced motion, reduced stimulation and high contrast where supported.
- [ ] Test keyboard-only capture, edit, scheduling alternative, focus, review and auth recovery: accessible names, visible focus, modal containment/restoration, sensible tab order, no focus under overlays, and useful error announcements.
- [ ] Test VoiceOver on native core flows with large accessibility text. Ensure timer changes do not create continuous announcements; controls remain reachable with keyboard/large text/safe areas.
- [ ] Verify iOS touch targets, mobile scrolling and drag arbitration, loading/empty/error/saving states, and long titles/checklists/translated-length text. Include a dense day with overlaps and midnight splits.
- [ ] Fix measured regressions using tokens and existing patterns. Save actual before/after screenshots and interaction video to ignored `browser-qa/`; keep reviewer-required design work separate from mechanical fixes.

Do not automatically flip the parked quiet-Today default. Reuse the old plan only after branch inspection, B6 for any settings migration, before/after evidence and its explicit owner review. Existing helper features must remain reachable if relocated.

### Task 6.2 — Establish and meet performance budgets

- [ ] Profile a production build for cold/warm landing, authenticated Today, dense Week/Month, Inbox, and focus navigation using deterministic synthetic datasets. Record device/browser/network profile, dataset size and run count.
- [ ] Repeat at least three mobile Lighthouse runs for the original ≥90 mobile performance target; report median and spread. Also record LCP, CLS and interaction traces, separating lab evidence from unavailable real-user field data.
- [ ] Profile server queries for day expansion, stats, calendar sync and queue replay. Fix reproduced N+1/unbounded-fetch/re-render problems without dropping occurrence accuracy or user isolation.
- [ ] Run a native focus/background/foreground tour and inspect main-thread warnings and repeated refresh work. Re-run `./scripts/ios-main-thread-gate.sh`; report executed test counts, not only a zero shell exit.
- [ ] Rerun affected functional tests and capture the same benchmark after a change. Do not add caching of private data to meet a performance number without ADR-002 proof.

## P7. Owner-dependent provider and physical-device proof

Read `docs/plans/UNBLOCK-7B-8B.md`, trust/glanceability B1–B6, native auth activation sections of `docs/DEPLOYMENT.md`, HealthKit implementation/tests, and native release plan/script docs.

### Task 7.1 — Prepare a concrete operator checklist

- [ ] Inventory required configuration names and public identifiers from the current deployment guide; show present/missing status only, never values. Cover mail, Apple, Google, associated domains, staging DNS/TLS, backup gate and signing prerequisites.
- [ ] Produce one concise checklist per blocker with owner, dependency, exact action, expected evidence, affected feature and rollback. Include capability flags as a configuration check, not proof of successful sign-in.
- [ ] Respect existing owner-only assignments. Do not call live email/provider actions or edit production configuration without explicit authorization; continue independent P1–P6 work while waiting.

### Task 7.2 — Execute authorized physical-device scenarios

- [ ] Record device model/OS, installed bundle version/build/SHA and environment. Fresh signed build/install/launch verification must precede functional claims; historical device identifiers may be stale.
- [ ] Prove password auth, relaunch/Keychain restore, offline launch, expiry/401, revoke/logout/account switch, and cache/widget purge.
- [ ] Prove magic-link request/open/single-use/expired/cross-device behavior; Apple and Google sign-in plus explicit account linking/cancellation; no silent account merge. Keep screenshots free of credentials and personal data.
- [ ] Prove native focus/background/foreground, widget completion and Live Activity pause/complete against server-confirmed state, including failure and logged-out behavior.
- [ ] With explicit user interaction consent, test separate HealthKit opt-ins: mindful export idempotency, sleep-read flow, unavailable/denied/revoked access and local reminder. Do not upload samples or record their contents as QA evidence. Leave K04 partial if its stated proof is still absent.
- [ ] Test installed-PWA push and native local notifications separately on the physical device: permission, quiet hours/privacy, rescheduling/cancellation and observed delivery. No APNs expansion without a separate approved requirement.

Only then update 7B/8B and the relevant evidence ledger rows. Simulator screenshots cannot close these tasks.

### Task 7.3 — Native distribution and review readiness

- [ ] Run `pnpm ios:release:preflight` and `./scripts/ios-main-thread-gate.sh` against the intended revision.
- [ ] From a clean release checkout, run the documented `pnpm ios:release archive` then `pnpm ios:release export` when signing is available. Inspect signatures, entitlements, widget/app identities, privacy manifests, version/build and embedded provenance.
- [ ] Prepare store screenshots, accurate supported-feature copy, privacy/support links, review instructions and a synthetic review account process. Do not advertise disabled providers or unverified HealthKit features.
- [ ] Upload only when explicitly authorized using `pnpm ios:release upload`. Record Apple validation, processing and TestFlight availability separately. Public App Store submission/release is a further explicit action, not implied by an upload.

## P8. Final acceptance and maintenance handoff

- [ ] Run the full web/contract/E2E/native release matrix on the final candidate and inspect the matching CI jobs. Rerun only affected gates after later changes, with final required commit gates respected.
- [ ] Run the evidence-based parity audit. Independently review each full-credit platform row; repair unsupported claims and implement mandatory missing acceptance until each platform reaches ≥85%. Do not delete denominator rows to make the gate pass.
- [ ] Re-run the full synthetic daily-planner journey across web/native and recovery scenarios. Record unresolved low-severity issues explicitly; no P0/P1 remains.
- [ ] Confirm fresh operations evidence: backups/restore, worker execution/delivery, alerts, migrations and rollback instructions. A configured monitor without observed execution is not verified.
- [ ] For an authorized deployment verify exact provenance plus changed live behavior. Distinguish local acceptance, CI, web deployment, device proof, TestFlight and public launch in the final report.
- [ ] Update this program, original roadmap where justified, parity evidence and `progress.md`. Create a concise support/incident handoff covering login recovery, notification troubleshooting, export/deletion, rollback escalation and next maintenance work.

Do not create recurring monitors or scheduled tasks from this plan without a user request. If an external gate remains blocked, report the completed local scope and exact remaining gate; never label the entire app production-ready.
