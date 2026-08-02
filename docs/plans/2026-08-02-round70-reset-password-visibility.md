# Round 70 — Reset-password visibility parity

## Production finding

Fresh production dogfood confirmed that `/reset-password` still keeps the new
credential permanently masked with no keyboard, pointer, or touch control,
despite the released shared sign-in/sign-up visibility behavior. The issue
reproduced at 1440x1000 and 390x844 using only a synthetic invalid token. Ignored
evidence lives under `browser-qa/round70-dogfood/`.

## Contract

- Reuse one shared password-field implementation across sign-in, sign-up, and
  reset-password instead of cloning the interaction.
- Keep every password masked by default with the stable **Show password** name,
  `aria-pressed` visibility state, `aria-controls`, and a 44x44 token-only target.
- Preserve controlled values, autocomplete, validation, focus, auth request
  locking, return routing, invalid-token recovery, and magic-link clearing.
- Clear and re-mask the reset credential before showing an invalid/consumed-link
  recovery state.
- Pin reset reveal/re-mask behavior with browser coverage, then verify
  desktop/mobile rendering, full gates, exact-SHA CI, deployment, and production.

## Checklist

- [x] Reproduce on production desktop and mobile with an invalid synthetic token.
- [x] Capture screenshots, DOM state, and a dogfood report.
- [x] Add a failing browser contract for reset reveal/re-mask behavior.
- [x] Extract and adopt one shared password field.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [x] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
