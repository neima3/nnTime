# Round 16 — Generated Native Client Migration Design

**Status:** approved for autonomous execution under the standing production-
readiness goal.
**Owner:** Codex
**Date:** 2026-07-28

## Problem

Round 15 made `api/openapi.yaml` canonical, synchronized it into the Swift
package, compiled generated code in CI, and checked the shipping app's manual
method/path inventory. It intentionally stopped before using that generated
client in the real app. The remaining boundary is now concrete:

- `ios/App/API/KairoAPI.swift` still hand-builds every `/api/v1` URL, query,
  header, JSON body, status switch, and response decode;
- `ios/App/KairoApp.swift` bypasses that actor with a second direct request for
  categories, which the Round 15 scanner never inspected;
- the Xcode app target does not depend on the generated Swift package, so CI can
  prove generated code compiles without proving the shipping app uses it;
- the package module and application target are both named `Kairo`, preventing
  the application from importing the package cleanly;
- the canonical `DayResponse` is not the response returned by the route. The
  document says `tz`, `startUtc`, `endUtc`, and bare
  `ActivityOccurrence` rows, while production returns `zone`, `start`, `end`,
  series-shaped day activities with `occurrenceKey` and `status`, plus a
  compatibility status map;
- fresh generation emits warnings and silently omits nullable `energy`,
  `BatchResult.body`, and `SearchResponse.nextCursor` fields because a few
  schemas express nullability in unsupported forms;
- native CI compiles the package but does not generate and compile the real
  Xcode application target.

This is production risk. A generated package that is unused, incomplete, or
based on a mismatched day contract does not protect the native app from runtime
drift.

## Options considered

1. **Generated transport with an app-facing adapter façade — selected.**
   Import the generated package into the shipping target, route all `/api/v1`
   operations through generated inputs and outputs, and adapt generated wire
   schemas into the existing view models. This closes transport and schema
   drift while preserving the stable SwiftUI surface.
2. **Use generated models directly throughout every view.** This maximizes
   type reuse but couples presentation code to generator naming, produces
   broad visual-feature churn, and makes future schema regeneration a UI
   migration. The production benefit does not justify the risk.
3. **Migrate endpoints incrementally with dual transports.** This reduces each
   edit but leaves two status/error/header implementations and makes it unclear
   which boundary CI protects. Round 16's purpose is to remove that split.

## Contract correction

The live day read model is a dedicated schema, not an
`ActivityOccurrence` database row. Add `DayActivity` as the activity-series
response shape extended with:

- `occurrenceKey`, the stable original occurrence instant;
- `status`, the occurrence state applied to that expansion.

`DayResponse` then documents the exact route keys:
`date`, `zone`, `start`, `end`, `activities`, `anytimeTasks`, and
`occurrenceStatusBySeries`. The zod schema uses the same `DayActivity` shape,
and focused tests compare the complete OpenAPI property/required sets with the
runtime schema and a representative route payload. This is a deliberate
deep-shape test for the shipping read model, beyond the existing name-only
registry check.

Nullable enum/reference and free-form fields used by generation move to
generator-supported OpenAPI 3.1 forms. A clean generation must produce the
expected Swift properties without the current unsupported-null warnings.
`SearchResponse.nextCursor` remains semantically always null but is represented
as a nullable string so the Swift type can decode the server's null value.

## Package and application boundary

The package remains at `ios/Kairo`, but its library product and source target
become `KairoAPIClient`. The physical source directory remains
`Sources/Kairo`; `Package.swift` supplies the explicit path. Existing package
tests import the renamed module.

`ios/project.yml` declares the local package and the application target depends
on the `KairoAPIClient` product. The application can then use qualified
generated names without colliding with its own `Kairo` module. The widget does
not import the network package.

The package's `KairoClient` owns generated-client construction:

- production remains the default server;
- the app can supply its local-development `/api/v1` base URL;
- URLSession uses shared cookie storage so Better Auth sessions continue to
  authenticate generated calls;
