# Kairo — 20-Phase 10× Development Roadmap (post v2 foundation)

**Date:** 2026-07-14  
**Goal (full, non-negotiable):** Turn the server-complete foundation into a
**daily-usable visual planner** at https://time.neima.me — create → schedule →
drag → complete → focus → review — with evidence on desktop + mobile, gates green,
and no parity regression. Keep ≥85% planned web/iOS coverage; convert “implemented
server-side” rows into **shipped-with-UI-evidence** wherever this plan touches them.

**Current truth (2026-07-14 audit):**
- Auth signup/login + real account data round-trip works LIVE.
- Today/inbox/routines **read** real data when authed; mock fallback when logged out.
- Timeline drag UI exists but **PATCH `/api/v1/activities/{id}` returns 501**.
- Editor sheet, FAB, complete buttons are **inert design references**.
- Focus / AI / routines / stats / privacy services exist; many **lack route handlers**.
- iOS Swift package scaffold exists; not the priority of this 20-phase push (web first).
- 1B staging/automated backups remain Coolify-UI gated on Neima (not blocking product loop).

**Binding contracts:** ADRs 001–005, `docs/design/design-spec.md` (tokens only).  
**Gates:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before commit.  
**Evidence:** browser desktop+mobile screenshots in `browser-qa/` (git-ignored).  
**Deploy:** Coolify → time.neima.me; verify live after push when shipping user-facing.

---

## Progress tracker

- [x] Phase 1 — Activity PATCH + edit scopes wired (kill 501)
- [x] Phase 2 — Activity editor create flow + FAB
- [x] Phase 3 — Complete / skip / delete on Today timeline
- [x] Phase 4 — Day navigation + real-time now-line
- [x] Phase 5 — Inbox CRUD + promote to Anytime/scheduled
- [x] Phase 6 — Focus session API routes + Focus screen wiring
- [x] Phase 7 — Missing API surface (day, privacy export/delete; routines/batch partial)
- [x] Phase 8 — Routines create/edit/pause UI (Wave 2)
- [x] Phase 9 — Week view: real data + day/activity links (month still thin)
- [x] Phase 10 — Review Today: let-go / reschedule / complete
- [x] Phase 11 — Settings personalization wired end-to-end
- [x] Phase 12 — Stats + mood check-ins UI (Wave 2)
- [x] Phase 13 — Templates gallery apply → real activities
- [x] Phase 14 — AI co-planner API + editor/Today entry points (Wave 2)
- [x] Phase 15 — Auth polish: magicLink plugin (Resend email still optional)
- [x] Phase 16 — Offline mutation queue + SW reliability (Wave 2 finish)
- [x] Phase 17 — Accessibility pass (Escape, skip link, labels)
- [x] Phase 18 — Performance: live nowMin for block states
- [x] Phase 19 — Dogfood QA sweep + P0/P1 fixes with evidence
- [x] Phase 20 — Deploy, live verify, parity update, handoff note

---

## Phase 1 — Activity PATCH + edit scopes *(mechanical / strong model)*

**Objective:** Make timeline drag/resize and editor saves actually persist.

**Tasks:**
1. Wire `PATCH /api/v1/activities/[id]` to `editSeriesOccurrence` (scope `all` for
   one-offs; accept `editScope`, `occurrenceKey`, field patch, `If-Match`).
2. Map DAL/service revision conflicts to 409; missing If-Match → 428.
3. Fix `TodayTimeline` time conversion (use user zone / date, not local `new Date()`
   wall-clock alone if zone differs).
4. Unit/integration coverage for happy path + 409.

**Files:** `src/app/api/v1/activities/[id]/route.ts`,
`src/server/services/recurrence.ts`, `src/components/TodayTimeline.tsx`, tests.

**Verify:** Authed drag move → reload → position stuck. PATCH 200; conflict 409.  
**Done:** 501 gone; drag persists; gates green.

---

## Phase 2 — Activity editor create + FAB *(design-sensitive)*

**Objective:** User can create an activity from FAB or empty-slot tap without REST tools.

**Tasks:**
1. Convert `/app/editor` from static mock → client sheet driven by query params
   (`?start=&date=&id=` for edit).
2. Load categories from `/api/v1/categories`; POST create / PATCH update.
3. Fields: title, emoji, category, date, start time, duration, energy, priority,
   notes, optional checklist steps (template JSON).
4. FAB on Today → `/app/editor` (create). Empty-slot create already navigates — keep.
5. Save → redirect Today; Cancel → back. Design tokens only; match design-spec modal.

