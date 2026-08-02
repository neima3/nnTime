# Round 67 — Magic-link credential clearing

## Production finding

A read-only production auth dogfood pass reproduced that the sign-in form keeps
the entered password after a successful “Email me a magic link” request. The
flow has already transitioned to passwordless authentication, so retaining the
credential is unnecessary and leaves sensitive form state on screen.

Ignored reproduction evidence lives under `browser-qa/round67-dogfood/`.

## Contract

- Clear the password only after the magic-link request succeeds.
- Preserve the email so the neutral delivery confirmation remains meaningful.
- Preserve password and retry context when magic-link delivery fails.
- Keep account-enumeration-safe copy, request locking, callback validation, and
  password sign-in behavior unchanged.
- Pin the behavior with a browser regression test, then verify desktop and
  mobile rendering, the full repository gates, exact-SHA CI, deployment, and
  live production behavior.

## Checklist

- [x] Reproduce twice in production with reserved nonexistent addresses.
- [x] Capture screenshots, video, network result, and report.
- [x] Add a failing browser contract for successful magic-link clearing.
- [x] Implement the smallest client-state fix.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [ ] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
