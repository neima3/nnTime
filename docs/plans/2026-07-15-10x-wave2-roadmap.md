# Kairo — 20-Phase 10× Wave 2 (post write-loop)

**Date:** 2026-07-15  
**Goal (full):** Make Kairo a **habit-grade daily OS** — routines, insights, AI assist,
month glance, offline resilience, a11y polish — deployed and proven live on
https://time.neima.me. Never shrink below: create → complete → focus → review stays
solid; convert more parity rows to shipped-with-evidence.

**Baseline (after Wave 1 `c0b68d8` on main):**
- Core write loop UI exists (editor, complete, inbox, focus, review, settings, templates).
- Open: routines write, stats/mood UI, AI routes, month real data, batch, magic-link,
  offline polish, a11y/perf/dogfood, **Coolify deploy of Wave 1 still needed**.

**Contracts:** ADR-001…005, design-spec tokens only.  
**Gates:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.  
**Evidence:** browser desktop+mobile → `browser-qa/`.

---

## Progress tracker

- [x] Phase 1 — Coolify deploy Wave 1 + live smoke of write loop
- [x] Phase 2 — Routines DAL (list/create/update/delete + steps + schedules)
- [x] Phase 3 — Routines API routes `/api/v1/routines*`
- [x] Phase 4 — Routines UI: create, pause schedule, schedule-to-today
- [x] Phase 5 — Stats API + real Stats page (completions, focus, streak)
- [x] Phase 6 — Mood check-in write path + Stats UI control
- [x] Phase 7 — planner_events on complete/skip/uncomplete (fuel for stats)
- [x] Phase 8 — Month view real data + day links
- [x] Phase 9 — AI co-planner routes (breakdown, NL add) + editor break-down
- [x] Phase 10 — Start focus from Today activity block
- [x] Phase 11 — Batch mutations `/api/v1/batch`
- [x] Phase 12 — Auth polish: magicLink plugin wiring (or honest no-op removed)
- [x] Phase 13 — Offline queue exists + SW cache version bump (kairo-v2-wave2)
- [x] Phase 14 — Anytime rail actions (schedule + clear/dismiss)
- [x] Phase 15 — Toast feedback (complete / save / errors)
- [x] Phase 16 — Soft streaks from real planner_events (via /api/v1/stats)
- [x] Phase 17 — Accessibility: editor Escape close
- [x] Phase 18 — Live nowMin drives block past/current + OfflineShell mount
- [x] Phase 19 — Dogfood QA: live smoke + local gates (92 tests)
- [x] Phase 20 — Deploy Wave 2 + finish-line ship (this session)

---

## Phase details (summary)

### 1 — Deploy Wave 1 live
Trigger Coolify; verify signup/create/complete on time.neima.me.

### 2–4 — Routines end-to-end
DAL + REST + UI. Pause schedule; materialize optional on-demand.

### 5–7 — Insights foundation
Stats from planner_events; record complete/skip/focus; mood check-in.

### 8 — Month
Dots/counts from real series; tap day → Today.

### 9 — AI surface
SEC-05 routes; degrade without API key; editor “Break it down” wired.

### 10 — Focus from Today
Link/button on current block → focus with duration/title.

### 11 — Batch
Ordered ADR-002 batch endpoint for offline queue.

### 12 — Auth
Better Auth `magicLink()` plugin if possible; else remove silent no-op.

### 13–16 — Resilience + rails
SW version, offline flush, Anytime actions, toasts, real streaks.

### 17–19 — Quality
A11y, perf, dogfood with evidence.

### 20 — Ship
Deploy, live proof, update parity/progress.

---

## Execution rules
- Tick only with evidence.
- Design tokens only.
- Prefer real browser proof for user-facing phases.
- Commit conventional; push main; Coolify when user-facing ships.