**Verify:** Browser: sign in → FAB → fill → Save → block appears on timeline.  
**Done:** Create path works authed desktop+mobile; screenshots in browser-qa.

---

## Phase 3 — Complete / skip / delete on Today *(product core)*

**Objective:** Full lifecycle without leaving Today.

**Tasks:**
1. Complete button on blocks → occurrence status `completed` (or series one-off
   completion via occurrence upsert + planner_events).
2. Optimistic UI + undo toast (revision conflict rollback).
3. Delete with confirmation (tombstone via DELETE + If-Match).
4. Skip action for Review-compatible status.
5. Pass `revision` / occurrence identity through adapters so client has If-Match.

**Verify:** Complete → strikethrough + progress ring updates; reload persists.  
**Done:** create→complete→delete loop in browser evidence.

---

## Phase 4 — Day navigation + real now-line

**Objective:** Browse days; now-line uses actual clock (not fixed 13:00 mock).

**Tasks:**
1. Today prev/next/Today control updates `?date=YYYY-MM-DD` and reloads resolved day.
2. `getResolvedDay(date)` path used by page.
3. `LiveNowLine` / `TodayTimeline` use live minutes when viewing today; hide or
   freeze when viewing other days.
4. SoftStreaks stays non-blocking.

**Verify:** Navigate to tomorrow → empty/other data; back to today → live now-line moves.  
**Done:** Date query works; no mock NOW_MIN on live today.

---

## Phase 5 — Inbox CRUD + promote

**Objective:** Brain-dump list is real and actionable.

**Tasks:**
1. Add todo form on inbox (POST task bucket=inbox).
2. Complete/delete tasks with If-Match.
3. Promote: inbox → anytime (date) or schedule as activity (create series + tombstone task).
4. Anytime rail on Today can complete / open editor to schedule.

**Verify:** Create inbox item → appears; promote → appears Anytime/timeline.  
**Done:** Inbox no longer mock-only for authed users for write paths.

---

## Phase 6 — Focus session API + Focus screen

**Objective:** Server-authoritative focus usable from UI.

**Tasks:**
1. Routes: `POST /api/v1/focus-sessions`, transition, extend (+1/+5/+10), GET active.
2. Wire `/app/focus` to start from activity id query / current block.
3. Pause/resume/complete/extend controls call API; remaining time from server.
4. Checklist-during-focus if template present.

**Verify:** Start focus → pause → extend → complete; session survives refresh.  
**Done:** Focus is not mock timer only when authed.

---

## Phase 7 — Missing API surface

**Objective:** Close OpenAPI gaps used by web + future iOS.

**Tasks:**
1. `GET /api/v1/day/{date}` using `getResolvedDay`.
2. Routines CRUD routes (list/create/patch/delete + schedules pause).
3. `POST /api/v1/batch` ordered mutations.
4. Privacy: `GET export`, `DELETE account` (confirm header).
5. Keep SEC-01 scoping + rate limits where applicable.

**Verify:** Contract tests / manual curl with session cookie; 401 unauthenticated.  
**Done:** Routes exist + basic tests; no OpenAPI lie for wired paths.

---

## Phase 8 — Routines create/edit/pause UI

**Objective:** Personal routine library is writable.

**Tasks:**
1. Wire routines page to list API; add create sheet (name, steps, schedule rrule).
2. Pause/resume schedule toggle.
3. Materializer remains server job (tick or on-demand trigger endpoint optional).

**Verify:** Create routine → appears; pause stops future materialization (unit/service).  
**Done:** Authed routines page is interactive.

---

## Phase 9 — Week + month real actions

**Objective:** Multi-day views aren’t read-only posters.

**Tasks:**
1. Ensure week/month load real series for range.
2. Tap day → Today with that date; tap activity → editor.
3. Lightweight create from week empty cell (optional if time).

**Verify:** Week shows real blocks; navigation works mobile.  
**Done:** Week+month useful for navigation + glance.

---

## Phase 10 — Review Today flow

**Objective:** End-of-day unfinished items can be cleared productively.

**Tasks:**
1. Load unfinished for selected date from occurrences/series.
2. Actions: complete, let-go (skip), move to tomorrow (reschedule).
3. Write planner_events for history/stats.

**Verify:** Leave incomplete → Review → let-go → gone from open list.  
**Done:** Review is actionable for authed users.

---

## Phase 11 — Settings personalization

**Objective:** Theme, reduced stimulation, fonts, week-start, hour cycle stick.

**Tasks:**
1. Settings form PATCH `/api/v1/settings`.
2. Apply theme/class on document from settings (client + root layout preference).
3. Dyslexia / larger text / high-contrast classes per design-spec tokens.

