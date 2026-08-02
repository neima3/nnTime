# Round 74 — Password-reset intent continuity

## Production finding

Entering password recovery from a destination-aware sign-in URL immediately
drops that destination. In production, `/sign-in?next=/app/inbox` links to bare
`/forgot-password`; the recovery page then links back to bare `/sign-in`, and
the reset callback and successful reset likewise have no way to restore Inbox.
The safe intent therefore degrades to Today before the user can request a reset.
Ignored evidence lives under `browser-qa/round74-dogfood/`.

## Contract

- Carry one `safeAuthReturnTo` value from sign-in through forgot-password,
  Better Auth's reset callback, valid and invalid reset states, and the final
  sign-in navigation.
- Preserve nested app query intent without decoding or rebuilding it by hand.
- Fail closed to `/app/today` for arrays, external URLs, malformed encoding,
  traversal, controls, and all other values rejected by the existing binding
  auth-return policy.
- Keep reset tokens single-use, keep account-neutral request confirmation, and
  never expose token or provider internals in user-facing copy.
- Preserve current visuals and accessibility while pinning request payload,
  recovery links, success routing, and hostile-input behavior in a real browser.

## Checklist

- [x] Reproduce the destination loss in production without submitting data.
- [x] Capture URL, DOM, screenshot, and console evidence.
- [x] Add failing browser and pure contracts.
- [x] Implement safe end-to-end intent continuity.
- [x] Obtain independent Critical/Important review.
- [x] Pass visual, repository, browser, parity, and iOS release gates.
- [ ] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
