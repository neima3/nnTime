# Full UI / Client Review — Kairo (nnTime)

**Date:** 2026-07-18  
**Scope:** Client components, app pages, client data fetching, UX, a11y, design-token compliance  
**Mode:** Read-only code review (no runtime browser QA in this pass)

---

## Summary

The Soft Focus visual system is well respected in client components (tokens, type scale, focus rings, category pastels). Timeline drag/keyboard, editor sheet, focus timer, and inbox write paths are real and largely coherent.

The highest-risk client bugs are **wrong `editScope` on mutations** (drag, checklist, review “tomorrow”, editor save all use series-level `all`), **now-line / “today” computed in browser local or UTC instead of planning zone**, and **offline queue infrastructure that is never called from mutations** (with logout not purging user-scoped cache). Toast/error UX is uneven: conflict toasts exist on some paths and silent failures on others. A11y is good on timeline blocks and many icon buttons; dialogs lack focus traps.

---

## Issues

### 1. Severity: critical  
**File:** `src/components/TodayTimeline.tsx:143–154`  
**Description:** Checklist step toggles PATCH the series with `editScope: "all"` and rewrite `checklistTemplate` including `done` flags. Completing a step on today’s block permanently alters the series template for every future occurrence. Server already supports occurrence-level `checklistOverride` / checklist items.  
**Suggestion:** Toggle via occurrence override (`editScope: "this"` + `occurrenceKey` + checklist override) or checklist-items API; keep template labels, not per-day done state, on the series.  
**Status:** open

### 2. Severity: high  
**File:** `src/components/TodayTimeline.tsx:57–61`, `src/components/ActivityEditor.tsx:237–238`  
**Description:** Drag/resize and full activity save always send `editScope: "all"`. For any recurring series this rewrites all instances; design-spec requires an ADR-001 edit-scope save prompt (this / this_and_future / all). Editor has no Repeat / scope UI at all.  
**Suggestion:** For one-offs, `all` is fine. For recurring, prompt scope; default drag on a single day to `this` (or at least `this_and_future` when intentional).  
**Status:** open

### 3. Severity: high  
**File:** `src/components/ReviewClient.tsx:72–91`  
**Description:** “Tomorrow” moves the activity with `editScope: "all"` and a new `dtstartLocal`. That relocates the entire series, not the reviewed occurrence—destructive for routines/recurrence.  
**Suggestion:** Use `editScope: "this"` with a reschedule/skip + create pattern, or `this_and_future` only when user confirms.  
**Status:** open

### 4. Severity: high  
**File:** `src/components/LiveNowLine.tsx:17–19`, `TimelineCanvas.tsx:124–125`  
**Description:** Live now-line uses `Date#getHours/getMinutes` (browser local), not the user’s planning timezone from settings / day load. Travelers or TZ mismatch show wrong current block, past/future styling, and auto-scroll. Server `today` page correctly uses planning zone for “up next,” but the live canvas does not.  
**Suggestion:** Pass `zone` into `useLiveNowMin` and compute minutes via `Intl` / existing `dateToMinutesFromMidnight(new Date(), zone)`.  
**Status:** open

### 5. Severity: high  
**File:** `src/lib/offline-queue.ts` (enqueue unused), `src/components/UserMenu.tsx:36–39`  
**Description:** `enqueueMutation` is never called from any client write path—only `initOfflineQueue` / pending count. Offline indicator can claim “queued” only if something enqueued; real mutations still go direct `fetch` and fail offline. Sign-out never calls `purgeUserCache` (ADR-002). `kairo:conflict` is dispatched but no UI listens.  
**Suggestion:** Route mutations through `enqueueMutation` when offline (or always for idempotent writes); on logout call `purgeUserCache(userId)`; surface terminal conflicts via toast.  
**Status:** open

### 6. Severity: medium  
**File:** `src/components/TodayTimeline.tsx:64–73`, `91–124`  
**Description:** Non-409 failures on drag/complete/step often return `{ ok: false }` with **no toast** (complete never toasts on failure; update only toasts 409). Unauthenticated drag rolls back with conflict flash, which is misleading. Network `catch` is silent.  
**Suggestion:** Toast distinct messages: conflict / network / sign-in / generic; only use conflict banner for true 409.  
**Status:** open

