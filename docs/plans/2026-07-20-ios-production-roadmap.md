# Kairo iOS — Production-Ready Program (2026-07-20)

**Goal:** take the native SwiftUI app from "core loop works" to genuinely
App-Store-shippable — interactive widgets, richer widget families, first-run
onboarding, settings, accessibility, resilient states, and a unit-tested API
layer. Design contract: `docs/design/ios-adaptation.md`. Every phase is
verified in the simulator (build + XCUITest or targeted check) before its
box ticks. Web is untouched.

## Progress tracker
- [x] Phase 1: Interactive complete — AppIntent on the "Next up" widget (Fable)
- [x] Phase 2: Live Activity buttons — +10 / Done via AppIntents (Fable)
- [x] Phase 3: Large "Today list" + lock-screen accessory widgets (Fable)
- [x] Phase 4: First-run onboarding — anchor picker like web (Fable)
- [x] Phase 5: Settings — theme override, reduced-stimulation, sign out (Fable)
- [x] Phase 6: Resilient states — offline banner, error/empty/loading polish
- [x] Phase 7: Accessibility pass — VoiceOver, Dynamic Type, reduce-motion
- [x] Phase 8: API unit tests — decode/date/error golden tests (subagent)
- [x] Phase 9: Pull-to-refresh everywhere + haptic consistency audit
- [x] Phase 10: Ship prep — icon check, launch, README ship steps, full suite

## Phase notes

### 1 — Interactive complete (AppIntent)
`CompleteActivityIntent` (App Intents) that PATCHes an occurrence to
completed via a shared, app-group-scoped API call, then reloads timelines.
Add a checkmark Button(intent:) to the small "Next up" widget so a block can
be completed without launching. Needs the activity id + revision + occ key
in the day cache.
Evidence: widget cache carries ids; intent compiles; simulator widget shows
the button. (Full network from a widget process needs signing, so verify the
intent path + cache shape, not the live tap.)

### 2 — Live Activity buttons
`ExtendFocusIntent` (+10) and `CompleteFocusIntent` (Done) on the lock-screen
banner + Dynamic Island expanded bottom. They post to the running session via
the shared API; the app process observes and updates the activity.
Evidence: buttons render (screenshot the banner), intents compile.

### 3 — Large + accessory widgets
Large "Today list": date header + up to 5 upcoming rows (emoji/title/time),
"+n more", empty state. Accessory: circular = day-progress ring around ◔;
rectangular = next-up title+time; inline = "◔ 13:30 Shift prep".
Evidence: gallery renders each family (WidgetKit preview screenshots).

### 4 — First-run onboarding
Port the web anchor-picker: after a fresh sign-up (settings empty / no
activities today) show a 2-step sheet — pick anchor blocks → create real
activities (daily rrule for morning/wind-down). Skippable. Tracks a
"seen onboarding" flag in the app group.
Evidence: fresh account → sheet → anchors on Today.

### 5 — Settings
Real settings screen from More: theme (system/light/dark override via
`.preferredColorScheme`), reduced-stimulation toggle (persists, damps
animations app-wide), notification-permission row placeholder, timezone
display, export/delete links to web, sign out. Persist theme in the app
group; apply at RootView.
Evidence: toggle theme → app recolors; persists across relaunch.

### 6 — Resilient states
`NetworkMonitor` (NWPathMonitor) → offline banner; typed error surfaces on
Today/Inbox/Focus (retry button); skeleton/loading polish; empty states
audited. No silent failures.
Evidence: airplane-mode sim → banner + retry; error copy on 500.

### 7 — Accessibility
VoiceOver: block actions as accessibility custom actions (complete/edit/
focus/delete); accessibilityValue on rings; Dynamic Type to XXL without
truncation (wrap titles); reduce-motion gates all spring/scale. Accessibility
rotor grouping on the timeline.
Evidence: XCUITest with a VoiceOver-style element query; visual XXL check.

### 8 — API unit tests (subagent)
XCTest target hitting the JSON decoders with golden fixtures: activity/day/
task/focus decode, the custom date strategy (fractional + date-only), error
mapping (401/409/500), If-Match header presence. No network — fixtures only.
Evidence: `xcodebuild test` green, N cases.

### 9 — Pull-to-refresh + haptics
Refreshable on Week; consistent haptics (success on complete/create, medium
on lift/delete, selection on chip/toggle); remove any duplicated/missing
generators.
Evidence: audit diff; suite green.

### 10 — Ship prep
Icon renders at all sizes (no alpha issues); launch screen check; README
ship checklist current; run the entire XCUITest suite; commit + push.

## Rules
- Design/interactive phases (1–7, 10 polish) on Fable in the main loop.
- Phase 8 (fixtures + decode tests) is cheap-subagent friendly.
- Tokens/theme only; nothing turns red; forgiving copy.
- Build must succeed and the existing XCUITest suite must stay green before
  each tick.
