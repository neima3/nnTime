# Kairo — 10-Phase 10× Wave 3 (production hardness)

**Date:** 2026-07-15  
**Goal:** Harden Kairo for daily production use — auth recovery paths, honest
empty states, PWA install path, settings danger zone, tests, parity evidence,
and live proof — without inventing features that need external secrets Neima
hasn't provisioned (Resend/Anthropic still degrade honestly).

**Baseline:** Waves 1–2 shipped write loop + routines/stats/AI/month. Live
https://time.neima.me healthy. Residual: auth recovery UI, SW not registered,
authed empty states show mocks, few unit tests for client adapters, parity
checklist still "planned" credits.

**Contracts:** ADR-001…005, design-spec tokens only.  
**Gates:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.  
**Cheap-subagent friendly:** P5 tests, P8 parity row bulk updates, P9 QA scripts.

---

## Progress tracker

- [x] Phase 1 — Password reset + forgot-password UI (honest without Resend)
- [x] Phase 2 — Magic-link request UI on sign-in (plugin client)
- [x] Phase 3 — Honest empty states (routines/authed data never fake mocks)
- [x] Phase 4 — Register service worker + install/offline affordance
- [x] Phase 5 — Unit tests: adapters + localMinutesToInstant (97 tests)
- [x] Phase 6 — Settings danger zone: export + account delete confirm
- [x] Phase 7 — Navigation polish: Review Today, onboarding entry, more menu
- [x] Phase 8 — Parity checklist evidence pass for shipped web features
- [x] Phase 9 — Gates + live smoke of new auth routes
- [x] Phase 10 — Commit, push, Coolify deploy, live verify, handoff note

---

## Phase notes

### 1 — Password reset
- `/forgot-password` + `/reset-password` pages using Better Auth reset APIs.
- Without Resend: success copy says "if email is configured, check inbox" +
  dev logs still work.

### 2 — Magic link
- Auth client plugin; optional "Email me a link" on sign-in.
- Same honest empty-provider messaging.

### 3 — Empty states
- Authed user with 0 routines → empty UI, not mock library.
- Audit Today/inbox for same honesty.

### 4 — SW register
- Client `ServiceWorkerRegister` in root layout; version already v2.

### 5 — Tests
- Pure unit tests (no DB) for `localMinutesToInstant` / adapters.

### 6 — Account delete
- Settings: type-to-confirm DELETE with Confirm header.

### 7 — Nav
- Link Review Today from Today header; onboarding from settings/more.

### 8 — Parity
- Update checklist rows with SHIPPED evidence for web where true; run parity.mjs.

### 9 — Dogfood
- Local signup → create → complete → stats non-zero path.
- Live HTTP smoke of new routes.

### 10 — Ship
- Gates, push, deploy, verify live, progress.md.
