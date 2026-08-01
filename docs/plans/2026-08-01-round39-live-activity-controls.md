# Round 39 — Live Activity pause/complete controls (H04)

Goal: retire the H04 partial. The Focus Live Activity's mutation buttons were
"open the authenticated app" links until the extension had a safe way to
mutate; R38 built the session bridge, and for Live Activities Apple provides
something even better — `LiveActivityIntent` runs in the **app process**.

## Design

1. **Intents (Shared).** `ToggleFocusIntent(sessionId:shouldPause:)` and
   `CompleteFocusIntent(sessionId:)` are LiveActivityIntents that dispatch
   through `FocusIntentBridge` — a handler registry the app fills at launch
   and the render-only widget process leaves empty. Declarative `shouldPause`
   (not "toggle") so a stale button tap can be detected server-state-first.
2. **Executor (App).** `FocusRemoteControl` drives the same `KairoAPI`
   calls the Focus screen uses: hydrate cookies from the keychain envelope if
   the scene-driven bootstrap hasn't run (background launch), fetch the
   active session, no-op if the tap is stale (`command(forState:desiredPaused:)`),
   transition with the session's revision, then reconcile every
   `Activity<FocusAttributes>` for that session (update on pause/resume, end
   on complete). Completion records mindful minutes exactly like the in-app
   button. A failed call changes nothing — the Live Activity keeps showing
   the last confirmed state. `kairoFocusMutatedExternally` re-hydrates an
   on-screen FocusView.
3. **UI.** Lock-screen banner: Pause/Resume + Done replace the "Open Kairo
   to adjust" link. Dynamic Island expanded bottom: the same two buttons
   plus a compact open-app link (deep link retained per contract).
4. **Contract.** The glance audit's allowed-intent set grows to the two
   focus intents; new invariants: ≥2 focus-intent buttons in the Live
   Activity, intents are LiveActivityIntents dispatching through the bridge,
   no transport in intent files.

## Gates

377 iOS unit tests (3 new: intent→bridge dispatch, stale-tap no-op policy
matrix), main-thread gate, full web gates (1016 tests incl. 6 contract),
CI green on exact SHA, parity H04 → 1.0: iOS 86.36% → 86.93%.