- a generated-client middleware injects `x-timezone` consistently;
- tests can supply a custom OpenAPI transport and inspect exact generated
  requests without real network access.

## Shipping façade

`KairoAPI` remains the actor used by views. Better Auth is intentionally not in
the `/api/v1` OpenAPI contract, so sign-in, sign-up, and sign-out retain a
small manual `authRequest` implementation under `/api/auth/*`. Every planner
operation uses the generated `Client`:

- settings and categories;
- day and activity creation/update/status/move/checklist/delete;
- task list/create/delete;
- search, stats, mood, and routines;
- active/start/update focus.

Generated operation inputs own paths, queries, conditional headers,
idempotency headers, and JSON bodies. Mutation idempotency keys are generated
once per logical façade call. Conditional activity, task, and settings writes
carry the caller's revision through generated `If-Match` header fields.

The façade uses small typed app requests for the three currently dynamic
dictionaries:

- `SettingsUpdate` for preferences and formatting;
- `ActivityUpdate` for editor changes;
- `FocusCommand` for transition and extension actions.

This removes arbitrary wire dictionaries without forcing generated type names
into feature views. Generated output adapters preserve the existing
`UserSettings`, `DayResponse`, `Activity`, `TaskItem`, `SearchResponse`,
`StatsResponse`, `Routine`, and `FocusSnapshot` presentation models.
Notification preferences use the OpenAPI runtime's sendable JSON object
container rather than `[String: Any]`.

## Error behavior

Generated output enums are normalized in one place:

- every documented 401 becomes `APIError.unauthorized`;
- every documented 409 becomes `APIError.conflict`;
- documented validation/not-found failures preserve their status and standard
  envelope message;
- undocumented status codes preserve the actual status;
- transport errors become `APIError.network`;
- generated-body/adaptation failures become `APIError.decoding`.

No feature view switches on generated response enums. This keeps recovery copy
and conflict behavior stable across the migration.

## Drift gates and CI

Replace the manual-operation validator with a generated-client adoption gate
that scans every `ios/App/**/*.swift` file. It fails when:

- any `/api/v1` string literal remains in the shipping application;
- any direct planner `URLRequest` remains outside the isolated Better Auth
  transport;
- the shipping façade does not reference the required generated operations;
- the local package dependency or module import is removed.

The macOS native job runs canonical sync checks, clean Swift generation/tests,
XcodeGen, and a simulator application/unit-test build. A clean package build is
required so stale plugin output cannot hide missing newly documented
operations. UI tours remain in the release matrix rather than every CI push,
but the shipping application must compile on every change.

## Compatibility and rollout

- No web route URL or database change.
- No visual redesign and no feature removal.
- Better Auth cookie behavior remains manual and unchanged.
- The environment override remains the web origin; the generated client derives
  its `/api/v1` server URL from it.
- App-facing view models remain stable.
- Production verification is read-only: authenticated day/settings/stats
  reads are allowed; mood and planner mutations are exercised only against
  synthetic local data.

## Verification

- Test-driven contract correction, nullable-generation fixtures, middleware,
  request transport, adapter, error mapping, and adoption-gate coverage.
- Full web gate:
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Forced clean Swift generation and package tests.
- XcodeGen plus app-hosted unit tests and application/UI smoke builds with Main
  Thread Checker scan.
- Local synthetic authenticated browser/API proof for the corrected day read
  model and mutation paths.
- Independent code review.
- Exact-SHA push, green GitHub Actions, Coolify deployment, and read-only live
  health/API/browser verification.

## Completion boundary

Round 16 is complete when the shipping application contains no handwritten
`/api/v1` transport, the corrected day schema generates and decodes the live
shape, the real app imports and compiles against the generated package in CI,
all local/native/browser gates pass, and the exact reviewed SHA is healthy in
production.

The future offline replay engine may use the generated `/batch` and `/changes`
operations, but implementing a new sync queue is outside this transport
migration.
