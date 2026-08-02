# Round 65 Invalid Reset-link Recovery Plan

**Goal:** Turn an invalid or consumed password-reset submission into a calm,
actionable recovery path without exposing backend wording or retaining the
visitor's attempted password.

## Demonstrated issue

Production dogfood reproduced `/reset-password?token=bogus` twice. Any non-empty
token renders the normal password form. A valid-length submission receives the
Better Auth `{ code: "INVALID_TOKEN", message: "Invalid token" }` response,
shows that raw phrase inline, keeps the password field populated, and offers no
direct way to request a replacement link. Missing tokens already render a
purpose-built unavailable-link card.

## Design decision

- Treat only Better Auth's stable `INVALID_TOKEN` code as an unavailable or
  consumed reset link.
- Clear the password immediately and replace the form with the same branded
  unavailable-link card used for missing or malformed links.
- Keep transient/network and other unexpected failures on the form with a
  retryable, product-owned message.
- Preserve native minimum-length validation and the successful redirect to
  sign-in.

## Test-first implementation

- [x] Add a browser contract that stubs the stable invalid-token response and
  requires the recovery card, replacement-link action, cleared password field,
  and absence of raw backend copy.
- [x] Confirm the browser contract fails on the current live-equivalent form.
- [x] Extract the shared unavailable-link card and implement the narrow client
  transition.
- [x] Run focused and full gates, independent review, and desktop/mobile browser
  QA.
- [ ] Update roadmap/progress, commit, push, pass exact-SHA CI, deploy, and
  verify the live invalid-token flow read-only.

## Standing boundaries

- Production checks use missing or deliberately bogus tokens only; no real
  account password is changed.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
