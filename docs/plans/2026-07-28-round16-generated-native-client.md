# Round 16 Generated Native Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipping SwiftUI application use the generated Swift OpenAPI client for every `/api/v1` operation, correct the canonical day contract it consumes, and prove the real app compiles against generated code in CI.

**Architecture:** Keep `KairoAPI` as a stable app-facing actor, retain manual transport only for Better Auth `/api/auth/*`, and adapt generated wire inputs/outputs to typed presentation models. Rename the package module to avoid the app-target collision, inject timezone/cookie transport centrally, and fail CI on any handwritten planner transport.

**Tech Stack:** Next.js 16, TypeScript, zod, OpenAPI 3.1, Swift 6, Swift OpenAPI Generator/Runtime/URLSession, SwiftUI, XcodeGen, Vitest, Swift Testing, XCTest, GitHub Actions.

---

## Execution status

- [x] Task 1 — correct the day and nullable OpenAPI contracts
- [x] Task 2 — make the generated package importable by the shipping app
- [x] Task 2A — align generated mutation and routine-list contracts
- [x] Task 3 — add generated transport infrastructure and tests
- [x] Task 4 — migrate the shipping façade and all feature call sites
- [x] Task 5 — replace the manual inventory with adoption and app-build gates
- [x] Task 6 — full web/native/browser verification and independent review
- [ ] Task 7 — handoff, integration, CI, exact-SHA deploy, and live proof

## Task 1 — Correct the day and nullable OpenAPI contracts

**Files**

- Modify: `src/server/schemas/day.ts`
- Modify: `src/server/schemas/index.ts`
- Create: `src/server/schemas/day-openapi-contract.test.ts`
- Modify: `api/openapi.yaml`
- Regenerate: `ios/Kairo/Sources/Kairo/openapi.yaml`
- Modify: `ios/Kairo/Tests/KairoTests/KairoContractTests.swift`

**Steps**

1. Write failing tests proving the current `DayResponse` document disagrees
   with the route/runtime keys and activity shape.
2. Require `DayActivity` to equal the series response plus occurrence identity
   and status, and require the exact `DayResponse` required/property sets.
3. Add fixtures for the nullable fields currently omitted by fresh Swift
   generation.
4. Run focused tests and record RED.
5. Implement the zod `dayActivityResponse`, exact `dayResponse`, registry
   entry, OpenAPI component, and corrected response keys.
6. Replace unsupported null-only/`oneOf` forms for the affected energy, batch,
   and search fields with generator-supported OpenAPI 3.1 schemas.
7. Sync the package schema, force a clean generation, and add Swift compile
   assertions for `DayActivity`, search, stats, mood, and formerly omitted
   nullable properties.
8. Run the focused Vitest and clean Swift package suites to GREEN with no
   unsupported-schema diagnostics.

## Task 2 — Make the generated package importable by the shipping app

**Files**

- Modify: `ios/Kairo/Package.swift`
- Modify: `ios/Kairo/Tests/KairoTests/*.swift`
- Modify: `ios/project.yml`
- Create or modify: `tests/ios-generated-client-adoption.test.ts`
- Modify: `ios/README.md`
- Modify: `ios/Kairo/README.md`

**Steps**

1. Write failing static tests requiring a local `KairoAPIClient` package
   product and an application-target dependency.
2. Rename the package product/source target to `KairoAPIClient`, preserving
   `Sources/Kairo` through an explicit target path, and update package imports.
3. Declare the local package in XcodeGen and link only the application target
   to its product.
4. Generate the Xcode project and prove SwiftPM dependency resolution.
5. Run package tests and an application simulator build to GREEN before
   changing transport behavior.

## Task 2A — Align generated mutation and routine-list contracts

**Files**

- Modify: `src/server/schemas/index.ts`
- Modify: `src/server/schemas/routine.ts`
- Modify: `src/app/api/v1/routines/route.ts`
- Create: `src/server/schemas/request-openapi-contract.test.ts`
- Modify: `api/openapi.yaml`
- Regenerate: `ios/Kairo/Sources/Kairo/openapi.yaml`
- Modify: `ios/Kairo/Tests/KairoTests/KairoContractTests.swift`

**Steps**

1. Write failing tests proving implemented mutation operations currently reuse
   server-owned response schemas and the routine list drops its nested runtime
   fields during generation.
2. Register distinct request validators/components for create and patch
   operations, preserving each route validator's exact required, optional,
   nullable, and enum semantics.
3. Move the routine POST validator into the shared schema module and add a
   dedicated `RoutineListItem` response with steps, schedules, `stepCount`, and
   `totalMin`.
4. Point every documented mutation request body at an input schema rather than
   a database-row response; use the matching create/update validator for
   deferred documented endpoints as well.
5. Sync the package schema, force clean generation, and add Swift compile
   assertions proving shipping request payloads are constructible without
   server-owned ids, revisions, timestamps, or user ids.
6. Run focused Vitest, canonical-sync, clean generator, and Swift package
   suites to GREEN before resuming transport work.

## Task 3 — Add generated transport infrastructure and tests

**Files**

- Modify: `ios/Kairo/Sources/Kairo/Kairo.swift`
- Create: `ios/Kairo/Sources/Kairo/TimezoneMiddleware.swift`
- Create: `ios/Kairo/Tests/KairoTests/TransportTests.swift`
- Create: `ios/UnitTests/GeneratedAPIAdapterTests.swift`
- Modify: `ios/App/API/Models.swift`
- Create: `ios/App/API/GeneratedAPIAdapters.swift`

**Steps**

