# Round 20 Native Authentication Completion Design

**Status:** Approved for autonomous execution under the repository instruction
to avoid clarification loops.

**Roadmap target:** Phase 7B in
`docs/plans/2026-07-12-kairo-roadmap.md`.

**Binding contracts:** ADR-003, ADR-005, the canonical OpenAPI document, and
the Soft Focus design system.

## Current-state findings

Round 19 shipped durable email/password cookie continuity, Keychain restore,
honest 401 handling, and complete account-local purge. Phase 7B remains open
because the shipping app has no native magic-link request/redemption flow, no
Sign in with Apple implementation, no associated-domain entitlement or AASA
file, and no physical-device proof.

Production currently has neither `RESEND_API_KEY` nor Apple provider variables
in the checked local environment mirror. The connected iPhone is registered
but unavailable. A 1Password inventory request timed out awaiting biometric
authorization. This design therefore separates code-complete behavior from
credential and physical-device release gates and does not mark 7B complete
without both.

## Approaches considered

### 1. Server-validated native auth boundary (selected)

Add public, rate-limited auth capability and Apple challenge/exchange
operations to `/api/v1`, use Better Auth for final ID-token verification and
session issuance, and consume the challenge atomically before exchange. Add
native magic-link redemption through universal/custom links and the official
Apple control to the existing SwiftUI auth surface.

This is the only approach that satisfies ADR-003's server-side state and nonce
requirements, prevents replay across multiple app workers, preserves one
canonical account/session store, and provides a clean path to explicit account
linking.

### 2. Direct native calls to Better Auth only

The app could send Apple's ID token directly to
`/api/auth/sign-in/social`. Better Auth would validate the token and nonce, but
the app-generated state would never be validated by the server. This is
smaller but violates ADR-003 and weakens replay/audit guarantees.

### 3. Skip 7B and start cursor sync

Phase 7C is independently valuable, but the executor contract requires the
first unchecked subphase. Skipping native authentication would preserve a
known launch blocker and make later physical-device sync testing less useful.

## Architecture

### Public capability discovery

`GET /api/v1/auth/capabilities` returns only:

```json
{
  "magicLink": true,
  "apple": true
}
```

Each flag is true only when its complete server configuration is present.
Responses are `Cache-Control: no-store`. Native and web sign-in screens omit
unavailable methods, preventing a generic-success magic-link request that can
never deliver and preventing an Apple button that can only fail.

### One-time Apple challenge

`POST /api/v1/auth/apple/challenge` accepts an intent of `sign_in` or `link`.
The link intent requires the current session. The route applies a shared
Postgres IP limit and a per-user limit for linking.

The server generates independent 256-bit state and nonce values. It stores:

- `identifier`: a namespaced SHA-256 state hash;
- `value`: JSON containing the SHA-256 nonce hash, intent, and optional user
  ID;
- `expires_at`: five minutes from creation.

The existing Better Auth `verification` table is intentionally reused with a
collision-proof namespace. No new migration or secondary auth store is
introduced.

`POST /api/v1/auth/apple/exchange` atomically deletes and returns the matching,
unexpired verification row. It rejects missing, expired, replayed,
intent-mismatched, user-mismatched, or nonce-mismatched challenges before
calling Better Auth.

For `sign_in`, the route delegates the ID token and raw nonce to Better Auth's
social sign-in endpoint and propagates its session cookie. For `link`, it
delegates to Better Auth's authenticated social-link endpoint. Both paths use
the same configured cookie store already persisted by
`NativeSessionController`.

### Apple provider configuration

The provider is enabled only when all of these are present:

- `APPLE_CLIENT_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_APP_BUNDLE_IDENTIFIER`

The server generates a short-lived ES256 client-secret JWT with `jose`.
`appBundleIdentifier` is `me.neima.kairo`, so native ID tokens are checked
against the App ID rather than the web Service ID. Private-relay email is
preserved as the account email on first authorization. Later Apple tokens that
omit email use a non-deliverable, stable `<sub>@apple.kairo.invalid` fallback
only for provider-account lookup.

