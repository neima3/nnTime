# Round 64 PWA Quick-capture Intent Plan

**Goal:** Make the installed **Quick capture** shortcut honest and resumable for
both signed-out and authenticated users.

**Demonstrated issue:** The production manifest advertises **Quick capture** at
`/app/today?capture=1`. Authenticated shells already consume that query and open
the real capture dialog, but the shell intentionally omits `QuickCapture` while
signed out. Production therefore renders the ordinary read-only sample day with
no capture field, explanation, or preserved auth continuation.

## Design decision

Treat exact `capture=1` as a user intent, not a preview decoration:

- authenticated visitors keep the existing direct-open capture dialog;
- signed-out visitors see a focused, token-only card titled **Capture after you
  sign in**;
- sign-in and account-creation links preserve exactly
  `/app/today?capture=1`, so returning to Today mounts `QuickCapture` and opens
  the blank dialog;
- ordinary signed-out Today remains the polished sample planner when the query
  is absent or malformed.

The boundary uses the existing `SignedOutCard`, `appReturnTo`, auth return
validator, and design tokens. It performs no production mutation.

## Test-first implementation

- [x] Add a signed-out browser contract for the focused boundary, exact safe
  continuation, and zero protected planner requests.
- [x] Pin the existing authenticated behavior: the manifest shortcut opens the
  named quick-capture dialog with its textbox focused.
- [x] Run the focused browser tests and confirm the signed-out contract fails on
  current behavior.
- [x] Add the exact-intent branch to Today without changing the ordinary preview
  or authenticated planner.
- [x] Run focused and full gates, independent review, and desktop/mobile browser
  QA.
- [x] Update roadmap/progress, commit, push, pass exact-SHA CI, deploy, and
  verify the live shortcut boundary and authenticated contract.

## Standing boundaries

- Production dogfood and verification are signed-out and read-only.
- Capture never auto-saves; the returned authenticated dialog remains blank.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
