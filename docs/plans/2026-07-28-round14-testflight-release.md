# Round 14 — Verifiable TestFlight Release Implementation Plan

> **Execution:** Follow this plan in order on
> `codex/round14-testflight-release`. Use test-driven development for every
> behavioral change. Preserve logs and release artifacts locally, but do not
> commit generated archives, IPAs, screenshots, recordings, or credentials.

**Goal:** Make Kairo's real iOS target distributable, privacy-declared, and
artifact-verifiable; publish a truthful public privacy policy; deploy the exact
release SHA; and upload to TestFlight only if Apple accepts and processes it.

**Binding inputs:** ADR-003, ADR-005, `docs/design/design-spec.md`,
`docs/plans/2026-07-28-round14-testflight-release-design.md`,
`docs/DEPLOYMENT.md`, and Apple's current privacy-manifest and Xcode
distribution documentation.

## Execution status

- [x] Task 1 — repository-backed release contract
- [x] Task 2 — accurate privacy manifest and native policy model
- [x] Task 3 — public privacy policy and links
- [x] Task 4 — deterministic archive, export, and upload driver
- [x] Task 5 — release artifact verification
- [x] Task 6 — browser and design-quality verification
- [x] Task 7 — truthful handoff prepared; integration, deployment, and Apple
      state are verified after this immutable source commit and reported as
      post-commit evidence

Release evidence is split deliberately: repository checks and the signed
artifact pipeline can be recorded here, while the exact deployed SHA, Apple
upload acceptance, and TestFlight processing necessarily occur after the
source commit exists. Those post-commit states must be reported from their
live systems and never backfilled by inference.

## Task 1 — Repository-backed release contract

**Files**

- Create: `tests/ios-release-contract.test.ts`
- Create: `scripts/ios-release-contract.mjs`
- Modify: `package.json`

**Steps**

1. Write failing Vitest coverage for:
   - exact application and widget bundle identifiers;
   - marketing version and positive integer build number;
   - HealthKit and App Group entitlements;
   - both Health usage descriptions;
   - expected privacy-manifest collection and required-reason declarations;
   - provenance keys in the app Info.plist;
   - missing or malformed contract fields with actionable diagnostics.
2. Run the focused test and record the expected RED result because the module
   or contract fields do not exist.
3. Implement a pure parser/validator plus a CLI entrypoint that reads the real
   repository files. Keep archive inspection as a separate exported function
   so the shell release driver uses the same assertions.
4. Add `ios:release:preflight` to `package.json`.
5. Run the focused tests to GREEN and commit:
   `test(R14): define the native release contract`.

## Task 2 — Accurate privacy manifest and native policy model

**Files**

- Create: `ios/App/PrivacyInfo.xcprivacy`
- Create: `ios/Widget/PrivacyInfo.xcprivacy`
- Modify: `ios/App/Info.plist`
- Modify: `ios/project.yml`
- Modify: `ios/Kairo/Sources/Kairo/ReleasePreflight.swift`
- Modify: `ios/Kairo/Tests/KairoTests/PreflightTests.swift`
- Modify: `ios/Kairo/Tests/KairoTests/ViewTests.swift`

**Steps**

1. Extend the release-contract test with the exact declarations approved in
   the design: tracking disabled; email, user ID, other user content, and
   product interaction; `CA92.1` and `1C8F.1`; no Health data collection.
2. Write failing Swift tests that remove false Universal Links, Sign in with
   Apple, and remote-push gates and require the actual app's privacy, App
   Group, HealthKit, and Health-purpose-string gates.
3. Run both focused suites and record RED.
4. Add executable-scoped app and widget privacy manifests plus provenance
   placeholders, wire build settings into the real targets, and correct the
   old Swift policy model and bundle identifier.
5. Add `@MainActor` isolation to the pre-existing view tests so Swift 6 release
   validation is warning-clean.
6. Run `plutil -lint`, the focused Vitest suite, and the Swift package suite to
   GREEN. Commit:
   `feat(R14): declare the native privacy contract`.

## Task 3 — Public privacy policy and links

**Files**

- Create: `src/lib/privacy-policy.ts`
- Create: `tests/privacy-policy.test.ts`
- Create: `src/app/privacy/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `ios/App/Features/More/SettingsView.swift`
- Modify: relevant web and native UI tests

**Steps**

1. Write failing tests for the public policy's required sections, exact Health
   boundary, service disclosures, no-sale/no-ad-tracking promise, retention,
   export/deletion, contact, update date, and prohibition on unearned
   certifications.
2. Add a failing route/UI assertion for one H1, sequential H2 headings,
   semantic landmarks, privacy link in the landing footer, and native Settings
   policy link.
3. Run the focused tests and record RED.
4. Implement the typed policy content and token-only Soft Focus page:
   one clear heading, summary card, sticky contents rail on desktop, single
   column on mobile, 16px minimum body copy, 44px link targets, and visible
   focus states.
5. Add footer and native Settings links without changing authenticated data
   behavior.
6. Run focused tests, lint, typecheck, and native compile to GREEN. Commit:
   `feat(R14): publish Kairo privacy policy`.

## Task 4 — Deterministic archive, export, and upload driver

**Files**

- Create: `scripts/ios-release.sh`
- Create: `tests/ios-release-script.test.ts`
- Modify: `.gitignore`
- Modify: `ios/README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `package.json`

