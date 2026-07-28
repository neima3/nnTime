# Round 15 — Executable Native API Contract Implementation Plan

> **Execution:** Follow this plan in order on `codex/round15-api-contract`.
> Use test-driven development for every behavior change. Do not commit
> generated build output, QA captures, credentials, or local signing config.

**Goal:** Make ADR-002 executable across the server, canonical OpenAPI
document, generated Swift package, shipping manual Swift client, and CI so API
contract drift fails before release.

**Binding inputs:** ADR-002, ADR-003,
`docs/plans/2026-07-28-round15-api-contract-design.md`,
`docs/DEPLOYMENT.md`, and the existing route/auth/schema conventions.

## Execution status

- [x] Task 1 — canonical-to-Swift spec synchronization
- [x] Task 2 — shared stats and mood runtime contract
- [x] Task 3 — canonical OpenAPI stats and mood operations
- [x] Task 4 — shipping manual-client operation inventory
- [x] Task 5 — generated Swift client CI gate
- [x] Task 6 — full local/native/browser verification
- [x] Task 7 — review, handoff, integration, deployment, and live proof

## Task 1 — Canonical-to-Swift spec synchronization

**Files**

- Create: `scripts/sync-ios-openapi.mjs`
- Create: `tests/ios-openapi-sync.test.ts`
- Modify: `package.json`
- Regenerate: `ios/Kairo/Sources/Kairo/openapi.yaml`

**Steps**

1. Write failing Vitest coverage that:
   - proves the current package-local spec differs from `api/openapi.yaml`;
   - requires check mode to fail with an actionable sync command on drift;
   - requires sync mode to produce exact byte equality;
   - operates on temporary paths so tests never mutate tracked source files.
2. Run the focused test and record RED because the sync module does not exist.
3. Implement a pure compare/sync module plus CLI:
   - default canonical and native paths resolved from repository root;
   - atomic copy through a sibling temporary file and rename;
   - `--check` makes no writes and exits non-zero on drift;
   - unknown arguments and missing source files fail clearly.
4. Add `api:sync-ios` and `api:check-ios` package scripts.
5. Run the focused suite to GREEN, run the real sync command, then prove
   `pnpm api:check-ios` passes.

## Task 2 — Shared stats and mood runtime contract

**Files**

- Create: `src/server/schemas/stats.ts`
- Create: `src/server/schemas/stats.test.ts`
- Modify: `src/server/schemas/index.ts`
- Modify: `src/app/api/v1/stats/route.ts`
- Modify: `src/app/api/v1/mood/route.ts`
- Create or modify: focused route tests under `src/app/api/v1/`

**Steps**

1. Write failing schema tests for:
   - default, minimum, and maximum integer `days`;
   - rejection of non-numeric, fractional, zero, negative, and >90 values;
   - valid complete stats payload including 24-hour vectors;
   - rejection of malformed vectors, negative counts, invalid moods, and
     overlong notes;
   - exact `{ ok: true }` mood acknowledgement.
2. Write failing route tests proving:
   - missing `days` uses 14;
   - valid `days` reaches the stats service with a matching date range;
   - invalid `days` returns the standard 400 envelope without calling the
     stats service;
   - mood uses the shared body validator.
3. Run focused tests and record RED.
4. Implement the shared schemas and exports. Register `StatsResponse`,
   `MoodCheckinRequest`, and `MoodCheckinResponse`.
5. Update the routes to use shared schemas, standard 400 validation responses,
   response parsing, and existing private/no-store headers.
6. Run focused tests to GREEN.

## Task 3 — Canonical OpenAPI stats and mood operations

**Files**

- Modify: `api/openapi.yaml`
- Modify: `src/server/schemas/openapi-inventory.test.ts`
- Modify: `src/server/schemas/contract-parity.test.ts` only if its explanatory
  allowlist needs an accurate request-component distinction
- Regenerate: `ios/Kairo/Sources/Kairo/openapi.yaml`

**Steps**

1. Extend focused contract tests first so RED requires:
   - `GET /stats` with an optional bounded integer `days` query;
   - `POST /mood` with request/response components and 201;
   - both operations' authentication and standard error responses;
   - removal of stats/mood from the handler-only allowlist.
2. Add the paths and exact component shapes to the canonical OpenAPI document.
   Keep nested stats types inline unless a separately named type adds genuine
   reuse.
3. Remove `/api/v1/stats` and `/api/v1/mood` from
   `HANDLERS_WITHOUT_OPENAPI`.
4. Sync the Swift package copy from the canonical document.
5. Run schema, parity, inventory, and sync tests to GREEN.

## Task 4 — Shipping manual-client operation inventory

**Files**

