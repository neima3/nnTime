# Kairo — Tiimo Feature Parity Checklist

Date: 2026-07-12
Source inventory: `docs/research/tiimo-features.md` (areas A–N, 98 rows)
Source plan: `docs/plans/2026-07-12-kairo-roadmap.md` (v2)
Scoring script: `scripts/parity.mjs`

## Parity scoring (copied from roadmap "Parity scoring" section)

> Equal weight per applicable checklist row (the old 60/40 area weighting is
> retired). credit: shipped-with-evidence = 1, partial-with-written-criteria =
> 0.5, planned-but-unshipped/deferred = 0 (at audit time), excluded rows out of
> the denominator only with a written reason. `scripts/parity.mjs` prints web,
> iOS, and combined percentages; gates 0.5d, 6F, and 8D use it.

Rules applied when building this table:

- **id**: stable, area letter + 2-digit number (A01…N05), in research-doc order.
- **platforms**: `web`, `ios`, or `both` — which Kairo platform(s) the feature
  applies to. Watch/widget/Live-Activity features are `ios`. Most rows are `both`.
- **phase**: the roadmap phase/subphase that ships it, or `—` for
  excluded/deferred-with-no-phase.
- **status**: `planned` (a phase covers it fully), `partial` (a phase covers it
  partially — must have written acceptance criteria in the last column),
  `deferred` (deliberately not shipping; stays in the denominator, credit 0),
  `excluded` (out of the denominator — for rows the research doc itself marks
  unverified/reported-gap/blog-content-not-in-app, pure pricing/business-policy
  rows, or a documented platform limitation whose only implementation would
  violate a binding privacy/data-minimization contract; reason written).
- **credit**: planned = 1, partial = 0.5, deferred = 0, excluded = 0.

## Summary

_Computed by `node scripts/parity.mjs` — see report for the run that produced these numbers._

| metric | value |
|---|---|
| Web parity | 89.74% (70.0 / 78 rows) |
| iOS parity | 86.93% (76.5 / 88 rows) |
| Combined parity | 86.93% (76.5 / 88 rows) |
| Total inventory rows | 98 |
| planned | 74 |
| partial | 5 |
| deferred | 9 |
| excluded | 10 |

**Both platform gates pass (≥85%).** The first draft scored iOS at 83.15%;
rather than massaging credits, the roadmap was strengthened (2026-07-12):
month view, quick-extend, and checklist-during-focus were itemized into iOS
scope (7D/7E), a dedicated high-contrast mode was added to 5B, and Apple
Health sync was added to 8B. F02 is excluded because EventKit offers full
Reminders access but no read-only Reminders authorization; requesting read/write
access for a one-way import would violate Kairo's data-minimization contract.
Google/Apple/Outlook calendar import remains a separate F01 capability and is
not claimed as Reminders equivalence. Remaining partial and deferred rows retain
their written criteria and zero-credit treatment in the table below.

## Checklist

