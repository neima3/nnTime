# Round 38 — Complete-from-widget via a secure session bridge (H03)

Goal: retire the parity checklist's H03 partial. The Next Up widget's done
button was withheld until the extension could authenticate its own writes —
the rejected design was a control that could fail remotely while
optimistically changing only the cache.

## Design

1. **Session bridge.** The Better Auth cookie envelope moves from the app's
   private keychain into the `group.me.neima.kairo` access group (app-group
   identifiers are valid keychain access groups on iOS — no new entitlements,
   no team-prefix signing implications). `KeychainSessionEnvelopeStore` gains
   an injectable `KeychainClient` seam plus a migration path: a legacy
   default-group item found on first read is re-homed into the shared group,
   so nobody signs in again. `SessionCookieRules` (Shared) becomes the single
   definition of cookie filtering + scope hashing for app and widget.
2. **Network-first service.** `WidgetCompletionService` (Shared) PATCHes
   `/api/v1/activities/{id}` with `If-Match`, `Idempotency-Key`, an explicit
   `Cookie` header (ephemeral URLSession, `httpShouldSetCookies=false`), and
   the ADR-002 body (`editScope:"this"`, occurrenceKey, status,
   completedAt/null). The day cache updates — including the server's new
   revision — only after a 2xx. Fail-fast guards: no live cookie →
   notSignedIn; cache scope ≠ envelope scope → scopeMismatch, both before
   any request leaves the device.
3. **Intent + UI.** `CompleteBlockIntent` (AppIntent, widget process) calls
   the service then reloads the `KairoNextUp` timelines. Small-card and
   large-list rows render a circle done button only when the cached row
   carries full identity (activityId + occurrenceKey + revision); legacy
   rows stay read-only. Errors leave the timeline untouched — WidgetKit
   rolls the button back.

## Known limitation (accepted)

Repeat toggles on a recurring occurrence that the server split under
`editScope:"this"` can 409 until the app next reconciles the day — the
widget throws, changes nothing, and the app's full refetch resolves it.

## Gates

`KairoUnitTests` (10 new: keychain group/migration semantics against an
in-memory client; service contract/rollback against a stub URLProtocol),
main-thread gate, web lint, CI green on the exact SHA, parity recompute
(H03 → 1.0: iOS 85.80% → 86.36%).

## Follow-up

Round 39 candidate: H04 — Live Activity pause/complete buttons through the
same bridge.
