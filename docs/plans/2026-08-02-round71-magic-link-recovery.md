# Round 71 — Invalid magic-link recovery

## Production finding

Fresh production dogfood followed a synthetic invalid magic-link token through
the browser fallback. Better Auth correctly redirected to
`/app/today?error=INVALID_TOKEN`, but signed-out Today silently rendered the
sample planner and discarded the failure. The user received no explanation or
recovery action. Ignored evidence lives under `browser-qa/round71-dogfood/`.

## Contract

- Recognize only Better Auth's exact `INVALID_TOKEN` callback error on signed-out
  Today; never reflect arbitrary query text.
- Replace the sample planner with a focused, token-only recovery card that says
  the sign-in link may be incomplete, expired, or already used.
- Route the user to sign in with a clean `/app/today` return destination so the
  stale error cannot survive another authentication attempt.
- Preserve the normal signed-out sample and all authenticated Today behavior.
- Pin the boundary with browser coverage, then pass desktop/mobile visual,
  repository, parity, native, exact-SHA CI, deployment, and live gates.

## Checklist

- [x] Reproduce the complete invalid-link fallback on production.
- [x] Capture DOM, screenshot, URL, and console evidence.
- [x] Add a failing browser contract for the recovery state.
- [x] Implement and visually verify the narrow signed-out boundary.
- [x] Obtain independent Critical/Important review.
- [x] Pass local browser, repository, parity, and iOS release gates.
- [x] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live.