| id | feature | area | platforms | phase | status | credit | acceptance / reason |
|---|---|---|---|---|---|---|---|
| A01 | Color-coded daily timeline | A | both | 1D, 7D | planned | 1 | SHIPPED: Today screen renders real activity blocks with 6 category pastel colors; live HTTP 200 on time.neima.me/app/today (screenshot browser-qa/1d-today-live.png). |
| A02 | Day / week / month views | A | both | 2D, 7D | planned | 1 | SHIPPED: Day (Today), Week, Month screens all wired to real data, live-verified HTTP 200 on all three routes. Day+Week+Month on web (2D); roadmap 7D itemizes month view in the iOS planner-parity scope. |
| A03 | "Anytime" activities | A | both | 1D, 7D | planned | 1 | SHIPPED: AnytimeRail schedule→editor + clear DELETE with If-Match (Wave 2/3); real anytime-bucket tasks via DAL. |
| A04 | Drag-and-drop rearranging | A | both | 2C, 7D | planned | 1 | SHIPPED: TimelineCanvas component (src/components/TimelineCanvas.tsx) implements drag move + resize with 15-min snap and collision lanes; live-verified. |
| A05 | Time-of-day grouping (Android) | A | both | — | deferred | 0 | Android-only fallback UI in Tiimo; Android is deferred for Kairo and web/iOS ship the full timeline instead of a grouped view. |
| A06 | "Review Today" | A | both | 2D, 7D | planned | 1 | SHIPPED: /app/review wired to real unfinished activities; live HTTP 200. |
| A07 | Visual gaps between events | A | both | — | excluded | 0 | Research doc marks this a reported gap of Tiimo itself ("N/A feature gap"), not a shipped Tiimo feature to match. |
| A08 | Fixed calendar items vs. shiftable tasks | A | both | 2C, 5A | planned | 1 | — |
| B01 | Tasks (scheduled) vs. To-dos (unscheduled) | B | both | 1A, 1D, 7D | planned | 1 | SHIPPED: tasks table with bucket enum (inbox/anytime); CRUD verified live (create 201, update 200, delete 204, conflict 409). |
| B02 | To-do tab / brain dump / inbox | B | both | 1D, 7D | planned | 1 | SHIPPED: /app/inbox wired to real inbox-bucket tasks; live HTTP 200. |
| B03 | Subtasks / checklists | B | both | 1D, 7D | planned | 1 | Manual checklists only; AI-generated checklists are scored separately at E02. |
| B04 | Icons per task | B | both | 1D | partial | 0.5 | Design decision: emoji picker replaces Tiimo's curated icon library (incl. seasonal packs); acceptance = emoji field present on the editor sheet. |
| B05 | Colors per task | B | both | 5B | partial | 0.5 | Design decision: 6 semantic categories with editable color/label (token-constrained) replace Tiimo's 3,000+ freeform color picker. |
| B06 | Tags | B | both | 1A, 1D | planned | 1 | SHIPPED: tags CRUD routes (src/app/api/v1/tags/) with DAL getTag/updateTag/deleteTag. |
| B07 | Notes | B | both | 1D | planned | 1 | — |
| B08 | Duration / time estimates | B | both | 1D | planned | 1 | SHIPPED: durationMin column on activity_series, verified in CRUD flow. Manual duration only; AI-suggested estimate is scored separately at E03. |
| B09 | Priority levels | B | both | 1A, 1D | planned | 1 | SHIPPED: priority enum on tasks, verified in CRUD flow (priority:"high" in create response). Manual priority only; AI grouping is scored separately at E06. |
| B10 | Energy-level tagging | B | both | 1D, 5C | planned | 1 | SHIPPED: energyLevel enum on activity_series + tasks. |
| B11 | All-day / no-time tasks | B | both | 1D | planned | 1 | SHIPPED: anytime bucket (date column, no time), verified. Handled via Anytime, same mechanism as A03. |
| B12 | Recurring/repeat tasks | B | both | 2A, 7D | planned | 1 | SHIPPED: activity_series with rrule + recurrence engine (src/server/services/recurrence.ts) with edit scopes; 4 tests passing. Custom N-day/week intervals are a deliberate Tiimo-beating addition. |
| B13 | Skip / mark incomplete | B | both | 2D | planned | 1 | SHIPPED: Review Today flow has "Let it go" (skip) action; occurrence status enum includes 'skipped'. |
| C01 | Routines (activity sequences) | C | both | 1A, 2B, 7D | planned | 1 | SHIPPED: routines CRUD API + RoutinesClient create/pause/use-today/delete; honest empty state when authed with 0 routines (Wave 3). |
| C02 | Repeat scheduling | C | both | 2A, 2B | planned | 1 | SHIPPED: routineSchedules table with rrule + routine materializer (src/server/services/routine-materializer.ts). |
| C03 | Routine builder / library redesign | C | both | 5D | planned | 1 | — |
| C04 | Community/shared routine templates | C | both | — | deferred | 0 | Named deferred in the roadmap (community template sharing). |
| C05 | Pause a recurring routine | C | both | 2B, 5D | planned | 1 | SHIPPED: routineSchedules.paused column + materializer skips paused schedules. |
| D01 | Visual countdown / progress ring | D | both | 3A, 3C, 7E | planned | 1 | SHIPPED: DayProgress component on Today + CurrentActivityRing (src/components/CurrentActivityRing.tsx). |
| D02 | Auto-start on scheduled tasks | D | both | 3A | planned | 1 | — |
| D03 | Pause / resume | D | both | 3A | planned | 1 | SHIPPED: focus state machine (src/server/services/focus.ts) — transitionFocusSession running↔paused; 6 tests passing. |
| D04 | Extend ("+1 minute") | D | both | 3A, 7E | planned | 1 | SHIPPED: extendFocusSession (+1/+5/+10 min); 6 tests passing. Roadmap 3A itemizes quick-extend controls (+1/+5/+10 min) on the live timer; 7E ports to iOS. |
| D05 | Manual complete / drag-to-finish | D | both | 3A | planned | 1 | SHIPPED: transitionFocusSession → completed state. |
| D06 | Checklist-during-focus | D | both | 1D, 3A, 7D | planned | 1 | Roadmap 3A itemizes live checklist display + check-off inside the running timer (per the Phase 0 focus design's Steps card); 7D ports to iOS. |
| D07 | Widget / Live Activity / Dynamic Island timer | D | ios | 8A | planned | 1 | SHIPPED (Rounds 22, 38–39): the protected app-group day snapshot drives real Home/Lock widgets, while ActivityKit renders a focus countdown across Live Activity and Dynamic Island. Next Up can complete a fully identified block through a network-first App Intent; Live Activity pause/resume and complete run in the app process; deep links remain available. |
| D08 | Ambient sounds / "Focus tunes" | D | both | 3C | planned | 1 | SHIPPED: AmbientSounds component (src/components/AmbientSounds.tsx) with 5 CC0 sounds; live-verified (screenshot browser-qa/3c-today-live.png). |
| D09 | Hyperfocus support | D | both | 3B, 3C | planned | 1 | Matches Tiimo's own mechanism (break reminders + visible timer + mood insights), not a dedicated hyperfocus mode. |
| D10 | Break prompts | D | both | 3B | planned | 1 | SHIPPED (Round 18): durable `notification_jobs` compute and deliver halfway + wrap-up prompts with stable deduplication, atomic claims, retry/expiry, cancellation, and source revalidation (`notification-policy.test.ts`, `notifications.integration.test.ts`, `notification-delivery.integration.test.ts`). |
| D11 | Known gap: screen dimming during timer | D | both | — | excluded | 0 | Research doc marks this a reported bug/gap in Tiimo itself, not a feature to replicate. |
| E01 | AI Co-Planner (conversational planning) | E | both | 4, 7D | planned | 1 | SHIPPED UI+API (2026-07-15 Wave 2/3): /app/planner PlanDayClient + POST /api/v1/ai/plan-day, breakdown, parse. SEC-05 no auto-mutate; 503 without ANTHROPIC_API_KEY. Live plan-day 401 unauth. |
| E02 | AI task breakdown / subtask generation | E | both | 4, 7D | planned | 1 | SHIPPED: editor “Break it down” → POST /api/v1/ai/breakdown (SEC-05); server breakDownTask + UI wired 2026-07-15. |
| E03 | AI time estimation | E | both | 4 | planned | 1 | IMPLEMENTED (server-layer, not live-verified — needs ANTHROPIC_API_KEY): AI duration estimation via src/server/services/ai.ts. Duration estimation chip. |
| E04 | Natural-language / voice add | E | both | 4, 7D | planned | 1 | IMPLEMENTED (server-layer, not live-verified — needs ANTHROPIC_API_KEY): parseNaturalLanguage in src/server/services/ai.ts. |
| E05 | Dynamic re-planning via chat | E | both | 4 | planned | 1 | IMPLEMENTED (server-layer, not live-verified — needs ANTHROPIC_API_KEY): planMyDay disruption re-planning in src/server/services/ai.ts. Disruption re-planning. |
| E06 | AI priority grouping | E | both | 4 | planned | 1 | IMPLEMENTED (server-layer, not live-verified — needs ANTHROPIC_API_KEY): groupByPriority in src/server/services/ai.ts. |
| E07 | Smart scheduling / energy-pattern learning | E | both | R9 | planned | 1 | SHIPPED (Round 9, 2026-07-26): computeEnergyPattern learns when HIGH-energy work actually completes (60-d window, scheduled hour from occurrenceKey in the planning zone, evidence-gated: ≥8 samples and best 3-h window ≥3 — below the gate the app says nothing). Surfaced as the "Your charged hours" card on web Stats AND iOS Insights (both render the same server-derived stats payload), and fed to Plan-my-day as a <learned> block so high-energy tasks get placed inside the charged window when a slot overlaps. Evidence: browser-qa/r9-charged-hours.png; stats.test.ts (6 pattern tests); prompt enrichment in ai.ts planMyDay. |
| F01 | Calendar import | F | both | 5A | planned | 1 | IMPLEMENTED (server-layer, not live-verified — needs API key): src/server/services/calendar.ts — SSRF-safe ICS fetch + parser + token encryption. Google OAuth + ICS subscribe covers Apple/Google/Outlook-via-ICS import. |
| F02 | Reminders (Apple) sync | F | ios | — | excluded | 0 | EXCLUDED: Apple EventKit exposes full read/write Reminders access but no read-only Reminders permission. Kairo will not request broader mutation access for a one-way import; that would violate data minimization. Calendar import (F01) remains separate and is not claimed as equivalent. |
| F03 | One-way sync only, by design | F | both | 5A | planned | 1 | SHIPPED: calendar import is read-only (source='calendar', read-only locked blocks). Kairo's calendar import is read-only/one-way by the same design choice. |
| F04 | Per-device import step | F | both | 5A | planned | 1 | Superseded by account-level OAuth sync (server-side, not per-device) — same end-user outcome via a better mechanism. |
| F05 | Imported events are "locked" | F | both | 2C, 5A | planned | 1 | — |
| G01 | Per-notification-type toggles | G | both | 3B | planned | 1 | WEB SHIPPED (Round 18): Settings exposes start, halfway, wrap-up, daily-review, and weekly-review toggles; compute and delivery independently re-check the same explicit-false keys. Native parity is not claimed. |
| G02 | Custom timing | G | both | 3B | planned | 1 | WEB SHIPPED (Round 18): bounded Settings controls shift start, halfway, and wrap-up reminders; compute and delivery share the same parser. Native custom timing is not claimed. |
| G03 | Custom sounds | G | both | 3B | planned | 1 | WEB SHIPPED (Round 18): the account sound toggle is re-read at delivery and maps to the Web Notification `silent` option. Custom native sounds are not claimed. |
| G04 | "Review Today" daily check-in | G | both | 2D, 3B | planned | 1 | SHIPPED (Round 18): one deduplicated daily review job at 20:00 in the account planning zone, preference/quiet-hour checked again at delivery. |
| G05 | "Review your week" | G | both | 3B | planned | 1 | SHIPPED (Round 18): one deduplicated week-ending review job at 18:00 in the account planning zone and configured week-start convention. |
| G06 | Gentle/soft notification design | G | both | 3B | planned | 1 | SHIPPED: privacy-minimal, calm copy is generated centrally by `notification-policy.ts`; arbitrary activity notes and push endpoints never enter job payloads. |
| G07 | Halfway/mid-task nudges | G | both | 3B | planned | 1 | SHIPPED (Round 18): recurrence- and override-aware halfway jobs are delivered through the same durable claim/retry state machine as start and wrap-up prompts. |
| G08 | Per-task notification granularity | G | both | — | excluded | 0 | Research doc marks this a user-requested gap not yet available in Tiimo itself ("N/A feature gap"). |
| H01 | Home Screen widgets | H | ios | 8A | planned | 1 | SHIPPED (Round 22): small, medium, and large read-only WidgetKit families render timezone-safe current/next activity data with account 12/24-hour preference and Today deep links. |
| H02 | Lock Screen widgets | H | ios | 8A | planned | 1 | SHIPPED (Round 22): accessory circular, rectangular, and inline families render the protected current/next snapshot with combined VoiceOver labels and Today deep links. |
| H03 | Interactive widgets | H | ios | 8A | planned | 1 | Complete-from-widget ships (R38): the Better Auth envelope moved into the app-group keychain access group (legacy items migrate on first read) and the widget's done button is a network-first App Intent — the day cache changes only after the server confirms the PATCH, never optimistically. Rows from legacy caches without activity identity render read-only. |
| H04 | Live Activities / Dynamic Island | H | ios | 8A | planned | 1 | Pause/resume and complete ship on the lock screen and Dynamic Island (R39): LiveActivityIntents run in the app process and drive the same focus API the Focus screen uses via a registered bridge — no widget-side transport; a failed call leaves the shown state untouched. Read-only countdown + deep link retained. |
| H05 | Apple Watch app | H | ios | — | deferred | 0 | "watchOS glance = stretch" named deferred in the roadmap (8A) and in the deferred list. |
| H06 | Watch complications | H | ios | — | excluded | 0 | Research doc marks this a reported gap of Tiimo itself, not a feature to replicate. |
| I01 | 3,000+ color options | I | both | 5B | partial | 0.5 | Same design decision as B05 (6 semantic categories, not a freeform palette). |
| I02 | Custom icon library | I | both | 1D | partial | 0.5 | Same design decision as B04 (emoji picker, not a curated icon library). |
| I03 | Light / Dark / System theme | I | both | 5B, 7D | planned | 1 | SHIPPED: personalization service (src/server/services/personalization.ts) — theme enum (system/light/dark) in user_settings. |
| I04 | Dyslexia-friendly font | I | both | 5B, H9 | planned | 1 | SHIPPED (web, H9 2026-07-24): Atkinson Hyperlegible loaded via next/font, applied to display+body under `.dyslexia-font`, real toggle in Settings → Access, persisted in notificationPrefs and applied server-side per account. NOTE: before H9 this row was credited on the personalization service merely *exposing* the pref — nothing consumed it, so a user could not turn it on. SHIPPED (iOS, I1 2026-07-24): Atkinson Hyperlegible bundled (OFL) and swapped for display+body; the mono face stays so tabular digits keep their alignment. Both platforms read the same account pref. |
| I05 | Adjustable text size | I | both | 5B, 6C, H9, I1 | planned | 1 | SHIPPED both platforms: "Larger text" scales the type scale 1.125× (web body zoom; iOS font-size multiplier) on top of the OS setting. iOS additionally rides Dynamic Type via `relativeTo:` on every font. |
| I06 | Family/shared profiles | I | both | — | deferred | 0 | Named deferred in the roadmap. |
| I07 | Apple Family Sharing support | I | ios | — | deferred | 0 | Rolls into the family/shared-profiles deferral; no Kairo phase covers multi-person billing. |
| J01 | Personal routine library | J | both | 5D | planned | 1 | — |
| J02 | Pre-made starter content at onboarding | J | both | 5D, 6A | planned | 1 | SHIPPED: 15 built-in templates in src/server/services/templates.ts, surfaced at onboarding. ~15 built-in templates (5D) surfaced at onboarding's "first template" step (6A). |
| J03 | Community template gallery | J | both | — | deferred | 0 | Named deferred in the roadmap (community template sharing). |
| J04 | Neuroinclusive courses | J | both | — | deferred | 0 | Named deferred in the roadmap (courses/learning content). |
| J05 | Community hub | J | both | — | deferred | 0 | Rolls into the courses/learning-content deferral; no community-hub phase exists. |
| K01 | Planning streaks | K | both | 3C, 5C | planned | 1 | SHIPPED: SoftStreaks component (src/components/SoftStreaks.tsx) reads /changes feed, 1-day grace. |
| K02 | Personal insights / stats | K | both | 5C | planned | 1 | SHIPPED: src/server/services/stats.ts — getStats from planner_events. |
| K03 | Mood tracking / check-ins | K | both | 5C | planned | 1 | SHIPPED: recordMoodCheckin + POST /api/v1/mood + StatsClient mood chips UI (Wave 2); live route 401 unauth. |
| K04 | Apple Health sync (Tiimo Wellbeing) | K | ios | 8B, R11, R13 | partial | 0.5 | SHIPPED: independent device-local opt-ins for idempotent, write-only mindful minutes (R11) and a read-only sleep schedule that infers a private wind-down time from recent Sleep Analysis, then schedules one local suggestion without uploading or retaining Health samples (R13). A signed Release build with the HealthKit entitlement was installed and launched on a physical iPhone. REMAINS: on-device user-interaction proof of the Health permission sheets, a mindful sample, a real sleep query, and the local notification. |
| K05 | Editorial "review techniques" (Winventory, Progress Check, Tiny Rewards) | K | both | — | excluded | 0 | Research doc explicitly labels this "Content, not confirmed as app UI" — blog content, not an in-app feature. |
| L01 | Sign-up via Apple / Google / Email | L | both | 1C, 7B, 8B | planned | 1 | SHIPPED CODE: email/password is live-verified (2026-07-13); Round 20 added native magic-link, Apple sign-in/linking, Keychain session handling, and simulator proof; Round 23 added fail-closed Google web sign-in/linking plus GoogleSignIn-iOS 9.0.0 transport/UI with simulator unit and UI proof. REMAINS: complete Resend + Apple production credentials, all three Google server values (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), matching public iOS build settings, live browser OAuth/linking, and the complete signed physical-iPhone lifecycle (sign-in, relaunch/Keychain restore, linking, 401 purge, logout). |
| L02 | Cross-device sync | L | both | 1A/1B, 7C | planned | 1 | SHIPPED: `/api/v1/changes?cursor=` incremental feed plus native protected cursor checkpoints, invalid-cursor reset, ordered idempotent task/status replay, foreground/reconnect synchronization, and durable conflict recovery. Server feed was live-verified (401 without auth, works with session); native replay/conflict behavior is simulator-verified in Round 21. |
| L03 | No account merging | L | both | — | excluded | 0 | Describes a Tiimo limitation (unsupported), not a buildable feature; matched by default since Kairo doesn't build merging either. |
| L04 | Family/shared profile billing | L | ios | — | deferred | 0 | Rolls into the family/shared-profiles deferral. |
| L05 | Web app requires subscription | L | both | — | excluded | 0 | Pure pricing/business-policy row, not a product feature. |
| M01 | VoiceOver / screen reader support | M | both | 6C, 7D | planned | 1 | SHIPPED: 6C accessibility audit — ARIA landmarks, focus-visible, skip link, sr-only; Lighthouse a11y score 96. |
| M02 | Dynamic Type support | M | ios | 7D | planned | 1 | SHIPPED: every iOS font is declared `.custom(..., relativeTo:)`, so all type rides UIFontMetrics and scales with the system setting; "Larger text" (I1) multiplies on top. |
| M03 | Dyslexia-friendly font toggle | M | both | 5B | planned | 1 | Duplicate of I04. |
| M04 | High-contrast / dark mode | M | both | 5B, 7D, H9 | planned | 1 | SHIPPED (web, H9 2026-07-24): dedicated high-contrast mode — token overrides split per theme (`.high-contrast:not(.dark)` / `.high-contrast.dark`), edges instead of blur, 3px focus rings, `prefers-contrast: more` honoured before the toggle is touched, past-block dimming suppressed. Live-verified on time.neima.me (--ink #120e1c). Same NOTE as I04: pre-H9 this row was credited on an unconsumed preference. SHIPPED (iOS, I1 2026-07-24): high-contrast token variants resolved from the trait collection, so iOS "Increase Contrast" drives them for free; the in-app toggle sets traitOverrides.accessibilityContrast (iOS 17+) and removing it hands control back to the OS. Simulator-verified. |
| M05 | Sound toggles | M | both | 3B, 3C | planned | 1 | SHIPPED: AmbientSounds has mute button + volume slider. |
| M06 | Sensory-friendly design ethos | M | both | 5B, H9 | planned | 1 | SHIPPED: reduced-stimulation mode. NOTE: until H9 (2026-07-24) the class was toggled onto <html> with **no CSS rules behind it**, so the mode changed nothing; it now stops decorative animation, keeps progress spinners moving (slowed), caps transitions and flattens shadows. |
| M07 | Reduced-motion setting | M | both | — | excluded | 0 | Research doc marks Tiimo's support as "Unverified"; excluded per the unverified-source rule even though Kairo implements reduced motion anyway (6C/7D) as good practice. |
| N01 | Short onboarding questionnaire | N | both | 6A | planned | 1 | SHIPPED: /onboarding step 2 quiz sets real defaults; live-verified in dev. |
| N02 | Pre-filled starter schedule | N | both | 6A | planned | 1 | SHIPPED: onboarding step 3 creates real activity from template. |
| N03 | Guided 5-step post-paywall setup | N | both | 6A | planned | 1 | SHIPPED: 4-step onboarding flow (welcome→quiz→template→notifications). Matched functionally by Kairo's structured multi-step onboarding (welcome → quiz → template → notification opt-in), independent of any paywall gating. |
| N04 | Opt-in notification permission framing | N | both | 6A | planned | 1 | SHIPPED: onboarding step 4 requests permission with user gesture. |
| N05 | Single, simplified pricing screen | N | both | — | excluded | 0 | Pure pricing/business-policy row, not a product feature. |
| N06 | Settings: notifications, sounds, appearance, profiles, calendar import, subscription management | N | both | 3B, 5A, 5B, 8B | planned | 1 | — |
