# Round 83 — Auth capability honesty

## Objective

Keep production authentication truthful when outbound email is not configured.
The public capability endpoint currently reports `magicLink: false`, but the
sign-in card still offers magic-link and password-recovery actions and reports a
generic success after a request that cannot deliver email.

## Evidence

- `GET https://time.neima.me/api/v1/auth/capabilities` returned
  `{ "magicLink": false, "apple": false, "google": false }` on 2026-08-10.
- On the live mobile sign-in page, submitting a synthetic `.invalid` address via
  **Email me a magic link** produced “a sign-in link is on the way.”
- Screenshots are saved under the git-ignored
  `browser-qa/round-83-production-dogfood/` directory.

## Plan

1. Add rendering regressions proving sign-in omits magic-link and password
   recovery when email delivery is unavailable, and still offers both when it
   is available. Pin the direct password-recovery route to an honest
   unavailable state too.
2. Gate both sign-in controls and the direct recovery form on the existing
   server-derived `magicLink` capability. Keep password sign-in and sign-up
   unchanged.
3. Run focused tests, full web gates, iOS gates, and parity scoring.
   Keep configured-flow browser coverage explicit by enabling the synthetic
   E2E capability while continuing to intercept every delivery request.
4. Recheck the affected sign-in UI in desktop and mobile browsers.
5. Update the handoff log, commit, push, deploy, and verify the exact behavior
   on `time.neima.me` while leaving the externally gated 7B/8B boxes open.

## CI closure

The first corrected CI rerun exposed a separate In Order initialization race:
the component picked its rounds twice, once for content and again to size the
first scramble. When those random picks had different step counts, the browser
could never render one required step. Prepare each run atomically from one pick,
pin that invariant in pure tests, and rerun the focused game browser spec before
final release verification.

## Executor prompt

Execute this plan test-first. Do not enable or fake Resend, Apple, or Google.
Do not mutate production planner data. Preserve the generic anti-enumeration
responses at the server boundary; this change is only about not advertising an
unavailable delivery path in the web UI.
