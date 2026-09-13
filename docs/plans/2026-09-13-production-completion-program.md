# Kairo — Production Completion Program (2026-09-13)

Status: **P0 ledger + P1 Task 1.1 in progress on a PR branch.** Do not merge
to `main` from this program (Coolify auto-deploys `main`).

> **Provenance:** this pack was untracked on the Mac working tree
> (`/Users/nn/Apps/nnTime`) at the 6d3000d planning baseline and was missing
> from `origin/main`. Reconstructed here from the binding read-order and the
> 2026-09-13 executor brief so later sessions have a committed source of
> truth. Do not invent a 19th game, a new design language, billing, family
> sharing, watchOS, or Android.

**For agentic workers:** execute the **first unchecked P1 task** after the P0
ledger exists with *actual* exits. Track B items (trust-glanceability B1–B6,
`UNBLOCK-7B-8B`) are human-gated — print them and stop. No production
mutations. No deploy without Neima.

## Binding read order

1. `AGENTS.md`
2. `docs/plans/2026-07-12-kairo-roadmap.md`
3. `docs/adr/ADR-001` … `ADR-005`
4. `docs/design/design-spec.md` (+ illustrations art direction)
5. `docs/plans/parity-checklist.md` / `docs/plans/progress.md` / `docs/DEPLOYMENT.md`
6. This file + `2026-09-13-core-workflows.md` + `2026-09-13-production-release.md`
7. `docs/plans/2026-08-13-trust-glanceability.md` Track B (B1–B6)
8. `docs/plans/UNBLOCK-7B-8B.md`

## Hard rules (do not dilute)

- ADRs are contracts. Ownership in every query. ADR-001 temporal semantics.
  ADR-002 offline mutation classes only (focus is **never queued**).
- Keep `/api/v1`, Zod, `api/openapi.yaml`, and the Swift client in lockstep.
- Design tokens only. No Inter, no raw hex in components, no default Tailwind
  palette. New DESIGN-SENSITIVE surfaces need Fable/Opus sign-off first.
- Secrets stay in `.env.local` / Coolify. No production DB writes from agents.
- Gates are never lowered. Record actual exits and honest skips.
- Work via PR. Do not push or merge `main`.

## Sequence

| ID | Item | Owner | Done when |
|---|---|---|---|
| **P0** | Safe local baseline + readiness ledger | Agent | `docs/plans/2026-09-13-p0-readiness-ledger.md` lists real lint / typecheck / test / build exits, skip reasons, and the Linux-vs-macOS CI split. Gates unchanged. |
| **P1.1** | Negative DB-backed focus ownership | Agent | `startFocusSession(user, { activityOccurrenceId: otherUserOcc })` throws `NotFoundError` and **preserves** the caller's existing active session. Service boundary closed before any client wiring. |
| **P1.1b** | Focus-event atomicity / idempotent retry | Agent | Reproduce the swallowed `appendPlannerEvent` `.catch(() => {})`. Event write failure rolls back the session (and any yield). Idempotent retry still replays one session + one `focus_start`. |
| **P1.2** | Virtual-occurrence / web-native linkage | Next slice | Today / Focus / iOS `startFocus` can attach a day-expanded (possibly virtual) occurrence without inventing a fourth ADR-001 identity. Materialize-or-address by `(seriesId, occurrenceKey)` — do not send a guessed UUID. |
| **P1.3+** | Remaining core-workflow slices | Later | See `2026-09-13-core-workflows.md`. |
| **Track B** | B1–B6 / 7B / 8B | Neima | Print checklist. Do not simulate an iPhone, staging TLS, or live `google:true`. |

## P1.1 acceptance (this session)

- Two users, ephemeral Postgres.
- Alice has a running session.
- Alice POSTs / `startFocusSession` with Mallory's occurrence id → 404 /
  `NotFoundError`.
- Alice's session id, state, and target duration are unchanged.
- Unknown and tombstoned occurrence ids behave the same (no enumeration).
- Alice's own materialized occurrence still starts and links.
- Ad-hoc starts (no occurrence id) unchanged.
- Planner-event failure is no longer swallowed on POST or terminal PATCH.

## Explicitly out of scope this session

- Client wiring of `activityOccurrenceId` (web `FocusClient` and iOS
  `KairoAPI.startFocus` still send title/emoji/minutes only).
- Virtual occurrence materialization on focus start (P1.2).
- 7B / 8B ticks, Coolify deploy, production migrations, staging TLS.
- Arcade, Today furniture, billing, family, watchOS, Android.

## Hand-off

Append `docs/plans/progress.md`. Leave roadmap 7B/8B unchecked. Next agent
starts at **P1.2** unless P1.1 tests are red.