Implicit same-email linking is disabled. If Apple returns an email belonging
to an existing password account, sign-in returns an actionable
`account_not_linked` state. The user signs in with the existing method and uses
Settings to connect Apple explicitly. Different-email linking remains denied.
OAuth tokens are encrypted at rest.

Production trusted origins are reduced to the canonical production origin and
Apple when configured. Staging and localhost origins are included only in
their matching environments.

### Native magic-link flow

The native client posts to Better Auth's magic-link request endpoint with
`metadata.platform = "ios"`. The server sends a universal link:

`https://time.neima.me/auth/callback?token=<single-use-token>`

The AASA file associates only `/auth/callback` with
`A45F46XD54.me.neima.kairo`. The app entitlement adds
`applinks:time.neima.me`.

When installed, the app receives the universal link and calls Better Auth's
verification endpoint without a browser callback, allowing the shared native
URL session to receive the session cookie before Keychain persistence. The
`kairo://auth` scheme accepts the same token as a fallback. Link parsing lives
in a pure, unit-tested boundary and accepts only the exact HTTPS host/path or
custom-scheme host.

If the website opens instead, `/auth/callback` presents two honest actions:
open Kairo through the custom scheme or continue in the browser. Browser
continuation uses Better Auth's standard verifier and redirects to Today.

### Native Sign in with Apple

The sign-in view loads capabilities and a challenge before enabling the
official `SignInWithAppleButton`. Its request asks for name and email, sets the
server state, and sets SHA-256 of the raw nonce. Completion checks the returned
state locally, sends the credential to the exchange operation, persists the
cookie envelope, applies the existing account-switch purge, and bootstraps.

Settings exposes the same official control with `link` intent. Successful
linking leaves the current session and planner state intact. Errors distinguish
cancellation, expired challenge, unavailable provider, duplicate-account
linking, network failure, and invalid credentials without exposing tokens.

## Visual and interaction contract

The existing auth card, fonts, radii, shadows, and semantic tokens remain
unchanged.

- Email/password remains the primary form action.
- Sign-in mode adds a restrained `or` divider, the official Apple control at a
  52-point height, and a bordered magic-link action beneath it.
- Sign-up mode stays focused on the existing form; Apple can create a new
  account from sign-in without duplicating controls.
- Every asynchronous action has disabled, loading, success, cancellation, and
  failure feedback.
- Touch targets remain at least 44 points. VoiceOver labels identify the
  provider and whether the action signs in or connects an account.
- Dynamic Type, high contrast, dark mode, reduced stimulation, and reduced
  motion continue through existing native tokens and system controls.
- No raw colors or substitute Apple logo are introduced.

## Failure and privacy behavior

- State, nonce, identity tokens, email links, and private keys are never logged.
- Challenge rows are single-use even when provider verification fails. A retry
  obtains a new challenge.
- A 401 during explicit linking follows the existing session invalidation
  policy. Provider or validation 4xx responses do not purge a valid session.
- Cancellation does not display an error or mutate session state.
- Capability and AASA responses reveal no secrets.
- The web fallback never auto-consumes a token before the user chooses browser
  continuation.
- Production auth methods remain hidden until their delivery/provider
  configuration is complete.

## Verification contract

Automated proof must include:

- challenge entropy, expiry, atomic single use, replay denial, wrong nonce,
  wrong intent, wrong linking user, and rate limiting;
- conditional provider configuration, client-secret JWT claims, native
  audience, missing-email fallback, and disabled implicit linking;
- exact AASA app ID/path and associated-domain/Sign in with Apple entitlements;
- magic-link request shape, strict callback parsing, native verification cookie
  persistence, cancellation, 401, link, and account-switch behavior;
- VoiceOver labels and complete enabled/loading/success/error states.

Release proof must include the full web and native gates, a real simulator
auth-state tour with screenshots, and live read-only capability/AASA probes.
Phase 7B is checked only after configured live providers and a complete
physical-iPhone email/password, magic-link, Apple sign-in, link, relaunch, and
logout lifecycle. The simulator and synthetic provider fixtures are not
physical-device evidence.

