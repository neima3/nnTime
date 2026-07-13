# ADR-003 — Authentication (web + native iOS)

Status: **Accepted** (2026-07-12). Binding.

## Web (Phase 1C)
- Better Auth, Postgres adapter. Methods at launch: email+password AND magic
  link. Google sign-in added in Phase 8B (web + iOS together).
- Email+password: verification email required before first planner write;
  password reset flow; passwords argon2/bcrypt per Better Auth defaults.
- Magic link: single-use, 15-minute expiry, generic "check your email"
  response regardless of account existence (no enumeration). Mail provider:
  Resend (key via `op`, stored `.env.local` + Coolify env).
- Sessions: HttpOnly, Secure, SameSite=Lax cookies; 30-day absolute lifetime,
  rotation on privilege-sensitive events; logout and revoke-all-devices
  endpoints. Canonical origin `https://time.neima.me`; trustedOrigins limited
  to it (+ staging origin on staging).
- CSRF: cookie-authenticated mutations require Origin/Fetch-Metadata check
  (reject cross-origin); no state changes on GET.
- Middleware on `/app/*` is a UX redirect only. **Every** `/api/v1` handler
  authenticates and authorizes internally (see ADR-005 #1).
- Rate limits (Phase 1C, shared store): signup/login/reset/magic-link
  throttled by IP + account.

## Native iOS (Phase 7B)
- Transport: the iOS app authenticates against the same Better Auth REST
  endpoints; session token stored in **Keychain**
  (kSecAttrAccessibleAfterFirstUnlock), attached as bearer/cookie per Better
  Auth session semantics; refresh/expiry handled by an auth interceptor;
  401 → re-auth flow.
- Magic link on iOS: universal link `https://time.neima.me/auth/callback?...`
  (associated domains), fallback custom scheme `kairo://auth`.
- Sign in with Apple: nonce + state validated server-side; private-relay
  emails are first-class; account linking by verified email where present,
  otherwise a distinct account with an in-app "link accounts" path; duplicate-
  account policy: prefer linking prompt over silent merge.
- Logout: revoke server session, purge Keychain + local store + caches.
- Better Auth's Expo plugin is NOT used; the SwiftUI client implements the
  documented REST/session flow directly. 7B is done only when proven on a
  physical device.
