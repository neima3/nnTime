# Kairo — Core workflows for production completion (2026-09-13)

Companion to `2026-09-13-production-completion-program.md`. The product loop
is capture → plan → do → review. These slices close correctness holes in that
loop. They are not a license to add surfaces.

## Do (focus) — P1

| Task | Defect | Binding | Next after service fix |
|---|---|---|---|
| **1.1** | `startFocusSession` accepted any `activityOccurrenceId` and yielded the caller's active session *before* proving ownership. | ADR-005 SEC-01: nested resource, same-predicate `user_id`, cross-user → 404. ADR-004: one active session; a failed start must not cancel it. | Close the service. Then clients. |
| **1.1b** | `POST` / terminal `PATCH` swallowed `appendPlannerEvent` with `.catch(() => {})`. Idempotent replay stored the 201/200 without a history row. | ADR-001: streaks/stats read **only** `planner_events`. ADR-002: `Idempotency-Key` replays the original result — a swallowed write is a permanent hole. | Same transaction as the session mutation. No swallow. |
| **1.2** | Day activities are often *virtual* (ADR-001: no `activity_occurrences` row until override/complete/horizon). Web and iOS start focus without an occurrence id. Native/web linkage cannot send a UUID that does not exist. | Address by `(seriesId, occurrenceKey)` or materialize inside the start transaction. Do not invent a fourth edit scope. | After 1.1 is green. |
| **1.3** | Focus remains server-authoritative. Do not queue start/transition/extend offline. | ADR-002 class 3 — never queued. | Keep failing honestly offline. |

## Plan / edit

Already shipped in trust-glanceability Slice 1 + Round 89 (iOS scopes): the
flagship editor must keep `this` / `this_and_future` / `all` reachable with
`occurrenceKey`. Do not regress `editScope: "all"` as a silent default on
recurring series.

## Capture / inbox

Keep `taskId` consume-on-schedule (Round 92). Replay-safe creates stay
`Idempotency-Key` POSTs. Status changes rebase; general field edits stay
live-only.

## Review

Review only judges blocks whose end has passed (`review-window.ts`). Do not
offer "let go" on tonight at 2 pm.

## Human-gated (print and stop)

B1–B6 in `docs/plans/2026-08-13-trust-glanceability.md`.
7B / 8B in `docs/plans/UNBLOCK-7B-8B.md` (Google policy, Resend/Apple,
physical iPhone). Staging DNS (B5) and pre-migration `pg_dump` (B6) stay
Neima-only.