### 7. Severity: medium  
**File:** multiple clients using `new Date().toISOString().slice(0, 10)`  
**Examples:** `ActivityEditor.tsx:80`, `InboxClient.tsx:205,253`, `PlanDayClient.tsx:65`, `KeyboardShortcuts.tsx:45`, `RoutinesClient.tsx:144`  
**Description:** Client “today” is **UTC date**, not planning zone or local calendar date. After ~evening US time, schedule/promote/plan flows target the wrong day.  
**Suggestion:** Shared helper: `instantToDateStr(new Date(), zone)` (or local equivalent) everywhere client code needs “today.”  
**Status:** open

### 8. Severity: medium  
**File:** `src/components/InboxClient.tsx:61–97`  
**Description:** “Group by priority” updates local React state only; toast says “suggestion — save via edit later.” Users expect priorities to stick after AI grouping; no PATCH to tasks.  
**Suggestion:** Persist priority per task with `If-Match`, or clearly block as preview with Accept that writes.  
**Status:** open

### 9. Severity: medium  
**File:** `src/components/InboxClient.tsx:55`, `AnytimeRail.tsx:31`, `ReviewClient.tsx:38`  
**Description:** `useState(initial*)` does not reset when Server Component props change after `router.refresh()`. Can show stale lists if parent revalidates while client held local edits, or miss server-side corrections.  
**Suggestion:** `useEffect(() => setItems(initial), [initial])` with stable serialization, or key the client from a server-provided revision hash.  
**Status:** open

### 10. Severity: medium  
**File:** `src/components/FocusClient.tsx:165–187`, `src/app/app/focus/page.tsx:17–27`  
**Description:** `activityId` is shown as a debug slice but **not sent** on `POST /api/v1/focus-sessions`. Steps prop is never loaded from the activity; completing focus does not complete the linked activity. Design contract ties Focus to the current activity.  
**Suggestion:** Pass `activityId` (and title/emoji from server session), load checklist from activity, optionally complete activity on session complete.  
**Status:** open

### 11. Severity: medium  
**File:** `src/components/Toast.tsx`, `AppShell.tsx`, `KeyboardShortcuts.tsx`  
**Description:** `ToastHost` is mounted only on some routes (today, inbox, routines, stats, planner)—not AppShell—so toasts from other screens fail silently if host missing. `KeyboardShortcuts` help overlay is **never mounted**. AppShell duplicates nav shortcuts with `window.location.href` (full reload) instead of `router.push`, and omits `?` help.  
**Suggestion:** Mount `ToastHost` + single shortcuts handler once in AppShell; use client navigation.  
**Status:** open

### 12. Severity: medium  
**File:** `src/components/AmbientSounds.tsx:7–8`, `src/app/app/today/page.tsx:341–344`  
**Description:** Comment claims ambient audio “keeps playing across navigation” via AppShell mount; component only lives in Today’s aside, so navigation **stops audio** (cleanup pauses).  
**Suggestion:** Lift to AppShell (or layout) if cross-route playback is intended; fix the comment if not.  
**Status:** open

### 13. Severity: medium  
**File:** `src/components/ActivityEditor.tsx:305–311`, `KeyboardShortcuts.tsx:56–61`  
**Description:** `role="dialog"` / `aria-modal="true"` without focus trap, initial focus containment, or restore focus on close. Escape works on editor; emoji picker has no Escape/outside-click. Screen-reader users can tab into page behind modal.  
**Suggestion:** Focus first field on open, trap Tab within dialog, restore focus to opener; close emoji on outside click / Escape.  
**Status:** open

### 14. Severity: medium  
**File:** `src/app/app/week/page.tsx:118–125`, `src/server/services/day.ts:61–68`  
**Description:** Signed-in week (and day resolution) filter only series whose **series `dtstart` wall date** matches the day—no RRULE expansion. Recurring activities disappear after the first day; signed-out mock week looks fuller than real data.  
**Suggestion:** Expand occurrences for the week/day range (server), then map to UI blocks.  
**Status:** open (server + client display)

### 15. Severity: low  
**File:** `src/components/TimelineCanvas.tsx:118–120`, `421–428`, `481–493`  
**Description:** On successful complete/step toggle, optimistic maps are not cleared; they remain until remount. Usually matches server after refresh, but can mask later server-side changes or multi-tab updates.  
**Suggestion:** Clear optimistic entry on `ok` after refresh, or key maps by revision.  
**Status:** open

