# Round 66 Password-reset Confirmation Copy Plan

**Goal:** Keep the public password-reset request confirmation account-neutral,
helpful, and free of development-only implementation instructions.

## Demonstrated issue

Production dogfood submitted three reserved nonexistent `example.invalid`
addresses. Every successful generic confirmation ended with **In local dev
without email configured, the link is printed in the server logs.** The text is
hardcoded into the public client component, so it appears in every environment.

## Design decision

- End the visitor-facing status after neutral delivery and spam-folder guidance.
- Do not add an environment branch: local delivery diagnostics belong in server
  logs and developer documentation, not account-recovery UI.
- Preserve the existing status region, enumeration-safe wording, form state,
  request behavior, and error handling.

## Test-first implementation

- [x] Add a browser contract for exact account-neutral success guidance and the
  absence of local-development/server-log copy.
- [x] Confirm the contract fails on the current production-equivalent component.
- [x] Remove only the internal instruction.
- [x] Run focused and full gates, independent review, and desktop/mobile browser
  QA.
- [ ] Update roadmap/progress, commit, push, pass exact-SHA CI, deploy, and
  verify the live confirmation with a reserved nonexistent address.

## Standing boundaries

- Production verification uses reserved nonexistent addresses only; no real
  account email is sent.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.
