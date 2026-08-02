# Round 73 — Magic-link provider-error recovery

## Production finding

The installed Better Auth magic-link verifier can redirect the browser callback
with four stable errors: `INVALID_TOKEN`, `failed_to_create_user`,
`new_user_signup_disabled`, and `failed_to_create_session`. Round 71 handled the
first. Fresh production dogfood with the stable session-failure code confirmed
the remaining provider failures still fall through to the signed-out sample
planner with no explanation or recovery. Ignored evidence lives under
`browser-qa/round73-dogfood/`.

## Contract

- Centralize a fixed-copy allowlist for only the four verifier errors emitted by
  the installed Better Auth plugin.
- Preserve the specific incomplete/expired/used guidance for `INVALID_TOKEN`.
- Use one neutral completion-failure message for provider-side account/session
  failures without exposing internals or claiming partial success.
- Never reflect raw query values; arrays, unknown codes, and provider-unscoped
  arbitrary text remain ordinary signed-out Today.
- Keep clean `/app/today` sign-in/sign-up continuation and authenticated Today.
- Pin pure mapping and browser behavior, then pass visual, repository, parity,
  native, exact-SHA CI, deployment, and production gates.

## Checklist

- [x] Verify installed provider codes and reproduce stable session failure live.
- [x] Capture URL, DOM, screenshot, and console evidence.
- [x] Add failing pure and browser contracts.
- [x] Implement and visually verify the fixed-copy allowlist.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [x] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
