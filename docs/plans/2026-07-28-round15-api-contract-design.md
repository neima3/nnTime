# Round 15 — Executable Native API Contract Design

**Status:** approved for autonomous execution under the standing production-
readiness goal.
**Owner:** Codex
**Date:** 2026-07-28

## Problem

ADR-002 says `api/openapi.yaml` is the versioned REST source of truth, the
Swift client is generated from it, and CI fails on drift between the spec,
zod, handlers, and native client. The repository does not currently uphold
that contract:

- the shipping SwiftUI app manually calls `/api/v1/stats` and
  `/api/v1/mood`, but neither endpoint exists in the canonical OpenAPI file;
- `ios/Kairo/Sources/Kairo/openapi.yaml` is a hand-copied second source and is
  already missing the canonical `/search` operation and schemas;
- the route inventory allowlists stats and mood as undocumented product extras
  even though they are public, authenticated endpoints used by iOS;
- stats has no shared zod request/response schema and accepts a non-numeric
  `days` query as `NaN`, producing an invalid date and an internal error;
- the generated Swift package is not built in GitHub Actions, so a spec that
  Swift OpenAPI Generator cannot compile can still merge;
- the shipping `ios/App/API/KairoAPI.swift` remains a separate manual client,
  with no executable check that its `/api/v1` method/path pairs exist in the
  canonical contract.

This is release risk: a server or spec change can compile on the web, pass CI,
and break the native app only at runtime.

## Options considered

1. **Executable drift gates around the existing clients — selected.** Add the
   missing public contract, share runtime schemas with the handlers, sync the
   generated package from the canonical document, inventory the manual
   client's operations, and compile the generated package on macOS CI. This
   closes the silent-drift paths without destabilizing the release candidate.
2. **Replace the shipping manual client with generated OpenAPI calls now.**
   This is the eventual architectural destination, but it would combine
   authentication transport, tolerant decoding, mutation headers, offline
   behavior, and every native feature call in one migration immediately before
   TestFlight. The risk and QA surface are disproportionate to this hardening
   round.
3. **Document stats and mood but keep copied specs and existing CI.** This
   removes today's visible mismatch but leaves all mechanisms that created it
   intact.

## Contract boundaries

### Canonical source and generated copy

`api/openapi.yaml` remains the only authored OpenAPI document. The Swift
package still needs a target-local `openapi.yaml` for its build plugin, so
`ios/Kairo/Sources/Kairo/openapi.yaml` remains committed as generated input,
not an independently edited contract.

`scripts/sync-ios-openapi.mjs` provides:

- a default sync mode that copies canonical bytes into the package target;
- `--check`, which exits non-zero with an actionable command when bytes differ.

Vitest checks the same invariant, so normal `pnpm test` catches drift. The CI
Swift job runs the check before compilation. Contributors never repair the
copy by hand.

### Public endpoints added this round

The canonical document gains:

- `GET /stats?days=1...90`
- `POST /mood`

Both are authenticated, user-scoped, `private, no-store` endpoints consumed by
the shipping native app. They are therefore public application API, not
private web implementation details, and leave the handler-only allowlist.

Internal jobs, push administration, account deletion/export, AI helpers,
calendar download, task import, and unresolved nested route-shape differences
remain explicitly allowlisted. This round does not claim those are native
public contract.

### Shared runtime schemas

`src/server/schemas/stats.ts` owns:

- the stats query schema and 1–90 day bound;
- every returned aggregate shape, including 24-hour arrays and nullable
  evidence-gated insights;
- the mood enum and optional 500-character note;
- the `{ ok: true }` mood response.

The stats route validates query input and returns the standard 400 envelope for
invalid values instead of reaching the service with `NaN`. It parses the
service result through the shared response schema before serializing. The mood
route imports the shared body and response schemas rather than declaring a
private validator.

The corresponding OpenAPI schemas are named `StatsResponse`,
`MoodCheckinRequest`, and `MoodCheckinResponse`. They enter the zod/OpenAPI
registry so name-level parity continues to fail closed. Focused tests compare
representative valid and invalid wire payloads against both the runtime
schemas and documented constraints.

### Shipping manual-client inventory

A focused Vitest suite scans `ios/App/API/KairoAPI.swift` for literal
`request("METHOD", "/api/v1/...")` calls and all `/api/v1/...` string paths.
Swift interpolation segments normalize to OpenAPI parameters, with parameter
names intentionally ignored (`\(activityId)` matches `{id}`).

The suite requires:

- every extracted method/path pair to exist as an OpenAPI operation;
- every extracted `/api/v1` path literal to match a documented path shape;
- a minimum set of critical native operations (settings, day, activity/task
  mutations, search, stats, mood, routines, and focus) so a parser regression
  cannot pass by finding nothing.

Better Auth `/api/auth/*` calls remain outside ADR-002's `/api/v1` document.
Dynamic endpoint construction is prohibited in the manual client unless the
inventory parser is extended in the same change.

This is a drift guard, not proof that every Swift `Decodable` field has deep
schema equality. Generated-client compilation and native fixture/decode tests
provide the complementary shape checks; full migration to generated operations
is a later, separately planned change.

## CI and local workflow

The existing Linux jobs continue to own lint, TypeScript, Vitest, build, DB
integration, and Playwright. A separate `native-contract` job on a macOS runner
does the minimum platform-specific proof:

1. check the committed Swift spec copy;
2. run `swift test --package-path ios/Kairo`.

This compiles Swift OpenAPI Generator output from the synchronized document and
runs the existing generated-client contract tests. It does not run Xcode UI
tests on every push; those remain part of the release verification matrix
because of their cost and simulator requirements.

Local commands become:

- `pnpm api:sync-ios` after editing `api/openapi.yaml`;
- `pnpm api:check-ios` in verification and CI;
- `swift test --package-path ios/Kairo` for generated-client proof.

## Compatibility and rollout

The new work is additive:

- no route URL changes;
- no response fields removed or renamed;
- no database or migration changes;
- no auth/cookie behavior changes;
- no visual changes;
- the default stats range remains 14 days;
- valid numeric `days` values remain accepted.

The only behavior correction is that malformed, fractional, out-of-range, or
duplicate-invalid `days` input returns a documented 400 rather than falling
through to a 500 or being silently clamped. The web and iOS callers currently
send no `days` value, so they remain on the unchanged default.

## Verification

- TDD for sync/check behavior, stats/mood schemas, route query validation, and
  manual-client operation inventory.
- Focused Vitest RED/GREEN evidence, then the full web gate:
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- `pnpm api:check-ios`.
- Swift package build/test with generated client compilation.
- Existing app-hosted native unit/UI suite and Main Thread Checker scan because
  the shipping client contract is in scope.
- Real-browser authenticated stats and mood smoke at desktop and mobile, with
  console/network evidence and no committed QA artifacts.
- Exact-SHA Coolify deployment, live health, security headers, authenticated
  API smoke without destructive production writes, and deployed-revision
  verification.

Production mood mutation is not used as a smoke test because it writes the
user's real planner history. Mood POST behavior is proven locally with
synthetic data; production checks are read-only.

## Completion boundary

Round 15 is complete when:

- stats and mood are documented and runtime-validated;
- the Swift package spec is byte-identical to the canonical document;
- the shipping manual client's `/api/v1` operations are checked against that
  document;
- generated Swift client compilation is enforced in GitHub Actions;
- all web/native gates pass;
- the exact source SHA is deployed and read-only live health/API/browser checks
  pass.

Replacing the shipping manual client with generated operations, documenting
internal-only endpoints, and removing older aspirational OpenAPI paths without
handlers remain separate follow-on decisions.