1. Write failing Swift tests for:
   - production and overridden `/api/v1` server URLs;
   - shared-cookie URLSession construction;
   - `x-timezone` middleware injection;
   - deterministic mock transport request capture;
   - generated day/settings/activity/task/search/stats/routine/focus adapters;
   - malformed enum/output handling.
2. Run the focused package and app unit tests and record RED.
3. Add transport/session injection to `KairoClient` and implement the
   middleware.
4. Add sendable typed `SettingsUpdate`, `ActivityUpdate`, `FocusCommand`, and
   notification-preference value models.
5. Implement generated-to-presentation adapters without importing generated
   types into feature views.
6. Run the focused Swift tests to GREEN.

## Task 4 — Migrate the shipping façade and all feature call sites

**Files**

- Rewrite: `ios/App/API/KairoAPI.swift`
- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/App/Features/More/SettingsView.swift`
- Modify: `ios/App/Features/Week/WeeklyIntentionsCard.swift`
- Modify: `ios/App/Features/Today/EditorSheet.swift`
- Modify: `ios/App/Features/Focus/FocusView.swift`
- Modify: other feature files only when compilation identifies a generated
  migration call site
- Create or modify: app unit transport tests under `ios/UnitTests/`

**Steps**

1. Write failing mock-transport tests for every currently shipping planner
   operation, including headers, query values, request bodies, response
   adaptation, and 401/409/error-envelope mapping.
2. Run RED against the manual actor.
3. Isolate the existing generic request helper as Better Auth-only
   `authRequest`; it must reject or be incapable of planner paths.
4. Route settings, categories, day, activities, tasks, search, stats, mood,
   routines, and focus through generated operations.
5. Generate one idempotency key per logical mutation and send generated
   `If-Match` fields on conditional writes.
6. Replace dynamic settings/activity/focus dictionaries at feature call sites
   with typed app requests.
7. Remove the direct categories request and all `/api/v1` literals from
   `ios/App`.
8. Run package and app unit tests, then compile the shipping app to GREEN.

## Task 5 — Replace manual inventory with adoption and app-build gates

**Files**

- Replace: `scripts/ios-manual-api-contract.mjs`
- Replace: `tests/ios-manual-api-contract.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/ci-native-contract.test.ts`

**Steps**

1. Write failing Vitest coverage that scans all shipping Swift source and
   rejects any `/api/v1` literal or direct planner request.
2. Require the façade's generated-operation inventory to contain all current
   planner operations, including categories that the old scanner missed.
3. Require CI to clean the Swift package before generation, run XcodeGen, and
   compile/test the application target on a simulator.
4. Run focused tests and record RED.
5. Implement the generated-client adoption CLI and update the package script
   name while retaining a temporary compatibility alias if documentation
   still references the old command.
6. Strengthen the macOS job without weakening Linux web/e2e jobs.
7. Run static CI tests, clean package tests, Xcode generation, and app build to
   GREEN.

## Task 6 — Full web/native/browser verification and independent review

**Local evidence**

- `browser-qa/round16-generated-native-client/`
- ignored Xcode/Swift logs and DerivedData

**Steps**

1. Run:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Run:
   `pnpm api:check-ios`,
   the generated-client adoption check,
   `swift package clean --package-path ios/Kairo`, and
   `swift test --package-path ios/Kairo`.
3. Recompute parity with `node scripts/parity.mjs`; contract/tooling alone does
   not earn a feature score.
4. Generate the Xcode project, run the app-hosted unit suite, unsigned app
   build, and serial UI smoke suite through the main-thread gate. Scan logs for
   Main Thread Checker diagnostics and Swift generation warnings.
5. Against synthetic local data, authenticate and exercise:
   - settings and categories bootstrap;
   - day decode/render;
   - activity and task mutation paths;
   - search, stats, mood, routines, and focus.
6. Capture and visually inspect desktop/mobile web and native screenshots;
   keep evidence git-ignored.
7. Request independent code review and address every verified finding with
   focused regression tests.
8. Repeat the full verification matrix after review fixes and documentation.

## Task 7 — Handoff, integration, CI, exact-SHA deploy, and live proof

**Files**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: this plan's execution status
- Modify: `docs/plans/parity-checklist.md` only if evidence changes a score

**Steps**

1. Record the corrected contract, generated-client adoption boundary, exact
   test counts, browser/native evidence, and honest remaining work.
2. Run the complete verification matrix after documentation changes.
3. Commit the immutable handoff, integrate without discarding unrelated work,
   and push `main`.
4. Wait for every required GitHub Actions job, including the clean native app
   build, to pass on the exact SHA.
5. Trigger the documented Coolify deployment and wait for that exact SHA to be
   `finished` and `running:healthy`.
6. Verify production read-only:
   - `/api/health`, migrations, database, AI, and scheduler;
   - deployed revision/exact SHA;
   - authenticated settings, categories, day, and stats reads;
   - desktop/mobile app UI, security headers, console, and failed network
     state.
7. Do not mutate production planner data or post mood. Report synthetic local
   mutation proof separately.

## Definition of done

- The canonical day schema matches the live route and generates the complete
  Swift read model without unsupported-null omissions.
- The real application imports `KairoAPIClient`.
- No handwritten `/api/v1` path, request, query, header, body, or response
  decoder remains in `ios/App`.
- Generated operations carry timezone, idempotency, and conditional revision
  headers.
- App-facing models and visual behavior remain stable.
- Clean generated package and shipping app compilation run in CI.
- Full web, native, browser, and review gates are green.
- The exact committed SHA is pushed, deployed, healthy, and verified through
  read-only production checks.
