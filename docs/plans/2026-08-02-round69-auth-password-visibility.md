# Round 69 — Auth password visibility

## Production finding

Fresh production dogfood confirmed that both `/sign-in` and `/sign-up` keep an
entered password permanently masked. Neither field exposes a keyboard, pointer,
or touch control for verifying the value before submission. Ignored desktop and
mobile evidence lives under `browser-qa/round69-dogfood/`.

The same pass rejected a false positive on `/forgot-password`: its async neutral
confirmation correctly uses `role="status"`, so returning focus to the document
body does not by itself justify a focus-management change.

## Contract

- Keep passwords masked by default on sign-in and sign-up.
- Add one compact token-only reveal control inside the shared password field.
- Expose a stable **Show password** toggle name with pressed state conveying
  whether the password is currently visible.
- Preserve the password value, autocomplete mode, validation, form submission,
  magic-link credential clearing, auth request locking, and return routing.
- Meet the binding 44px touch-target, focus-visible, hover, active, and dark-mode
  contracts without adding a competing action to the form hierarchy.
- Pin both auth modes in a browser regression test, then verify desktop/mobile
  visuals, full repository gates, exact-SHA CI, deployment, and live production.

## Checklist

- [x] Reproduce on production desktop and mobile without account mutation.
- [x] Capture screenshots, DOM state, and a dogfood report.
- [x] Add a failing browser contract for reveal/re-mask behavior.
- [x] Implement the shared accessible visibility control.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [x] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
