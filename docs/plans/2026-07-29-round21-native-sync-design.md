# Round 21 — Native Sync and Offline Mutation Integrity Design

**Status:** Approved for implementation under the repository's autonomous
execution instruction.

**Roadmap target:** Phase 7C.

## Problem

The shipping iOS app has generated online CRUD, a Keychain-backed session, and
a protected user-scoped Today snapshot. When a read fails it can render that
snapshot, but the saved day is entirely read-only. The app does not consume the
ADR-002 change cursor, cannot preserve a safe mutation made offline, and has no
durable conflict outcome. Cross-device updates therefore depend on each screen
being manually refreshed, and a common offline action such as capturing a
thought or completing a saved activity is lost.

Phase 7B remains open for provider credentials and physical-device proof. Those
external gates do not change the independent Phase 7C data contract.

## Approaches considered

### 1. Cursor-only invalidation

Persist the `/changes` cursor and refresh visible screens when the feed moves.
This improves online cross-device freshness but leaves offline work impossible
and does not satisfy Phase 7C.

### 2. Replay everything through `/batch`

Persist arbitrary API calls and submit them together on reconnect. This is
compact but unsafe: general edits may overwrite newer fields, while a status
mutation must re-read the current revision immediately before replay. A static
batch cannot express that dependency without weakening ADR-002.

### 3. Protected typed queue plus generated-operation replay

Persist only the mutation classes explicitly permitted by ADR-002. Replay
creates with their original idempotency keys. Replay status changes only after
reading the current activity revision. Persist terminal outcomes for explicit
UI, and use `/changes` as an invalidation feed that triggers fresh snapshots.

**Decision:** approach 3. It preserves the existing generated-client boundary,
does not expand offline authority, and completes the actual Phase 7C contract.

## Product behavior

### Offline Today

When a matching protected day snapshot is available:

- the timeline remains scrollable;
- Complete and Mark not done remain available;
- each status action updates the protected snapshot immediately and is labelled
  “Saved on this iPhone” until replay succeeds;
- edit, drag, delete, focus, review, templates, and new-activity controls remain
  unavailable;
- the saved-day notice explains the narrow capability instead of calling the
  whole screen read-only.

### Offline Inbox

Submitting a non-empty thought while disconnected:

- persists a replay-safe create with one UUIDv7 idempotency key;
- clears the composer only after durable local storage succeeds;
- renders a local pending row with “Saved on this iPhone”;
- survives termination and relaunch for the same account;
- disappears from the pending section after the server accepts the create and
  the Inbox refreshes.

If protected local storage fails, the composer retains the text and presents a
non-destructive error.

### Reconnect and foreground sync

On session bootstrap, network restoration, scene activation, pull-to-refresh,
and explicit retry:

1. load state only when its scope matches the current Keychain-derived account
   scope;
2. replay pending mutations in creation order;
3. preserve the original idempotency key for every attempt;
4. drain at most ten `/changes` pages from the last committed cursor, retaining
   the committed cursor so a later trigger can continue a large backlog;
5. refresh visible server snapshots when replay succeeded or the feed advanced;
6. persist the new cursor only after its page was decoded and handled.

Only one sync runs at a time. Concurrent triggers join or observe the same
actor-isolated state rather than replaying twice.

### Conflict outcomes

- Network failures, 429, and 5xx remain pending with bounded exponential
  backoff capped at 30 minutes. Automatic sync respects `nextAttemptAt`;
  explicit retry may bypass that delay.
- A status replay first reads `/activities/{id}` and sends its current revision
  as `If-Match`.
- A status 409 remains pending and re-reads on a later attempt.
- A 404/410 during the re-read is terminal because the activity was deleted.
- Other non-authentication 4xx responses are terminal.
- A structured 401 continues through the existing session-invalidation and
  account purge boundary.
- Terminal rows remain durable until acknowledged. UI copy says the server
  version was kept and identifies the local action without exposing payloads or
  credentials.

## Architecture

### `NativeSyncStore`

An actor-independent value store writes one versioned JSON document under
Application Support using
`NSFileProtectionCompleteUntilFirstUserAuthentication` and atomic replacement.
The document contains:

- account scope;
- opaque change cursor;
- ordered pending mutations;
- durable conflict records;
- last successful sync timestamp.

Every read requires an exact scope. A mismatched or unsupported document is
rejected and removed. Logout and account switch remove the entire document.
Auth tokens, cookies, user IDs, Apple credentials, and raw error bodies are
never stored.

### `NativeSyncCoordinator`

An actor owns the active scope, store, replay clock, and synchronization
fencing. Its public API is deliberately narrow:

- `activate(scope:)`
- `snapshot(scope:)`
- `enqueueTaskCreate(...)`
- `enqueueActivityStatus(...)`
- `synchronize(scope:)`
- `acknowledgeConflict(scope:id:)`
- `purge()`

Network work is injected through a `NativeSyncTransport` protocol. Production
uses `KairoAPI`; unit tests use deterministic actors.

### Generated API boundary

`KairoAPI` and `GeneratedAPIAdapters` gain typed wrappers for:

- `GET /activities/{id}`;
- `GET /changes?cursor=&limit=`.

Existing create-task and status-update methods accept an optional caller-owned
idempotency key. They continue to generate one for ordinary online calls. No
shipping planner request uses handwritten `URLSession`.

The generated-adoption gate adds `getActivitySeries` and `getChanges` to the
required operation inventory. `/batch` remains generated but is not adopted for
the rebase-dependent replay path.

### App integration

`AppState` activates the coordinator only after a session scope is established.
It publishes pending count, durable conflicts, syncing state, and last success
to SwiftUI. It purges sync state through the same logout/account-switch/401
boundary that clears the Keychain envelope and DayCache.

`MainTabs` triggers synchronization on reconnect. `KairoApp` triggers it when
the scene becomes active. Today and Inbox trigger it before online refresh and
observe a single `kairoSyncCompleted` notification to re-read server truth.

## UI contract

The implementation reuses the binding Kairo tokens:

- Butter notice for offline/pending, using `Color.kCatButter` and
  `Color.kCatButterInk`.
- Rose notice for a durable conflict, using existing rose category tokens.
- Mint confirmation only transiently after a successful replay.
- Existing card radius, type styles, and spacing.

No new hex colors, font families, or generic system-alert styling are added.
Dynamic Type, VoiceOver, reduced stimulation, light/dark, and 390-point width
remain supported. Conflict actions have explicit accessible names.

## Data safety and privacy

- The local document is account-scoped by the existing non-secret SHA-256
  session scope.
- File protection matches the existing DayCache.
- Logging exposes counts and operation kinds only, never titles, tokens,
  cookies, request bodies, or server response bodies.
- Queue proof uses synthetic local accounts and databases. Production
  verification is read-only.
- Cursor entries are invalidation metadata; the app always fetches current
  authoritative resources rather than reconstructing entities from the feed.

## Testing and evidence

### Unit and contract

- protected file attributes, atomic replacement, version/scope rejection, and
  purge;
- ordered replay and stable idempotency;
- fresh-revision status rebase;
- retryable/terminal classification;
- durable conflict acknowledgement;
- cursor paging and commit-after-success;
- single-flight concurrency;
- account-switch rejection and purge;
- generated-operation adoption.

### Simulator

- cold launch offline with a matching saved day;
- offline complete/uncomplete survives relaunch;
- offline Inbox capture survives relaunch;
- reconnect replays once and refreshes server truth;
- deleted-while-offline produces an acknowledged durable conflict;
- 401 uses the full existing purge boundary;
- light/dark and accessibility XXXL at 390 points with no clipped actions.

### Release

Run lint, typecheck, all web tests, production build, OpenAPI sync/adoption,
Swift package tests, all app unit tests, deterministic Round 21 UI tests,
release simulator build, release preflight, independent code review, exact-SHA
Coolify deployment, live health, and read-only `/changes` authentication
boundary probes.

## Non-goals

- General field edits, checklist edits, deletes, and focus actions stay
  online-only.
- The queue does not become a general HTTP outbox.
- Widgets and Live Activities remain read-only/open-app surfaces until Phase 8A
  has a secure extension session bridge.
- Provider activation, physical-device auth proof, Google sign-in, TestFlight,
  and App Store processing remain separate gates.