**Verify:** Toggle dark → reload still dark; week-start affects week view.  
**Done:** Personalization not cosmetic-only.

---

## Phase 12 — Stats + mood

**Objective:** Insights page shows real planner_events data.

**Tasks:**
1. Stats API or server component using `getStats`.
2. Mood check-in control writes via service.
3. Empty states honest when no history.

**Verify:** After completes, stats show non-zero; mood records.  
**Done:** Stats page authed path real.

---

## Phase 13 — Templates apply

**Objective:** Built-in templates become real activities/routines.

**Tasks:**
1. Template list from service; Apply creates series/tasks for a chosen date.
2. Success toast + link to Today.

**Verify:** Apply “Morning reset” → Today gains blocks.  
**Done:** Templates are productive, not brochure.

---

## Phase 14 — AI co-planner surface

**Objective:** Breakdown / NL add / plan-my-day reachable from UI (SEC-05).

**Tasks:**
1. Routes under `/api/v1/ai/*` with quota + zod-strict outputs; no tools.
2. Editor “Break it down” + shell AI card entry.
3. Graceful degrade when `ANTHROPIC_API_KEY` missing (clear UI message).

**Verify:** With key: breakdown returns steps; without: honest error.  
**Done:** AI entry points not dead ends.

---

## Phase 15 — Auth polish

**Objective:** Magic-link + reset match ADR-003 (or honest partial + Resend flag).

**Tasks:**
1. Fix Better Auth magicLink **plugin** wiring.
2. Password reset UI if email provider available; else document blocker.
3. Session revoke-all in UserMenu advanced section if trivial.

**Verify:** Email path if Resend present; otherwise code ready + progress note.  
**Done:** No silent no-op plugins.

---

## Phase 16 — Offline queue + SW

**Objective:** Mutations queue when offline; flush on reconnect.

**Tasks:**
1. Harden `offline-queue.ts` for create/complete/patch.
2. SW version bump; app-shell cache; no user-data caching across accounts.
3. OfflineIndicator accuracy.

**Verify:** DevTools offline → complete → online → persists (or clear failure).  
**Done:** PWA offline path smoke-tested.

---

## Phase 17 — Accessibility

**Objective:** WCAG AA core flows.

**Tasks:**
1. Keyboard: timeline, editor, FAB, dialogs (focus trap, Escape).
2. Aria labels on complete/drag handles; live regions for toasts.
3. Contrast check on category fills (token-level only).

**Verify:** Keyboard-only create+complete path.  
**Done:** No critical a11y regressions on Today/editor.

---

## Phase 18 — Performance

**Objective:** Snappy Today on mobile.

**Tasks:**
1. Avoid double-fetch; stream where sensible; keep client islands minimal.
2. Image/font already tokenized — audit unused client bundles on Today.
3. Target: interactive timeline without multi-second blank.

**Verify:** Local Lighthouse or web-vitals note; no regression vs prior 6D.  
**Done:** Documented numbers; obvious jank fixed.

---

## Phase 19 — Dogfood QA

**Objective:** Find and fix P0/P1 with evidence.

**Tasks:**
1. Scripted dogfood: signup → plan day → drag → complete → focus → review → settings.
2. Mobile 375 + desktop 1440 screenshots.
3. Fix all P0 and top P1s in-session.

**Verify:** Written `docs/plans/dogfood-20.md` with outcomes.  
**Done:** P0 = 0 open for core loop.

---

## Phase 20 — Ship + handoff

**Objective:** Production reflects the product loop; next agent knows state.

**Tasks:**
1. Full gates; commit; push; Coolify deploy; live verify create/complete.
2. Update `parity-checklist.md` rows with evidence; run `parity.mjs`.
3. Append `progress.md`; tick phases honestly (partials named).
4. Update agent prompt pointer to this roadmap.

**Verify:** Live account on time.neima.me creates + completes an activity.  
**Done:** Handoff complete; residual backlog listed.

---

## Execution rules for agents
- Execute **first unchecked phase** fully (or a contiguous batch if tightly coupled),
  then update this checklist + `progress.md`.
- Do not tick a phase without evidence (test/browser/live as specified).
- Design-sensitive phases (2, 8, 11, 14 UI): keep Soft Focus tokens; no Inter/raw hex.
- Cheap subagents OK for mechanical API wiring/tests; verify before ticking.
- Never destructive-prod tests beyond synthetic accounts; no DROP migrations.
- Secrets only in `.env.local` / Coolify; never commit.
