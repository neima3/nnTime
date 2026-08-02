# Round 55 — Canonical activity edit hardening

## Status

Approved for implementation on 2026-08-01 as the next unblocked production-readiness tranche.

## Problem

The canonical activity create path validates category and tag ownership and persists every supported series field. The corresponding edit path does not yet provide the same guarantees:

- `all` and `this_and_future` edits accept nested category/tag identifiers without verifying that they belong to the authenticated user.
- `this_and_future` creates a successor from a narrow subset of the old series rather than cloning the complete master. Required fields can be omitted and optional template fields can be lost.
- The split updates the old master but only appends a sync change for the new master.
- PATCH converts `dtstartLocal` and `rdate` strings, but not `exdate` date strings.
- PATCH and DELETE accept malformed `If-Match` values; PATCH also accepts malformed idempotency keys.
- The PATCH response for `this_and_future` returns the truncated predecessor, leaving clients without the canonical successor identifier.

These gaps violate ADR-001 recurrence semantics, ADR-002 sync expectations, and ADR-005 nested-resource ownership.

## Options considered

### A. Harden only route validation

This is small, but it would leave the data-loss and authorization failures inside the recurrence service. Rejected because route-only validation is not a trustworthy boundary for reusable domain code.

### B. Replace recurrence editing with a broader mutation framework

This could unify all resources, but it expands the risk and delays the specific integrity fix. Rejected for this round; the resulting service contract can inform a later mutation audit.

### C. Make recurrence edits transactionally canonical

Selected. Keep the existing public edit-scope API while making the service responsible for ownership validation, full successor inheritance, optimistic concurrency, and sync logging. Tighten the route edge and return the actual affected master.

## Design

### Service result

`editSeriesOccurrence` will return the active master identifier and revision after the mutation. For `all` and `this`, this is the original series. For `this_and_future`, this is the new successor. The route uses that identifier for the response and ETag.

### Ownership and atomicity

The nested activity-reference validator becomes a shared DAL export. Recurrence edits call it inside the same transaction as the mutation:

- `all` validates only reference fields included in the patch.
- `this_and_future` validates the effective successor references after inheritance and patch overlay.
- `this` does not accept category or tag fields because occurrence overrides do not contain them.

Any invalid category or tag causes a `NotFoundError` and rolls back the complete edit, including predecessor truncation.

### Full successor inheritance

The split successor is built from an explicit allowlist of every canonical master field: timezone, recurrence fields, title/template metadata, category, duration, checklist, energy, priority, tags, notes, source, and source reference. The requested patch overlays that snapshot.

Identity, ownership, lifecycle, timestamps, revision, and deletion fields are never copied. The successor receives a new UUID, revision 1, and starts at the selected occurrence unless the edit explicitly supplies a new `dtstartLocal`.

The predecessor is truncated with an optimistic revision predicate. COUNT-based
rules are reduced to the remaining generated occurrence count, and RDATE values
are partitioned around the split so neither master owns dates on the wrong side.
Arbitrary split keys are rejected. The same transaction:

1. updates and sync-logs the predecessor,
2. inserts and sync-logs the successor,
3. moves overrides at or after the split while preserving `occurrence_key`.

### Route boundary

PATCH and DELETE reject `If-Match` unless it is a canonical positive integer. PATCH rejects a present `Idempotency-Key` unless it is a UUID. PATCH coerces `exdate` values to date objects consistently with create, and returns the master identified by the service result.

Occurrence-only mutations atomically bump the master revision before writing the
override, so two callers cannot both succeed with one If-Match value. Imported
calendar activities are read-only at this public mutation boundary.

Planner history remains scoped to occurrence status changes and uses the mutated master identifier. Existing idempotency semantics remain unchanged.

DELETE defaults to the safe `this` scope and requires an `occurrenceKey` for
`this` and `this_and_future`. The web editor explicitly requests `all` for its
whole-activity confirmation. Future-scoped deletion truncates without creating
a successor; whole-series deletion continues through the canonical DAL tombstone.

### Verification

PostgreSQL integration tests will pin:

- complete successor inheritance and patch overlay,
- predecessor and successor change-log entries,
- stable override occurrence identity after a split,
- cross-user category and tag rejection with full rollback for both `all` and `this_and_future`,
- correct successor response/ETag,
- `exdate` coercion,
- malformed concurrency and idempotency headers.

The existing editor flow will receive a real-browser regression pass at desktop and mobile widths. Full repository, native, CI, deploy, and live-health gates remain required before release.

## Non-goals

- Redesigning the activity editor or adding a new recurrence UI.
- Changing ADR-001 edit-scope semantics.
- Refactoring unrelated resource mutations.
- Fixing the signed-out Inbox CTA and stale public preview dates; those are documented in `browser-qa/round55-dogfood/report.md` for the next UX tranche.