- Create: `tests/ios-manual-api-contract.test.ts`
- Modify: `ios/App/API/KairoAPI.swift` only if a small formatting change is
  necessary to make the contract literal and statically inspectable

**Steps**

1. Write a failing test that parses canonical OpenAPI operations and scans
   `KairoAPI.swift` for:
   - `request("METHOD", "/api/v1/...")` method/path pairs;
   - every `/api/v1/...` path literal, including direct `URLRequest` usage;
   - interpolated Swift path segments normalized to OpenAPI parameters.
2. Require every extracted operation and path to be documented and require a
   critical minimum inventory so an empty/broken parser fails.
3. Run RED; stats and mood must be the concrete undocumented failures before
   Task 3 is applied, or use the pre-change fixture in the focused test if Task
   3 has already made the real source green.
4. Implement only the smallest source formatting adjustment needed, if any.
   Do not introduce a second handwritten endpoint manifest.
5. Add negative fixtures for an undocumented method, undocumented path, and
   broken interpolation normalization.
6. Run the focused suite to GREEN.

## Task 5 — Generated Swift client CI gate

**Files**

- Modify: `.github/workflows/ci.yml`
- Modify: `ios/Kairo/README.md`
- Modify: `docs/adr/ADR-002-api-contract.md` or the actual ADR-002 filename

**Steps**

1. Add a static workflow test or focused source assertion first requiring a
   macOS `native-contract` job with:
   - checkout;
   - Node/pnpm setup sufficient for the spec check;
   - `pnpm api:check-ios`;
   - `swift test --package-path ios/Kairo`.
2. Run RED against the current workflow.
3. Add the independent macOS job without slowing or weakening the Linux
   web/e2e jobs.
4. Correct documentation: the package copy is generated input, the canonical
   file is edited, sync/check commands are required, and generated Swift
   compilation is now enforced in CI.
5. Run the static workflow test, `pnpm api:check-ios`, and local
   `swift test --package-path ios/Kairo` to GREEN.

## Task 6 — Full local, native, and browser verification

**Local evidence**

- `browser-qa/round15-api-contract/`
- Xcode/Swift logs in ignored local artifact directories

**Steps**

1. Run:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Run:
   `pnpm api:check-ios`,
   `swift build --package-path ios/Kairo`, and
   `swift test --package-path ios/Kairo`.
3. Recompute parity with `node scripts/parity.mjs`; do not change scores for
   contract/tooling work.
4. Generate the Xcode project and run the app-hosted native unit suite and
   serial UI suite using the repository's main-thread gate. Scan output for
   Main Thread Checker diagnostics.
5. Start the production web build against synthetic/local data. In a real
   muted browser at desktop and 390px mobile:
   - authenticate;
   - open stats and confirm the GET response decodes/renders;
   - exercise invalid `days` directly and verify a 400 envelope;
   - exercise mood only against synthetic/local data;
   - capture console, failed-network, response, and screenshot evidence.
6. Visually inspect screenshots and keep all QA artifacts git-ignored.

## Task 7 — Review, handoff, integration, deployment, and live proof

**Files**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: this plan's execution status
- Modify: `docs/plans/parity-checklist.md` only if evidence honestly changes a
  score

**Steps**

1. Record Round 15 under the roadmap's production-hardening evidence without
   inventing a new feature-parity score. Update the progress log with exact
   test counts and the remaining generated-client migration boundary.
2. Run the full verification matrix after documentation changes.
3. Request an independent code review using the review skill and address every
   verified finding.
4. Commit the immutable handoff, integrate it into `main` without discarding
   unrelated work, and push `main`.
5. Confirm GitHub Actions runs the new macOS native-contract job successfully.
6. Trigger the documented Coolify deployment and wait for the exact source SHA
   to reach `finished` and `running:healthy`.
7. Verify production read-only:
   - `/api/health`, migrations, database, AI, and scheduler;
   - deployed revision/exact SHA;
   - authenticated `GET /api/v1/stats` with no mutation;
   - stats UI at desktop and mobile;
   - security headers, console, and failed-network state.
8. Do not POST mood in production. Report local synthetic mutation proof
   separately from read-only live proof.

## Definition of done

- `api/openapi.yaml` is the only authored spec and the Swift package copy is
  byte-identical generated input.
- Stats and mood have shared zod/OpenAPI request and response contracts.
- Invalid stats query input fails with a standard 400 instead of an internal
  error.
- Every shipping manual `/api/v1` operation is checked against OpenAPI.
- GitHub Actions compiles and tests generated Swift OpenAPI code on macOS.
- Full web, native, browser, and contract gates are green.
- The exact committed SHA is pushed, deployed, healthy, and verified through
  read-only production checks.
