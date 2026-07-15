# Kairo — 10-Phase 10× Wave 4 (production polish)

**Date:** 2026-07-15  
**Goal:** Close remaining product-quality gaps that block “daily driver” feel:
PWA install assets, calendar ICS import surface, real email when keyed, checklist
visibility, AI inbox grouping, keyboard UX, mutation rate limits, tests, ship.

**Baseline:** Waves 1–3 shipped write loop, routines/stats/AI, auth recovery.
Live healthy. Gaps: missing PWA icons (manifest 404), calendar service has no
route/UI, Resend still TODO, checklist not shown on timeline, inbox AI grouping
inert, no keyboard help.

**Cheap-subagent friendly:** P5/P8 tests, icon generation scripts, parity notes.

---

## Progress tracker

- [x] Phase 1 — PWA icons (192/512) + favicon polish
- [x] Phase 2 — Calendar ICS import API + Settings UI
- [x] Phase 3 — Resend email transport when `RESEND_API_KEY` present
- [x] Phase 4 — Checklist chips on timeline + focus steps display
- [x] Phase 5 — AI group-by-priority API + Inbox button
- [x] Phase 6 — Keyboard help (`?`) + `n` new activity shortcut
- [x] Phase 7 — Landing CTA polish + dead asset cleanup
- [x] Phase 8 — Rate-limit POST /api/v1/activities + tasks (SEC-06)
- [x] Phase 9 — Unit tests: ICS parser + calendar SSRF guards
- [x] Phase 10 — Gates, commit, push, Coolify deploy, live verify, handoff

---

## Done criteria
Each phase: code + gates green where applicable; Phase 10 requires live proof.
