# ADR-005 — Security & privacy invariants

Status: **Accepted** (2026-07-12). Binding. Maps to Codex review SEC-01…10.

1. **Authorization (SEC-01).** Every table has `user_id`. Every DAL query
   scopes by the authenticated session's user id in the same predicate.
   Client-supplied owner ids are ignored; nested resources verify parent
   ownership. Middleware is defense-in-depth only. Mandatory negative
   integration tests per resource: cross-user read/write → 404/403,
   unauthenticated → 401. Public IDs are random UUIDs. Postgres RLS may be
   added later as belt-and-braces; it does not replace query scoping.
2. **Sessions/CSRF (SEC-02).** Per ADR-003. User responses
   `private, no-store`. No state change on GET.
3. **Third-party tokens (SEC-03).** Google OAuth access/refresh tokens (and
   ICS URLs, which often embed secrets) envelope-encrypted (AES-256-GCM) with
   a key held in env (`op`-sourced), NOT in Postgres. Least scope (read-only
   calendar). Rotation, expiry, revocation, disconnect UI, deletion cascade.
   Tokens never logged; provider payloads redacted from error telemetry.
4. **ICS fetching / SSRF (SEC-04).** http/https only; resolve DNS then verify
   every hop's IP is public (re-verify on each redirect; max 3 redirects);
   response cap 5 MB; timeout 10 s; content-type/structure validation; retry
   cadence with jitter; URLs encrypted at rest and redacted in logs/UI.
5. **AI (SEC-05).** AI endpoints have no tools, no credentials, no mutation
   authority. Minimum necessary data; untrusted user fields delimited in
   prompts; strict zod output schema with length caps and unknown-field
   rejection; output rendered as text and applied only via per-item user
   confirmation; atomic per-user daily quota + IP throttle; timeout/cancel;
   prompts/outputs excluded from default logs; Anthropic data-retention noted
   in the privacy page. System prompts are mitigation, not a boundary —
   capability limitation is the control.
6. **Rate limiting (SEC-06).** Ships WITH each endpoint (auth, AI, ICS, push
   subscribe, batch). Shared store (Postgres or Redis) so limits hold across
   replicas. Proxy body-size and time limits configured in Coolify.
7. **Backups (SEC-07).** Encrypted automatic Postgres backups + off-host copy
   + retention + monitoring + a PROVEN restore drill BEFORE the first
   production migration (Phase 1B). Pre-migration backup every schema change.
8. **Push/offline data (SEC-08).** Subscriptions user-scoped and pruned;
   endpoints are secrets; lock-screen privacy toggle; local caches user-scoped
   and purged on logout/account switch; never cache auth responses.
9. **Headers (SEC-09).** CSP (report-only → enforce; no unsafe-inline/eval as
   convenience), X-Content-Type-Options, frame-ancestors 'none',
   Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimal.
   Verified on the LIVE URL by an automated Phase 1 test (headers may be set
   at the proxy, so test the deployed origin).
10. **Privacy lifecycle (SEC-10).** Data inventory + processors documented;
    JSON export; account deletion cascade (rows, OAuth revocation, push
    unsubscribe, queued jobs; backups age out by retention); log redaction +
    retention policy; App Store privacy labels before TestFlight.
