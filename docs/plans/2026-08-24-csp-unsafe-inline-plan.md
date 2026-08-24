# A9 — dropping `'unsafe-inline'` from `script-src` (research + staged plan)

Status: RESEARCH — nothing here is landed. ADR-005 wants `script-src` without
`'unsafe-inline'`; the plan of record explicitly forbids landing a broken CSP.
This doc records what actually stands in the way in THIS repo and the staged
path out. Written 2026-08-24 (Round 91).

## Current state (verified in source)

- Enforcing CSP lives in `src/proxy.ts` `SECURITY_HEADERS`:
  `script-src 'self' 'unsafe-inline'` (plus a locked-down rest — object-src
  none, frame-ancestors none, base-uri self).
- First-party inline scripts, the complete list:
  1. `src/app/theme-script.tsx` — pre-paint theme/a11y class application.
     **Static text per build** (interpolates only compile-time constants from
     `a11y-prefs.ts`) → hashable as-is.
  2. `src/app/app/layout.tsx` (~line 60–94) — settings bootstrap that inlines
     PER-USER values (`theme`, `hourCycle`, serialized a11y prefs) into the
     script body → **not hashable** (differs per request) and not nonce-able
     on any route that is ever static.
- Framework reality: Next 16 emits its own inline bootstrap scripts on every
  document response. Next supports per-request **nonces** (read from the CSP
  request header set in proxy/middleware and stamped onto framework scripts),
  but ONLY for dynamically rendered documents — a nonce baked into
  prerendered HTML is a replayed nonce, i.e. no CSP at all.
- Route census from `pnpm build`: most product routes are already ƒ (dynamic)
  because they read the session. Static (○) documents: `/` (landing),
  `/onboarding`, `/privacy`, plus the 404 shell. Those four are the only
  pages that cannot take a per-request nonce today.

## Why "just add a nonce" breaks

One CSP is stamped by `src/proxy.ts` for every response. A nonce policy on a
static page = the prerendered HTML carries no (or a stale) nonce → every
script blocked → blank page. That is the "broken CSP" the plan forbids.

## Staged plan (each stage independently shippable + revertible)

**Stage 1 — make first-party scripts hash-friendly (pure refactor, no CSP
change).** Rework the app-layout bootstrap so the SCRIPT TEXT is constant:
SSR the per-user values as `data-*` attributes on a `<meta>`/`<html>` node
(HTML, not script — CSP-irrelevant), and have a static script read them.
After this, both first-party scripts are fixed strings whose SHA-256 can be
computed at build (a tiny unit test pins hash ↔ source drift).

**Stage 2 — split the CSP by render mode in `src/proxy.ts`.** The proxy
already sees every request. Emit:
- Static allowlist (`/`, `/onboarding`, `/privacy`, 404): keep today's policy
  (these pages are session-free marketing/legal surfaces; the relaxation is
  contained and documented).
- Everything else: `script-src 'self' 'nonce-{fresh}' 'sha256-{theme}'
  'sha256-{bootstrap}' 'strict-dynamic'`, generating the nonce per request
  and forwarding it via request header so Next stamps framework scripts.
  `'strict-dynamic'` lets nonce-blessed framework scripts load their chunks
  without enumerating them.

**Stage 3 — prove, then enforce.** Run Stage 2's strict policy as
`Content-Security-Policy-Report-Only` ALONGSIDE the enforcing lax one for a
round; drive the full e2e suite + a manual pass (sign-in, Today, focus,
arcade, settings, offline replay) and check zero violations. Only then swap
enforcing. One commit each way = one-commit revert.

Open question for Stage 3: violation reporting. CSP `report-to` posts
unauthenticated JSON; the 6.2 sink (`/api/v1/client-errors`) is
deliberately session-only. Either add a separate unauthenticated,
hard-rate-limited `/api/csp-report` endpoint (SEC-06 applies; body is
attacker-controlled — cap + redact) or ship Stage 3 report-less and rely on
the e2e sweep. Decide at Stage 3, not before.

## Non-goals

- No `style-src` change in this arc (`'unsafe-inline'` styles are a separate,
  lower-risk cleanup with Tailwind runtime realities of its own).
- No `unsafe-hashes`, no `unsafe-eval` — never needed here (dev-mode React
  eval warnings are dev-only noise).

## Effort guess

Stage 1 ≈ half a session (touches the no-flash path — needs the fixture tour
and a dark/light/dyslexia manual check). Stage 2+3 ≈ one careful session
with the e2e suite as the gate. Do not combine with a migration deploy.
