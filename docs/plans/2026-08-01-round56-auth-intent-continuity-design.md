# Round 56 — truthful Inbox preview and safe auth intent continuity

## Context

Kairo's signed-out Inbox is a useful product preview, but its quick-capture row
looks fully editable. An anonymous visitor can type a thought and press Add,
only to receive the dead-end text `Sign in to save your thoughts.` with no
actionable route. The adjacent AI grouping control is disabled without saying
how to unlock it. Production browser evidence is saved at
`browser-qa/round56-inbox-auth/before-mobile.png` and
`browser-qa/round56-inbox-auth/before-error-mobile.png`.

Round 56 makes the preview capability honest and preserves the visitor's route
through every supported authentication method. It does not store, transmit, or
place an anonymous draft in a URL.

## Approaches considered

1. **Gate the whole Inbox behind authentication.** Simple, but removes a useful
   product preview and conflicts with the established fail-closed preview
   strategy.
2. **Truthful preview plus safe return path (selected).** Keep sample rows and
   read-only exploration, replace unavailable mutations with direct auth
   affordances, and return successful authentication to `/app/inbox`.
3. **Preserve the anonymous draft through authentication.** More seamless, but
   requires signed-out storage or query-string transport for potentially
   sensitive planner text. That privacy cost is not justified for this slice.

## User experience

Authenticated Inbox behavior remains unchanged.

When signed out:

- sample Inbox rows remain visible as a read-only preview;
- `Pick for me` remains available because it operates locally and its Focus
  destination already has a fail-closed auth boundary;
- the AI grouping control becomes an actual link labeled `Sign in for AI
  grouping`, not a disabled button;
- the quick-capture row no longer accepts text it cannot save. It presents a
  locked, read-only prompt plus a primary `Sign in to capture` link and concise
  supporting copy;
- sign-in and account-creation links carry an encoded internal `next` value of
  `/app/inbox`.

The signed-out UI uses existing Soft Focus tokens and control geometry. It adds
no new design tokens and keeps one clear primary action on mobile.

## Safe return-path contract

A shared pure helper accepts an untrusted search-param value and returns a
canonical internal destination. The contract is deliberately narrow:

- only a single string is accepted;
- the parsed URL must resolve to Kairo's synthetic same-origin base;
- the path must be `/app` or begin `/app/`;
- protocol-relative values, absolute external URLs, encoded origin escapes,
  backslash variants, and malformed inputs fall back to `/app/today`;
- query strings and fragments on a valid internal app path are preserved.

Both `/sign-in` and `/sign-up` parse `next` server-side and pass only the safe
value to `AuthForm`. The form uses it for:

- successful email/password navigation;
- magic-link `callbackURL`;
- Google `callbackURL`;
- sign-in/sign-up cross-links;
- Google `errorCallbackURL`, so a failed provider attempt retains the intended
  destination without trusting provider-controlled redirect data.

Account-linking from Settings keeps its existing fixed callback contract.

## Components and data flow

1. `InboxPage` determines authentication as it does today and passes `authed`
   into `InboxClient`.
2. `InboxClient` renders either the current mutation controls or the new
   explicit auth affordances. It never issues a protected API request while
   signed out.
3. Auth pages receive the raw `next` search parameter and normalize it with the
   shared helper before rendering the client form.
4. `AuthForm` and the Google sign-in flow receive only the normalized value.
5. On success, Better Auth or the client router returns to that destination.

## Error and privacy behavior

- Invalid return paths fail closed to `/app/today` and never reach router or
  provider callbacks.
- Authentication errors remain on the same auth page and preserve the safe
  destination.
- Anonymous Inbox text is not persisted, logged, queued, or encoded into the
  auth URL.
- No production planner mutation is required for verification.

## Verification

- Unit tests pin accepted and rejected return-path cases.
- Auth page/form tests pin safe parsing and callback propagation through email,
  magic-link, Google, and mode-switch links.
- Component tests pin authenticated controls and signed-out link semantics.
- Playwright proves the signed-out Inbox exposes actionable auth links, makes
  no `/api/v1/*` request, and carries `/app/inbox` through to the auth page.
- Existing auth, Google-linking, preview-boundary, and Inbox scheduling tests
  remain green.
- Full lint, typecheck, Vitest, production build, parity, Playwright, native
  main-thread gate, and iOS release preflight run before release.
- Desktop and 390px browser captures prove hierarchy, focus behavior, and no
  horizontal overflow. Production verification is read-only.

## Non-goals

- No anonymous draft persistence.
- No changes to authentication credentials, provider activation, sessions, or
  account-linking policy.
- No production data mutation.
- No change to the external Phase 7B or Phase 8B activation boundaries.
