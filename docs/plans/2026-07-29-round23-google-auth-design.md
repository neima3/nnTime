# Round 23 Google Authentication and Reminders Decision

**Status:** Approved for autonomous execution under the repository instruction
to avoid clarification loops.

**Roadmap target:** Phase 8B in
`docs/plans/2026-07-12-kairo-roadmap.md`.

**Binding contracts:** ADR-003, ADR-005, the canonical OpenAPI document, the
Soft Focus design system, and the existing native session-integrity boundary.

## Current-state findings

Phase 8A is complete. Phase 8B has two unresolved product decisions:

1. Google authentication is absent on web and iOS.
2. The roadmap requires Apple Reminders import to ship or receive a justified
   exclusion.

HealthKit is already code-complete as two independent, device-local,
default-off features. Its remaining checks require user interaction on a
physical iPhone and are not reimplemented here.

Better Auth 1.6.23 already owns every Kairo account and session. Implicit
provider linking is disabled, OAuth tokens are encrypted at rest, native
session cookies are persisted in Keychain, and account switches purge local
planner state before bootstrap. Google must preserve those boundaries rather
than create a parallel identity store.

## Product decisions

### Google authentication: ship on both platforms

Google is added as one Better Auth provider with the web OAuth client first and
the iOS OAuth client second. The web authorization-code flow uses the first
client. Native Google Sign-In obtains an ID token for the iOS client and sends
it over HTTPS to Better Auth, which verifies its signature, issuer, expiry, and
audience before issuing the same Kairo session cookie used by every other
method.

Existing password or Apple users never merge silently. When Google identifies
an email that already belongs to another credential, Kairo directs the person
to sign in with the existing method and connect Google explicitly from
Settings. Linking requires an authenticated session and the Google email must
match the current Kairo account.

### Apple Reminders: justified launch exclusion

Apple Reminders import is excluded from the launch inventory.

EventKit provides no read-only Reminders permission. Reading reminders requires
`requestFullAccessToReminders`, which grants read and write access even though
Kairo's integration would be one-way. Shipping that permission would violate
data minimization, create unnecessary mutation authority over a person's
system reminders, and add duplicate/import-deletion semantics that are not
needed to meet the current parity gate. Kairo already supports account-level
read-only calendar import and first-class inbox capture.

The exclusion is a privacy decision, not a claim that ICS imports are
equivalent to Reminders. The parity row becomes `excluded`, is removed from the
denominator by the existing scoring contract, and can be reconsidered if Apple
offers read-only Reminders access or a future product case justifies the
broader permission.

## Server and web architecture

### Fail-closed provider configuration

Google is enabled only when all three values are non-empty:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The public capability response adds only `google: boolean`; it never exposes
secrets or identifiers. Google is absent from Better Auth when configuration
is partial. The provider accepts ID-token audiences for both platform client
IDs, uses the web ID for browser OAuth, requests only OpenID profile/email
identity scopes, and keeps `select_account` behavior explicit.

### Web sign-in and linking

The sign-in and sign-up cards receive the public capability flag from their
Server Component page and render a restrained Google action only when the
provider is complete. The action uses Better Auth's social redirect with
canonical success and error callbacks, disables while pending, and renders
calm failure feedback without provider payloads.

Settings gains a compact Connected sign-in methods card. It lists the current
Better Auth accounts, shows Google as connected when present, and otherwise
starts an authenticated `linkSocial` flow. This is the recovery path for
existing email/Apple accounts and makes the no-silent-merge policy actionable.

## Native architecture

### Official Google SDK

The XcodeGen source of truth pins GoogleSignIn-iOS 9.0.0 and links
`GoogleSignIn` plus `GoogleSignInSwift` only to the app target. Public OAuth
identifiers enter the generated Info.plist through build settings; local and
CI simulator builds remain possible without credentials, while the release
contract rejects an archive that lacks complete production identifiers.

The app uses the official SDK UI and obtains a refreshed ID token plus access
token. It never trusts a Google user ID. Cancellation is silent; missing or
invalid tokens produce actionable, provider-neutral errors.

### Better Auth transport

Manual native auth transport remains intentionally outside the planner
OpenAPI. Two operations are added:

- `POST /api/auth/sign-in/social` with `provider = google` and a Google ID
  token, then persist the returned cookie envelope in Keychain.
- `POST /api/auth/link-social` with the current session and the same verified
  token, without replacing or rewriting the session envelope.

The manual-operation inventory is extended so CI continues to reject any
unreviewed handwritten planner or auth transport.

### Native presentation

Capability discovery adds Google. The sign-in card shows the official Google
control alongside Apple and magic link, with dedicated loading and failure
states. Settings adds a Google connection card using the same explicit-linking
language as Apple. Synthetic UI fixtures prove unavailable, ready, loading,
linked, cancellation, and error states without invoking Google or mutating a
real account.

The existing `SignInSessionFinisher` remains the only post-auth transition:
persist, purge old account scope if necessary, then bootstrap.

## Security and privacy

- ID/access tokens, client secrets, cookies, and provider payloads are never
  logged.
- Native sends verifiable ID tokens, never a client-supplied user ID.
- Google access is identity-only; calendar scopes remain a separate,
  user-initiated integration.
- Provider tokens remain encrypted at rest through the existing Better Auth
  account option.
- Partial provider configuration is hidden rather than exposed as a broken
  action.
- Explicit linking requires a current session and matching verified email.
- The privacy policy and deployment runbook distinguish Google identity from
  Google Calendar access.

## Verification contract

Automated proof includes:

- complete/partial Google configuration, dual audiences, and public capability
  shape;
- browser sign-in redirect and explicit link behavior;
- native request bodies, verified-cookie persistence, link session
  preservation, cancellation, duplicate-account messaging, and account-switch
  purge;
- XcodeGen dependency pin, Info.plist identifiers, URL callback configuration,
  privacy manifest integrity, and release rejection when identifiers are
  incomplete;
- real-browser desktop/mobile auth-card proof and real-simulator native
  provider-state proof;
- full web/native gates and parity recomputation.

Live provider completion additionally requires Google Cloud web/iOS OAuth
clients, the production redirect URI
`https://time.neima.me/api/auth/callback/google`, Coolify environment values,
a signed iPhone build, and a real first-sign-in/link/relaunch/logout lifecycle.
Code, simulator fixtures, or an unauthenticated live capability probe do not
substitute for that evidence.

