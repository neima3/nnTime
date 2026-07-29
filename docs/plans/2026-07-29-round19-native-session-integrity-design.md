# Round 19 Native Session and Offline Integrity — Design

**Status:** Accepted for autonomous execution under the standing production-
readiness goal.
**Owner:** Codex
**Date:** 2026-07-29

## Problem

Kairo's shipping SwiftUI app has strong generated planner transport, but its
session and offline behavior does not yet satisfy binding ADR-002/003:

- `AppState.bootstrap()` maps every settings failure—offline, timeout, 429,
  5xx, decoding, and 401—to `signedOut`, so a valid signed-in user can be shown
  the login screen merely because the network is unavailable;
- Better Auth cookies live only in the default cookie store; the shipping app
  does not restore its session from Keychain even though ADR-003 requires
  `kSecAttrAccessibleAfterFirstUnlock`;
- logout revokes the server session and removes selected cookies, but leaves
  the shared day cache, account-derived preferences, pending notifications,
  URL cache, and in-memory category/account state;
- Today writes a widget day cache but never reads it, while the global offline
  banner incorrectly promises that changes will sync on reconnect even though
  the shipping app has no wired offline mutation queue;
- the generated-client package contains unused Auth/Sync prototypes and weak
  tests that can make 7B/7C appear implemented without reaching the shipping
  app.

These are privacy and trust-boundary defects, not polish issues: a transient
failure masquerades as logout, stale data can survive an account switch, and
the UI promises mutation behavior it does not provide.

## Selected architecture

The shipping app will own one `NativeSessionController` that composes:

1. the exact Better Auth cookies used by the configured Kairo origin;
2. a Keychain-backed serialized session envelope;
3. an opaque SHA-256 account scope derived locally from the session material;
4. the cookie storage shared by the app's generated and auth transports.

Successful sign-in/sign-up persists the configured auth cookie envelope with
`kSecAttrAccessibleAfterFirstUnlock`. App launch restores it into the injected
cookie store before the first planner probe. The opaque scope is never logged,
sent as new metadata, or used as an authentication credential; it only
partitions local data.

`AppState.bootstrap()` will use an explicit state policy:

- authenticated settings success → signed in/online;
- structured 401 → invalidate the session, purge account-local state, show
  sign-in;
- network, 429, retryable 5xx, or other transient failure with a restored
  session and a matching protected day cache → signed in/offline-read-only;
- transient failure with no restorable session/cache → preserve `unknown`
  briefly, then show a recoverable connection state rather than claiming the
  credentials are invalid.

Any later planner 401 follows the same invalidation path through a local
session-invalidated notification. Arbitrary 4xx, 5xx, decoding errors, and
network failures never revoke a session.

## Protected user-scoped day cache

The app-group `UserDefaults` day blob will be replaced by an app-group file
whose payload includes:

- schema version;
- opaque account scope;
- planning date and zone;
- saved timestamp;
- the minimum block fields needed to render Today and the widget.

The file uses atomic writes plus
`NSFileProtectionCompleteUntilFirstUserAuthentication`, matching the
after-first-unlock session contract. Reads require exact scope and date
matches; legacy unscoped data is rejected and removed. The widget continues to
read the same protected snapshot, but no session credential is placed in the
cache.

When Today cannot load because of a transient connection failure, it may render
the matching cached snapshot in an explicitly read-only mode. The notice uses
existing butter/ink/border tokens and says that the saved day is viewable but
changes require a connection. Completion, delete, move, editor, and
server-authoritative focus actions are unavailable in cached mode. This round
does not invent an offline mutation queue.

## Logout and account-switch boundary

Logout always performs local cleanup even when server revocation fails:

- delete configured Better Auth cookies and the Keychain envelope;
- remove protected day snapshots and URL cache entries;
- remove pending local activity notifications;
- reset account-derived accessibility, quiet-hour, format, and category state;
- leave device-consent choices such as Apple Health permission and purely
  device-local onboarding state alone;
- return the root UI to signed-out.

The same purge runs on a structured 401. A new session whose scope differs from
the previous scope purges the prior account's cache before persisting the new
envelope.

## Dead prototype disposition

Unused package-level auth/sync prototypes and their assertion-light tests do
not count as shipping evidence. Round 19 will either move reusable primitives
behind the shipping app's tested boundary or delete the dead prototypes. The
generated package remains responsible for OpenAPI transport, not a parallel
unwired product architecture.

Magic-link callback completion, Sign in with Apple, and widget/App Group
credential propagation remain separate work. This round must not mark all of
7B/7C complete or claim physical-device proof.

## Verification

Strict red/green tests must prove:

- only configured Kairo auth cookies are persisted/restored;
- the Keychain accessibility contract is encoded;
- a new account scope cannot read a prior account's cache;
- cache files carry the expected data-protection attribute;
- offline/429/5xx do not become signed-out;
- 401 invalidates the session and purges local account data;
- logout purges even when the network revoke fails;
- Today reconstructs the matching cached day read-only and rejects stale,
  wrong-date, legacy, or wrong-scope snapshots;
- the offline UI makes no sync promise and cached mode exposes no mutation
  actions.

Finish with generated package tests, app-hosted unit tests, unsigned shipping
build, simulator interaction evidence for online→offline→relaunch and logout
purge, full repository gates, adversarial review, and truthful roadmap/parity/
progress updates. Production checks remain read-only.