### 16. Severity: low  
**File:** `src/components/SettingsClient.tsx:312–321`, `367–378`  
**Description:** “Reduced stimulation” toggle duplicated under Appearance and Access; Notifications row is non-interactive chevron only.  
**Suggestion:** Single toggle; wire notifications when push exists, or hide row.  
**Status:** open

### 17. Severity: low  
**File:** `src/components/AppShell.tsx:47–58`  
**Description:** Global letter shortcuts (`n/t/i/w/f/s`) fire even when a modal/editor is open (unless focus is in input). Opening editor via `n` then pressing `t` hard-navigates away mid-edit.  
**Suggestion:** Disable shell shortcuts when `role=dialog` open or path is `/app/editor`.  
**Status:** open

### 18. Severity: low  
**File:** `src/app/app/today/page.tsx:57–70`  
**Description:** Signed-out users see full mock timeline as if it were their day (by design as design reference). Drag/complete are no-ops or soft-fail; FAB still opens editor (create will 401). Can confuse “am I signed in?”  
**Suggestion:** Persistent signed-out banner (“Preview data — sign in to save”) already partially on Up-next; extend to timeline header.  
**Status:** open (product UX)

### 19. Severity: nit  
**File:** design tokens in components  
**Description:** No raw hex / Inter / pure `text-white`/`bg-black` found in `src/components` or app pages; hex lives correctly in `globals.css`. `theme-script.tsx` uses `dangerouslySetInnerHTML` with a static string (acceptable). No user-controlled HTML injection found.  
**Suggestion:** Keep token discipline; no action required.  
**Status:** n/a (positive)

### 20. Severity: nit  
**File:** `src/components/TimelineCanvas.tsx:242`  
**Description:** Dead switch case `"ArrowUp+Shift"` never matches (`e.key` is still `"ArrowUp"`); shift+arrows already handled via `delta`. Harmless.  
**Status:** open

---

## Strengths

- **Design-token compliance** is strong: category fills/inks, iris/now/success/danger, surfaces, display/sans/mono fonts via CSS variables—matches design-spec hard rules.
- **Timeline a11y baseline**: blocks are `role="button"` with rich `aria-label`, arrow/+/− keyboard move/resize, complete/focus/step controls labeled, focus-visible rings.
- **Optimistic concurrency awareness**: `If-Match` + 409 handling on several paths; canvas conflict flash + banner for drag failures.
- **Empty/loading patterns**: Focus loading skeleton, settings skeleton + signed-out card, inbox empty state, today empty day CTA.
- **ADHD-friendly copy** and Soft Focus motion/radius patterns are consistent across Today, Inbox, Focus, Settings.
- **Cleanup hygiene** on intervals/listeners generally correct (`LiveNowLine`, `FocusClient`, `OfflineIndicator`, ambient pause on unmount).

---

## Test gaps

1. **Recurring series** — drag, edit save, checklist toggle, review tomorrow/complete with multi-instance RRULE (editScope matrix).  
2. **Timezone** — planning zone ≠ browser local: now-line, up-next, client “today” dates, day navigation near midnight UTC.  
3. **Offline / multi-tab** — mutations while offline; reconnect flush; account switch / logout IndexedDB purge; 409 from concurrent edits.  
4. **Toast host** — assert toasts work from Focus, Settings, Editor, Week (currently host-absent).  
5. **Keyboard** — focus trap in editor dialog; shell shortcuts while dialog open; `?` help if product still wants it.  
6. **Focus session lifecycle** — start with `activityId`, pause/resume accuracy across rehydrate, complete updates activity status.  
7. **Inbox AI group + promote** — priorities persisted; promoteAnytime path without duplicate tasks; undo after delete.  
8. **Real-browser evidence** — mobile bottom nav safe-area, 44px targets, timeline drag on touch, reduced-stimulation class effects (not verified in this pass).

---

## Suggested fix order

1. Checklist + editScope correctness (#1–#3)  
2. Planning-zone now-line and client “today” (#4, #7)  
3. Wire or strip offline queue + logout purge (#5)  
4. Global ToastHost + consistent failure toasts (#6, #11)  
5. Focus activity link + prop sync (#9, #10)  
6. Dialog a11y + recurrence expansion (#13, #14)