**Steps**

1. Write failing tests around a dry-run command planner for `preflight`,
   `archive`, `export`, and `upload`, including:
   - deterministic build-number selection;
   - clean-tree enforcement;
   - isolated DerivedData and artifact locations;
   - `app-store-connect` export method;
   - `export` versus `upload` destination;
   - no credential values in output;
   - refusal to upload without a verified archive.
2. Run the focused suite and record RED.
3. Implement the shell driver with strict mode, durable logs, XcodeGen,
   automatic signing, explicit provenance, generated export-options plist,
   archive inspection through `ios-release-contract.mjs`, codesign entitlement
   checks, IPA export, and upload status reporting.
4. Git-ignore `artifacts/ios-release/`. Replace the inaccurate
   `Package.swift → Archive` and “not set up” README guidance with the real
   target and commands. Document prerequisites and failure boundaries.
5. Run focused tests, `bash -n`, preflight, and dry-run modes to GREEN. Commit:
   `build(R14): automate signed iOS distribution`.

## Task 5 — Release artifact verification

**Local artifacts**

- `artifacts/ios-release/Kairo.xcarchive`
- `artifacts/ios-release/export/Kairo.ipa`
- `artifacts/ios-release/logs/`

**Steps**

1. Run all web gates:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Run parity and full Swift package tests.
3. Generate the Xcode project, run the app-hosted unit suite and serial UI
   suite in isolated DerivedData, and scan logs for Main Thread Checker or
   release warnings.
4. Run an unsigned generic-device build and the signed physical-device build.
5. With a clean release commit, run `archive` and `export`.
6. Inspect and record:
   - app/extension bundle IDs, version, and build;
   - git SHA and build timestamp;
   - embedded widget;
   - app and widget privacy manifests;
   - App Group and HealthKit entitlements;
   - signing identity and `codesign --verify`;
   - exported IPA contents.
7. Run Apple's validation/upload path. If Apple rejects it, preserve and report
   the exact error without weakening any gate. If accepted, poll until the
   build is processed or Apple reports a terminal failure.

## Task 6 — Browser and design-quality verification

**Artifacts**

- `browser-qa/round14-release/privacy-desktop.png`
- `browser-qa/round14-release/privacy-mobile.png`
- `browser-qa/round14-release/privacy-keyboard.png`
- `browser-qa/round14-release/results.json`

**Steps**

1. Start the production build locally and test `/privacy` in a real browser at
   1440×1000 and 390×844.
2. Verify heading order, landmarks, all links, keyboard traversal, visible
   focus, reduced-motion behavior, horizontal overflow, console errors, failed
   requests, and both light/dark schemes.
3. Capture and visually inspect actual desktop and mobile screenshots.
4. Run the design-system procedure checks:
   polish, accessibility, interaction states, hierarchy/rhythm, and AI-slop.
5. Fix any real issue test-first and repeat the affected checks.

## Task 7 — Truthful handoff, integration, deployment, and live proof

**Files**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md` only if evidence changes a score
- Modify: `docs/plans/progress.md`
- Modify: this plan's checkboxes/status

**Steps**

1. Correct the roadmap's Phase 7F/8D language so a checked historic tranche
   cannot imply current App Store distribution. Record Round 14 evidence and
   every external blocker in `progress.md`; do not inflate parity for release
   tooling.
2. Re-run the full verification matrix after documentation changes.
3. Request a code review using the review skill and address verified findings.
4. Commit the final handoff:
   `docs(R14): record release evidence and blockers`.
5. Integrate the branch into `main` without discarding unrelated work, push
   `main`, trigger the documented Coolify deployment, and wait for the exact
   SHA to become healthy.
6. Verify live:
   - `/privacy` desktop and mobile;
   - landing footer privacy link;
   - `/api/health`;
   - security headers;
   - deployed revision/exact SHA.
7. Report separately:
   - repository and web production status;
   - archive and IPA status;
   - Apple upload/processing status;
   - any still-user-controlled HealthKit or App Store Connect steps.

## Definition of done

- The final deployed SHA passes all web/native gates.
- `/privacy` is live, accurate, responsive, keyboard-usable, and linked from
  web and iOS.
- The shipped app and widget executables contain their approved privacy
  manifests, and the app contains verifiable git/build provenance.
- A signed `.xcarchive` and App Store Connect `.ipa` pass local inspection.
- “TestFlight uploaded” appears only with Apple's accepted upload evidence;
  “available in TestFlight” appears only after processing completes.
- Generated release and QA artifacts remain uncommitted.
