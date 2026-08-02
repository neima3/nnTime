# Round 72 — Cross-device callback copy

## Production finding

Fresh desktop production dogfood found the magic-link bridge saying “Open Kairo
on this iPhone” at a 1440×1000 desktop viewport. The actions were correct and
the console was clean, but the device claim was visibly false and weakened
trust at a sensitive authentication boundary. Ignored evidence lives under
`browser-qa/round72-dogfood/`.

## Contract

- Keep the binding two-action native/browser callback behavior unchanged.
- Replace the current-device claim with truthful cross-device guidance that
  directs the user to their iPhone or the current browser.
- Preserve token encoding, single-use language, missing-token recovery,
  no-auto-verification behavior, metadata, and token-only visual styling.
- Pin the copy at the server-rendered boundary and verify desktop/mobile,
  repository, parity, native, exact-SHA CI, deployment, and production.

## Checklist

- [x] Reproduce and capture the false desktop device claim on production.
- [x] Add a failing server-rendered callback copy contract.
- [x] Implement and visually verify the truthful cross-device copy.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [x] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
