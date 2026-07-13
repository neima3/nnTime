# Principal-engineer pre-execution review — Kairo roadmap

Reviewed 2026-07-12 against the roadmap, executor prompt, binding design spec,
Tiimo inventory, agent/deployment instructions, and the requested implementation
files. This is a plan review, not an implementation review; most security findings
below are missing requirements, not claims that unimplemented code is already
vulnerable.

## 1. Verdict — **FIX-FIRST**

Do not hand this roadmap to autonomous mid-tier agents yet.

The stack is workable and the product direction is coherent. The failure is at the
contract level: the plan names features but does not define the domain semantics,
API/sync contract, security invariants, or a reproducible parity calculation. The
highest-risk work—recurrence, time zones, offline conflict handling, background
timers/notifications, and native authentication—is deferred to the agent who happens
to reach it. Those are architectural decisions, not implementation details.

There is also a direct execution-control contradiction. The executor is told to
“Execute the **first unchecked phase** ... fully” (`docs/plans/kairo-agent-prompt.md:16-20`),
but is simultaneously permitted to hand off “cleanly mid-phase.” The roadmap tracks
only phase-level checkboxes (`docs/plans/2026-07-12-kairo-roadmap.md:16-28`). With no
task owner, task status, contract test, or checkpoint commit, two agents can repeat,
overwrite, or prematurely bless half a phase. Phase 1 alone combines production
infrastructure, a large schema, two auth methods, an iOS-facing API, optimistic UI,
and a design-sensitive editor (`roadmap:41-71`). That is multiple independently
reviewable slices, not one autonomous session.

The current repo reinforces the gap. `package.json:5-9` has no test script or CI gate;
the data model is still a display mock using “minutes from midnight”
(`src/lib/mock.ts:12-24`); the Today timeline assumes a fixed 07:00–23:00 range
(`src/app/app/today/page.tsx:21-25,102-141`); and the shell has no To-do/inbox route
(`src/components/AppShell.tsx:11-17`) even though the research calls the separate
brain-dump bucket distinctive and core (`docs/research/tiimo-features.md:50-52,203-206`).
These are acceptable Phase 0 facts, but the roadmap does not turn them into explicit
Phase 1 decisions.

**Exit condition for FIX-FIRST:** apply the top ten edits in section 7, obtain the
already-required design artifacts before their implementation phase begins, and add
a feature-level parity baseline. The stack does not need a rethink.

## 2. Parity risk

### The stated 85% is not auditable

The roadmap says A–E receive 60% and F–N receive 40%
(`roadmap:224-230`). It never says:

- which inventory rows are applicable to web, iOS, or the combined product;
- whether an area is equally weighted inside its bucket or weighted by feature;
- whether “partial” earns zero, half, or full credit;
- whether a feature repeated in two areas (for example the timer widget in D and H)
  is counted twice;
- whether “reported gap,” “unverified,” business-model, and platform-only rows enter
  the denominator;
- what evidence converts a row from partial to shipped; or
- whether the Phase 6 “web parity” gate can satisfy the top-level web **and iOS** goal.

The weighting is also arbitrary. Under the most natural reading, each of A–E is worth
12 points while each of F–N is worth about 4.44. That makes AI as valuable as the
entire task model and makes accounts/sync, accessibility, onboarding, calendar,
notifications, and widgets collectively easy to underdeliver. No user-value or
research evidence supports that choice.

An illustrative feature-row preflight demonstrates the magnitude. Excluding rows
explicitly described by the research as gaps, unverified behavior, editorial content,
or pure pricing policy leaves roughly 85 applicable rows across A–N. Giving a generous
half point to partial coverage, the written phases cover about **49.5/85 ≈ 58%**. The
exact value is debatable precisely because the scoring rules are absent; no reasonable
interpretation of the written work establishes 85% before execution.

### Material features with no phase coverage

These are researched shipped features, not Tiimo gaps:

- **Month view** (`tiimo-features.md:35-36`). Phase 2 builds only week/day
  (`roadmap:84-87`).
- **Dedicated To-do/brain-dump tab** separate from scheduled/Anytime tasks
  (`tiimo-features.md:50-52`). Phase 1 has an Anytime panel and one `tasks` table
  (`roadmap:51,65`), which collapses two distinct concepts. The binding shell has only
  five unrelated destinations (`design-spec.md:61-65`; `AppShell.tsx:11-17`).
- **Tags, priority levels, and skip/mark-incomplete**
  (`tiimo-features.md:55-62`). None appears in a phase.
- **Personal routine library search/filter/favorites and pause recurrence**
  (`tiimo-features.md:68-72`). Built-in starter templates are not a personal library.
- **Auto-start scheduled timers and drag/manual timer completion**
  (`tiimo-features.md:78-83`). Phase 3 specifies manual start entry points and a normal
  completion action, not either behavior (`roadmap:100-105`).
- **Conversational/speech brain dump, voice add, dynamic disruption re-planning, and
  AI priority grouping** (`tiimo-features.md:94-100`). An omnibox plus a one-shot
  “plan my day” proposal (`roadmap:128-135`) is not the researched co-planner pillar.
- **Apple Reminders import** (`tiimo-features.md:106-110`).
- **Custom reminder timing, notification sounds, daily Review Today, and weekly
  review** (`tiimo-features.md:116-122`).
- **Interactive widgets** (`tiimo-features.md:129-133`). Phase 8 widgets are read-only
  as written (`roadmap:211-214`).
- **Mood check-ins and Apple Health sync** (`tiimo-features.md:162-165`).
- **Google sign-in** (`tiimo-features.md:172-173`). Web gets email/password and magic
  link; iOS later gets Apple (`roadmap:54-55,202`).
- **Neuroinclusive courses/community hub** (`tiimo-features.md:152-156`). The parity
  math calls these deferred (`roadmap:228-230`) but does not show that all deferrals fit
  inside 15%.
- **Explicit iOS VoiceOver, Dynamic Type, and per-sound controls**
  (`tiimo-features.md:182-187`). A Phase 6 web keyboard/contrast audit does not cover
  native accessibility (`roadmap:178-180,193-209`).

### Partial coverage currently presented as full

- Six semantic category colors and an emoji picker are a legitimate Kairo design
  choice, but they are not the researched 3,000+ colors and large icon library
  (`tiimo-features.md:53-54,140-144`). Count them partial or explicitly declare the
  inventory rows inapplicable on product-principle grounds; do not silently award full
  credit.
- “Carry over unfinished” (`roadmap:89`) is one action inside Review Today, not the
  guided complete/skip/reschedule reflection (`tiimo-features.md:40,119-120`).
- ICS subscription is not equivalent to native Apple Calendar/Reminders integration,
  and the plan omits provider update/delete reconciliation (`roadmap:148-151`).
- “Plan my day” uses current energy labels; it does not learn energy patterns over
  time (`tiimo-features.md:100`).
- A generic accessibility audit is not evidence for screen-reader task flows or native
  Dynamic Type.
- “watchOS may defer,” Android, family profiles, courses, community, and community
  templates are all placed into one 15% loss budget (`roadmap:228-230`) without
  weights. That is wishful accounting, not a budget.

The Phase 6 parity task (`roadmap:184-186`) comes too late. A checklist created after
six phases can reveal a product miss, but it cannot cheaply repair schema, navigation,
API, and design omissions. The baseline matrix must be a Phase 0.5 input to execution.

## 3. Architecture review

The chosen stack is viable. The following contracts must be decided before agents
implement it.

### Recurrence and edit scopes

An `rrule` string on `activities` (`roadmap:48-53`) is not enough for “this event / all
future” (`roadmap:78-81`). Store a series/master separately from occurrence overrides.
Define at least: series ID, recurrence timezone, local DTSTART, RRULE, EXDATE/RDATE,
original occurrence key, overridden fields, cancellation/skip state, and revision.

Required semantics:

- **This event:** create an override keyed by the original occurrence, or an exclusion
  plus detached instance. Never mutate the master.
- **This and future:** truncate the old series before the selected occurrence and create
  a new series in one transaction; preserve history and stable occurrence identity.
- **All events:** update the master while specifying whether existing overrides survive.
- Define edit/delete for completed past occurrences, imported events, and routine-
  materialized activities.
- Put deterministic DST, leap-day, month-end, and split-series tests in Phase 1/2.

“Expanded recurrences later” in `GET /day/:date` (`roadmap:56-59`) means the first API
contract is knowingly incomplete. Define occurrence DTOs and stable occurrence IDs in
Phase 1 even if the engine lands in Phase 2.

### Time zones and day boundaries

“start ts” plus `/day/:date` (`roadmap:48-58`) leaves the core temporal model undefined.
The mock's minute-of-day representation (`src/lib/mock.ts:16-18`) cannot simply become a
timestamp. Decide:

- instants are stored as UTC, with an IANA zone on every recurrence/calendar source;
- a user has an explicit planning timezone and locale, not only opaque JSON prefs;
- recurrence is generated in wall-clock time in the series zone, then converted to
  instants; DST gaps/folds have documented behavior;
- `/day/{YYYY-MM-DD}` is interpreted in an explicit `tz` or authenticated user zone and
  returns that zone plus bounds;
- floating Anytime/all-day values remain date-based, not midnight UTC timestamps; and
- travel/timezone-change behavior is fixed (keep local wall time vs keep absolute
  instant) per source type.

The design timeline is fixed to 07:00–23:00 (`design-spec.md:70-71`; Today page
`21-25`). Specify rendering for overnight, before-07:00, after-23:00, and overlapping
activities before adding drag/resize.

### Routine materialization and scheduling

“Daily cron ... or app-level check” (`roadmap:82-83`) is not an implementation choice
to leave open. App-level checks fail when nobody opens the app; cron can duplicate rows
under retries or multiple replicas. Choose a durable scheduled job with a database
lease/advisory lock and a unique idempotency key `(routine_schedule_id, occurrence_key)`.
Decide whether routines expand virtually or materialize, how edits propagate, and how
late/missed runs backfill.

The same problem applies to push. A browser timer cannot be the scheduler for activity-
start notifications. Store notification jobs or compute them in a reliable worker,
with retry, deduplication, expiry, and cancellation when an activity moves.

### Offline queued mutations and cross-device sync

Offline mutation queues first appear in Phase 6 (`roadmap:174-177`), after CRUD and
recurrence contracts are supposedly finished. That is backwards. The API needs from
Phase 1:

- client-generated mutation IDs/idempotency keys;
- per-record revisions or ETags and conditional writes;
- tombstones and a deletion-retention window;
- an incremental changes cursor, not only day snapshots;
- a deterministic conflict policy per entity/field;
- ordered batch mutation results and retryable vs terminal errors; and
- user-scoped, encrypted-at-rest local-cache expectations plus logout/cache purge.

Without this, “offline-first cache with sync-on-foreground” on iOS
(`roadmap:205-206`) becomes a second, incompatible sync system. Service workers must
not indiscriminately cache authenticated API responses; cache names and IndexedDB data
must be user-scoped and purged on account switch/logout.

### Focus-timer persistence

A persisted `focus_sessions` row (`roadmap:101-105`) does not define a timer. Specify a
server-authoritative state machine: `running | paused | completed | skipped | cancelled`,
`started_at`, accumulated paused duration, current interval start, target duration,
revision, and completion reason. Enforce at most one active session per user with a
partial unique constraint. Start/pause/resume/extend/finish operations must be
idempotent and use server time; the UI derives remaining time rather than decrementing
stored seconds.

Define navigation/reload, two-device contention, sleep/wake, system clock changes,
offline actions, overtime, and activity edits while focused. Notification jobs and
Live Activities must be rescheduled when the timer changes. “Background-safe” iOS
(`roadmap:203-206`) should mean elapsed-time reconstruction plus local notifications/
Live Activity updates, not an indefinitely running background process.

### Web Push and native iOS notifications

Phase 3 verifies desktop Chrome and Android Chrome only (`roadmap:115-118`), while
Phase 6 merely installs a PWA on iPhone (`roadmap:188-189`). On iOS/iPadOS, Web Push is
available to Home Screen web apps, permission must follow direct user interaction, and
the manifest/service-worker path matters. That requires an explicit iPhone PWA push
test, not a generic install test. See the official
[WebKit Web Push requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Keep three channels distinct in the plan: standards-based Web Push for browsers,
native local notifications scheduled by the Swift app, and APNs remote notifications
if server-driven native delivery is later required. “iOS web push” is not the native
SwiftUI notification architecture.

### OpenAPI to Swift and native auth

“Generate from a shared OpenAPI spec emitted by the web repo” (`roadmap:199-201`) is
not a toolchain. Pick the spec as the source of truth, commit the generated JSON/YAML,
and make CI fail on schema drift. Define RFC 3339/date-only formats, nullability,
enums, polymorphism, standard error envelopes, auth requirements, idempotency headers,
and pagination/cursors before generating Swift. Pin a generator/version and decide
whether generated code is committed. Do not casually select the legacy `swift5`
generator: its current official page marks it deprecated
([OpenAPI Generator](https://openapi-generator.tech/docs/generators/swift5/)). Evaluate
the supported Swift generator/toolchain and prove a compile in Phase 1.

The native auth transport is also unspecified. Cookie middleware for `/app/*` does not
tell SwiftUI how to create, persist, refresh, revoke, or attach a session. Define the
Better Auth native flow now: custom URL scheme/universal link, trusted origins,
magic-link deep link, Sign in with Apple account linking, Keychain storage, session
refresh/expiry, and REST authentication. Better Auth documents native-client origin
and secure-cookie handling patterns, but its Expo plugin is not a SwiftUI client; the
roadmap must specify Kairo's native implementation rather than assume reuse
([Better Auth native integration context](https://better-auth.com/docs/integrations/expo),
[Better Auth security](https://better-auth.com/docs/reference/security)).

### Next.js 16 and caching

`cacheComponents` is explicitly part of the stack (`roadmap:11-14`) but has no data-
isolation rule. All session, day, settings, and user API responses must be dynamic and
private/no-store unless a cache key is demonstrably user-scoped. Shared caches around
Drizzle queries are a cross-user data-leak risk. The roadmap should require a
server-only DAL and forbid DB/auth imports from Client Components.

## 4. Phase-order & scope critique

### Wrong ordering

1. **Parity baseline belongs before Phase 1, not at the end of Phase 6.** Navigation,
   schema, and designs already omit core rows.
2. **Timezone, recurrence identity, sync revisions, OpenAPI, and native auth are Phase
   1 contracts.** Implementations may land later; their wire/storage shapes cannot.
3. **Backups belong before production persistence.** The roadmap starts using Neima's
   real planner in Phase 1 (`AGENTS.md:43-44`) but adds backups in Phase 8
   (`roadmap:214-220`).
4. **Rate limits belong with each exposed endpoint.** Auth/magic link appears in Phase
   1, AI in Phase 4, and arbitrary ICS fetching in Phase 5; Phase 8 is too late.
5. **Stats requires event history before Phase 5.** A mutable `done_at` field cannot
   reconstruct completion reversals, focus intervals, skips, reschedules, energy
   changes, or streaks.
6. **Offline behavior must shape the Phase 1 API.** Adding it after optimistic CRUD
   guarantees retrofit churn.
7. **PWA infrastructure is needed before web-push verification.** Phase 3 requires a
   service worker/push subscription; Phase 6 first introduces a service worker.
8. **All seven pending designs must be produced before their consuming phase.** The
   plan repeatedly says “get design sign-off” inside execution
   (`roadmap:62-64,128-130,156-160,173-180,196-204`). An autonomous mid-tier agent
   cannot satisfy that dependency.

### Phases are too large

- **Phase 1:** split into 1A domain/API contract and tests; 1B DB/auth/backup; 1C CRUD
  API and authorization; 1D Today/editor/Anytime browser work; 1E staging/live release.
- **Phase 2:** split recurrence, routines/materializer, timeline interactions, and
  week/review flows. Recurrence alone deserves its own migration and test matrix.
- **Phase 3:** split timer state machine, notification scheduler/Web Push, and ambient/
  progress UX.
- **Phase 5:** calendar OAuth/sync, personalization, stats/event model, and templates
  are four unrelated risk domains.
- **Phase 6:** onboarding, offline PWA, accessibility, performance, and full dogfood are
  separate acceptance gates.
- **Phase 7:** a native app with seven screens, auth, generated client, offline sync,
  background timer, physical-device QA, and TestFlight cannot be one agent phase.

Every subphase needs a checkbox, inputs, outputs, migration ID, automated tests,
browser/device evidence, deploy result, and exact handoff. Only the parent phase should
be marked complete when all children pass.

### Missing verification and release controls

- `pnpm lint && pnpm build` (`roadmap:232-237`) is not a data-product gate. Add unit,
  database integration, API contract, authz/tenant-isolation, recurrence DST, sync
  conflict, and Playwright tests from Phase 1. `package.json:5-9` currently has no test
  script.
- CI appears only as a Phase 8 verification concept (`roadmap:214-220`). Require CI on
  every push before Phase 1 merges.
- Testing destructive CRUD on a “live test account” (`roadmap:67-71`) conflicts with
  the production no-destructive-test rule (`kairo-agent-prompt.md:38-39`). Provision a
  staging database/app or an explicitly synthetic tenant with cleanup tooling that
  cannot target production.
- No migration strategy exists. Require forward-only numbered migrations, predeploy
  backup, expand/migrate/contract for breaking changes, a compatibility window for old
  web/iOS clients, migration smoke tests, and an explicit rollback/roll-forward runbook.
- Coolify health/readiness checks, zero-downtime expectations, and previous-image
  rollback are absent from `docs/DEPLOYMENT.md:19-33`.
- “Within 1h” calendar verification (`roadmap:163-166`) does not test update, cancel,
  timezone, recurring event, revoked token, duplicate delivery, or retry.
- A single “1-min-ahead” recurrence test (`roadmap:91-93`) does not test recurrence; it
  tests scheduling latency.
- TestFlight upload (`roadmap:208-209`) depends on certificates, App Store Connect,
  bundle IDs, entitlements, privacy manifests, and human agreements. Add an explicit
  credential/preflight gate rather than discover these at the end.

## 5. Underspecification traps

The following quoted instructions force a mid-tier agent to invent product or data
semantics. Each needs the proposed decision in the roadmap before execution.

1. **“`activities` (title, emoji, start ts, duration min ... all_day)”**
   (`roadmap:48-50`). Decide UTC instant vs local wall time, end vs duration authority,
   overnight behavior, IANA timezone, DST, and whether `all_day` is actually Anytime.
2. **“`tasks` (untimed ‘Anytime’ items)”** (`roadmap:50-51`). Decide whether this is
   the separate To-do inbox, Today Anytime, or both. Research requires both buckets.
3. **“categories (6 defaults seeded per user)”** (`roadmap:48-49`). Decide immutable
   semantic IDs, rename/reorder/delete behavior, fallback for referenced rows, and
   idempotent seeding.
4. **“`user_settings` (JSON prefs)”** (`roadmap:51-52`). Make timezone, locale, week
   start, hour cycle, schema version, and notification settings typed/versioned fields;
   reserve JSON for noncritical presentation extras.
5. **“`rrule` string column on activities”** (`roadmap:52-53`). Replace with a
   master/override model and define split-series transactions as above.
6. **“Better Auth: email+password and magic-link”** (`roadmap:54-55`). Decide email
   verification, password reset, magic-link mail provider, expiry/single use,
   enumeration behavior, session lifetime/rotation, canonical origin, account linking,
   and native token/cookie transport.
7. **“Session middleware for `/app/*`”** (`roadmap:54-55`). State that middleware is
   only a UX gate; every `/api/v1` route must authenticate and authorize the resource.
8. **“CRUD for activities, tasks, checklists, routines, categories”**
   (`roadmap:56-58`). Specify resource schemas, IDs, errors, pagination, filtering,
   revisioning, idempotency, ownership, bulk/sync endpoints, and delete semantics.
9. **“`GET /day/:date` returns a fully resolved day”** (`roadmap:57-59`). Define zone,
   inclusive/exclusive bounds, occurrence IDs, overlaps, recurring/imported sources,
   ordering, and cache headers.
10. **“server component fetch of real day”** (`roadmap:60-61`). Decide direct DAL vs
    internal HTTP. Prefer a shared server-only service called by both the component and
    route handler; do not self-fetch through the public URL or duplicate business rules.
11. **“complete/uncomplete (optimistic), delete”** (`roadmap:60-61`). Define conflict
    response, rollback, idempotency, undo, and whether completion is an event history
    rather than a mutable timestamp.
12. **“schedule (‘move to today at time’)”** (`roadmap:65`). Decide move vs copy,
    retention of inbox identity, checklist/history transfer, and concurrent scheduling.
13. **“edit scopes (this event / all future)”** (`roadmap:78-81`). Also decide “all,”
    delete scopes, exceptions, completed occurrences, and override preservation.
14. **“auto-materialization ... cron or app-level check”** (`roadmap:82-83`). Choose
    durable cron/worker now; require lock, idempotency, retry, backfill, and observability.
15. **“drag to move ... resize duration”** (`roadmap:84-85`). Decide collisions,
    imported locked blocks, overnight bounds, mobile scroll/drag arbitration, optimistic
    conflicts, and accessible keyboard commands. Current absolute cards all share the
    same width (`Today page:35-43,135-140`) and will visually collide.
16. **“Undo toast ... 8s”** (`roadmap:88`). Decide delayed commit vs compensating
    mutation, behavior after navigation/reload, recurrence edits, and multi-device state.
17. **“carry over unfinished”** (`roadmap:89`). Decide copy/move, original-day history,
    recurrence instances, partial checklist state, bulk selection, and idempotency.
18. **“timer survives navigation + reload”** (`roadmap:101-105`). Add the explicit
    state machine, one-active-session invariant, server clock, multi-device arbitration,
    and offline policy.
19. **“activity start ... wrap-up ... halfway” Web Push** (`roadmap:107-109`). Decide
    scheduler, subscription lifecycle, endpoint encryption/sensitivity, retries,
    timezone, changed-event cancellation, quiet hours, and browser support matrix.
20. **“3–4 loops ... royalty-free”** (`roadmap:110-111`). Name approved assets,
    licenses/attribution, repository/storage location, preload limits, gapless playback,
    background behavior, and per-sound accessibility mute.
21. **“streak counter”** (`roadmap:112-113`). Define qualifying action, planning zone,
    grace rules, backfill, opt-out, and how missed days avoid shame.
22. **“safe structured output only”** (`roadmap:137-140`). Define exact zod schema,
    input/output byte limits, tool prohibition, timeout, retry, atomic quota accounting,
    logging/redaction, and a rule that AI output never mutates data without explicit
    user confirmation.
23. **“hourly sync” / “ICS-URL subscribe”** (`roadmap:148-151`). Define token
    encryption, provider IDs/etags, incremental sync, update/delete reconciliation,
    recurrence mapping, SSRF controls, redirect/DNS policy, size/time limits, and
    failure/re-auth UX.
24. **“Stats screen: completion ... focus ... energy balance”** (`roadmap:156-157`).
    Define event schema, formulas, timezone bucketing, retention, deleted-item behavior,
    and minimum-data empty states before Phase 1 schema freezes.
25. **“templates ... seeded from JSON”** (`roadmap:158-160`). Decide stable IDs,
    versioning/localization, update behavior, duplicate imports, provenance, and whether
    imported templates remain linked or become independent copies.
26. **“offline read of today + queued mutations”** (`roadmap:174-177`). Specify cache
    scope/encryption/purge, queue ordering, idempotency, conflicts, tombstones, retry,
    and service-worker update strategy.
27. **“computed parity ... applicable web features”** (`roadmap:184-186`). Publish the
    denominator and scoring rules now; do not let the final agent choose what applies.
28. **“generated from a shared OpenAPI spec”** (`roadmap:199-201`). Choose schema
    source, generator/version, CI drift check, generated-code policy, wire date formats,
    errors, and auth scheme.
29. **“Sign in with Apple, Keychain session”** (`roadmap:202`). Define nonce/state,
    private-relay email linking, duplicate-account policy, session refresh/revocation,
    deep links, and logout/keychain purge.
30. **“offline-first cache with sync-on-foreground”** (`roadmap:205-206`). Name the
    persistence technology, sync protocol, conflict UI, background limits, and data-
    protection class.

One additional binding-contract contradiction must be resolved centrally. The design
spec says never use pure white/default Tailwind colors (`design-spec.md:119-120`), while
the reference Today screen uses `text-white` (`Today page:127`) and the token source
contains `#ffffff` (`globals.css:13`). Tell agents that named design tokens are
canonical and log these existing exceptions; otherwise one agent will “fix” the mock
while another copies it.

## 6. Security & privacy

### SEC-01 — High: route gate without resource authorization

- **Location/evidence:** `roadmap:54-59` specifies middleware for `/app/*` and CRUD
  routes but never mandates authorization inside every handler.
- **Impact:** an authenticated user—or unauthenticated caller if the matcher misses
  `/api/v1`—could read or mutate another user's rows by ID.
- **Required plan fix:** every table has `user_id`; every DAL query scopes by the
  authenticated user in the same predicate; client-supplied owner IDs are ignored;
  nested resources verify parent ownership; middleware is defense-in-depth only. Add
  negative integration tests for every resource and unauthenticated API tests.
- **Mitigation/verification:** random public UUIDs reduce enumeration but do not replace
  authorization. Consider Postgres RLS as defense-in-depth if the team can operate it
  correctly.

### SEC-02 — High: cookie sessions and CSRF are unspecified

- **Location/evidence:** Better Auth and REST mutations are introduced together
  (`roadmap:54-59`), but the plan names no cookie flags, CSRF/origin policy, canonical
  origin, session expiry, rotation, revocation, or cache policy.
- **Impact:** cross-site state changes, session replay/fixation, or cached cross-user
  responses.
- **Required plan fix:** secure/HttpOnly/SameSite production cookies; bounded rotating
  sessions; strict canonical/trusted origins; CSRF token or strict Origin/Fetch Metadata
  policy for cookie-authenticated mutations; no state changes on GET; private/no-store
  user responses; explicit logout/revoke-all-devices behavior.

### SEC-03 — High: OAuth tokens are sensitive planner credentials

- **Location/evidence:** Google Calendar OAuth arrives in Phase 5 (`roadmap:148-151`),
  while token storage and revocation are absent. Better Auth's current documentation
  states provider tokens are not encrypted by default
  ([user/accounts documentation](https://better-auth.com/docs/concepts/users-accounts)).
- **Impact:** a database backup or SQL compromise can grant long-lived calendar access.
- **Required plan fix:** least read-only scope; envelope-encrypt access/refresh tokens
  with a key outside Postgres; never expose/log tokens; handle rotation, expiry,
  revocation, disconnect, and account deletion; redact provider payloads from error
  telemetry.

### SEC-04 — High: ICS subscription is an SSRF and secret-handling surface

- **Location/evidence:** “ICS-URL subscribe” (`roadmap:150-151`) asks the server to fetch
  a user-controlled URL.
- **Impact:** requests to localhost, Coolify/internal services, metadata endpoints, or
  oversized/slow resources; leaked secret-bearing calendar URLs in logs/UI.
- **Required plan fix:** http/https only; block loopback/private/link-local/reserved IPs
  after DNS resolution and on every redirect; redirect and response-size caps; timeout;
  content validation; egress restrictions; encrypted URL storage; URL redaction; safe
  retry cadence. Re-resolve to reduce DNS rebinding risk.

### SEC-05 — High: AI prompt-injection test is too narrow

- **Location/evidence:** `roadmap:137-140` treats “safe structured output” from an
  “ignore instructions” title as sufficient.
- **Impact:** untrusted notes/tasks can manipulate output, cause unwanted disclosure in
  logs/vendor requests, consume cost, or produce instructions that an agent/UI treats
  as trusted.
- **Required plan fix:** AI has no tools, credentials, or direct mutation authority;
  send only the minimum selected user data; delimit untrusted fields; enforce strict
  schema and length bounds; reject unknown fields; render output as text; require
  per-item confirmation; atomic per-user quota plus IP abuse controls; timeout/cancel;
  redact prompts/responses from default logs; define Anthropic retention/privacy policy.
  Prompt injection cannot be “solved” by a system prompt—limit capability and blast
  radius.

### SEC-06 — Medium/High: rate limiting is eight phases late

- **Location/evidence:** rate limiting appears only in Phase 8 (`roadmap:214-216`) after
  password/magic-link auth, push, AI, and calendar fetching ship.
- **Impact:** account/email abuse, AI cost exhaustion, SSRF amplification, scheduler
  load, and denial of service on a self-hosted origin.
- **Required plan fix:** add endpoint-specific limits when each endpoint ships: IP+
  account throttles for signup/login/reset/magic link; atomic user quota for AI; fetch
  limits for ICS; subscription limits for push; proxy body/time limits. Define the
  shared store and behavior across replicas.

### SEC-07 — High: backups begin after real data

- **Location/evidence:** real production planner data begins after Phase 1
  (`AGENTS.md:43-44`); scheduled backups and a restore drill wait until Phase 8
  (`roadmap:214-220`).
- **Impact:** irreversible loss or an unrollbackable migration during the majority of
  development.
- **Required plan fix:** before the first production migration, configure encrypted
  automatic backups, retention, off-host copy, access control, monitoring, and a tested
  restore to an isolated database. Take a pre-migration backup and document roll-forward
  for every schema change.

### SEC-08 — Medium: push subscriptions and offline caches expose personal routine data

- **Location/evidence:** Web Push (`roadmap:107-109`) and offline Today data
  (`roadmap:174-177`) have no data classification or lifecycle.
- **Impact:** notification endpoints and cached task titles can reveal health routines,
  appointments, or location-sensitive schedules on shared devices or after logout.
- **Required plan fix:** authenticate and user-scope subscription CRUD; treat endpoints
  as secrets; minimize notification lock-screen content with a privacy toggle; remove
  stale subscriptions; user-scope caches; purge on logout/account switch; never cache
  auth responses; document local-data retention and device-loss limitations.

### SEC-09 — Medium: baseline web hardening is absent

- **Location/evidence:** neither the roadmap nor `docs/DEPLOYMENT.md:19-33` requires CSP,
  `nosniff`, clickjacking defense, Referrer-Policy, Permissions-Policy, request-size
  limits, or runtime header verification.
- **Impact:** reduced defense against XSS/clickjacking and avoidable information leakage.
- **Required plan fix:** add a Phase 1 production-header test and Coolify/reverse-proxy
  limits. Start CSP report-only if necessary, then enforce; do not add `unsafe-inline`
  or `unsafe-eval` as a convenience. Verify headers on the live URL because they may be
  set outside the repo.

### SEC-10 — Medium privacy gap: no export/delete/retention contract

- **Location/evidence:** account/settings work (`roadmap:54-55,152-157,202`) never
  includes data export, account deletion, vendor disclosure, data retention, or privacy
  copy.
- **Impact:** personal schedules, notes, AI prompts, calendar tokens, push endpoints,
  and analytics history can outlive user expectations.
- **Required plan fix:** define data inventory and processors, export format, account
  deletion cascade (including OAuth revocation and queued jobs), backup expiry, log
  redaction/retention, AI data policy, privacy policy, and App Store privacy labels
  before TestFlight.

## 7. Top 10 concrete plan edits

These are ready-to-apply roadmap edits, ordered by leverage.

### 1. Insert a Phase 0.5 parity and architecture contract before Phase 1

Add after `roadmap:39`:

> ## Phase 0.5 — Execution contracts (BLOCKS PHASE 1)
> 1. Create `docs/plans/parity-checklist.md` with one row per researched feature:
> stable ID, area, platform applicability, weight, planned phase, acceptance evidence,
> and status. Exclude only rows marked research gap/unverified/business-policy, with a
> written reason. Partial credit = 0.5 only when its acceptance criteria are listed.
> Resolve duplicate rows once. Publish web, iOS, and combined denominators; each target
> must independently be ≥85%.
> 2. Approve ADRs for temporal/recurrence semantics, API+offline sync, native auth, job
> scheduling, and privacy/security. Their decisions are binding on later agents.
> 3. Produce all design-spec screens required by Phases 1–8 before the consuming phase.
> **Gate:** parity arithmetic is reproducible by script and the written phase map reaches
> ≥85% before implementation begins.

### 2. Replace the one-checkbox-per-phase execution model

Replace `roadmap:27-28` with:

> Each phase is split into numbered subphases sized for one agent session. Track every
> subphase separately with owner/status, inputs, migrations, tests, evidence, commit,
> deploy result, deviations, and exact next step. An agent executes only the first
> unchecked subphase. Parent phase completion requires all subphases and the phase gate;
> a mid-subphase handoff may not tick completion.

Make the same “subphase” substitution in `kairo-agent-prompt.md:16-20,46-50`.

### 3. Replace the Phase 1 schema bullets with explicit temporal, ownership, history, and sync invariants

Append to Phase 1 task 2 (`roadmap:48-53`):

> Every user-owned row has `user_id`, UUID, `created_at`, `updated_at`, monotonic
> revision, and ownership indexes. Store instants in UTC and IANA zones explicitly;
> date-only/Anytime values are not midnight timestamps. Model recurrence as series +
> occurrence overrides/exclusions, not an RRULE string on a mutable instance. Add an
> append-only planner event/history table for completion, skip, reschedule, focus, and
> stats. Add idempotency keys, tombstones, and sync cursors now. Publish exact rules in
> ADRs and cover DST folds/gaps, leap day, month end, and series splits with tests.

### 4. Make `/api/v1` a versioned contract with tenant isolation and offline semantics

Append to Phase 1 task 4 (`roadmap:56-59`):

> Commit OpenAPI 3.1 as the API source of truth with standard error envelopes, RFC 3339
> instants, date-only fields, enums, auth, revisions/ETags, idempotency headers,
> conditional writes, tombstones, incremental change cursors, and batch mutation
> results. Generate zod/server and Swift-compatible fixtures from it; CI fails on drift.
> Every handler authenticates internally and scopes every query by session `user_id`;
> middleware is not authorization. Add cross-user denial, CSRF/origin, cache isolation,
> idempotent retry, and conflict integration tests.

### 5. Replace Phase 2 recurrence/materialization ambiguity with fixed semantics

Replace `roadmap:78-83` with:

> 1. Implement the approved series/override recurrence ADR. Support this occurrence,
> this-and-future (transactional series split), and all occurrences for edit/delete;
> preserve stable occurrence IDs and define override survival. Test DST, timezone travel,
> completed past instances, exceptions, and concurrent edits.
> 2. Materialize scheduled routines through a durable Coolify job only. Use a DB lease
> and unique `(schedule_id, occurrence_key)` key for retry-safe deduplication; define
> missed-run backfill, cancellation, propagation, and observability. Do not use
> page-load/app-open checks as the scheduler.

### 6. Move backup, CI, migration, rate-limit, and staging gates into Phase 1

Add to Phase 1 before live data:

> Provision an isolated staging app/database and synthetic test tenant. Enable required
> CI (`lint`, typecheck, unit, DB integration, API contract/authz, build, Playwright
> smoke). Configure encrypted automatic off-host Postgres backups, retention/monitoring,
> and prove an isolated restore. Migrations are forward-only and use expand/migrate/
> contract with a web+iOS compatibility window, predeploy backup, smoke test, and
> rollback/roll-forward runbook. Add reverse-proxy limits/security headers and endpoint-
> specific rate limits when endpoints ship. Production destructive QA is forbidden.

Remove “rate limiting” and first-time backup setup from Phase 8; leave only ongoing
hardening and a repeated restore drill there.

### 7. Move offline/sync requirements before optimistic CRUD and specify conflicts

Replace the offline portion of `roadmap:176-177` and reference it from Phase 1:

> Web and iOS use the same sync protocol: client mutation UUIDs, ordered batches,
> per-record revisions, conditional writes, tombstones, incremental cursor, and typed
> retryable/terminal errors. Document conflict rules per entity and provide explicit UI
> for unresolved conflicts. PWA caches only approved static/user-scoped data, never auth
> responses; IndexedDB/cache state is purged on logout/account switch. Phase 6 enables
> the UI/service worker for this already-tested protocol rather than inventing it.

### 8. Expand Phase 3 into timer and notification state-machine contracts

Replace Phase 3 tasks 2–4 (`roadmap:101-109`) with:

> Implement a server-authoritative focus-session state machine with one-active-session
> DB constraint, server timestamps, accumulated pauses, revision, idempotent transitions,
> multi-device contention rules, offline policy, and elapsed-time reconstruction after
> sleep/reload. A durable retry-safe notification scheduler creates/cancels/deduplicates
> start, halfway, wrap-up, and review jobs when activities/timers change. Web Push
> subscription CRUD is authenticated and private. Verify desktop Chrome, Android Chrome,
> Safari/macOS, and an installed iPhone Home Screen PWA; permission always follows a
> user gesture. Native local/APNs notifications remain a separate iOS contract.

### 9. Add the missing parity features to explicit phases

Append to the relevant phases:

> **Phase 1/2:** dedicated To-do brain-dump route distinct from Today Anytime; tags;
> priority; skip/incomplete; month view; guided Review Today; routine pause and personal
> library search/favorites.
> **Phase 3:** scheduled auto-start policy, manual/drag-to-finish equivalent, custom
> notification timing/sounds, daily and weekly reviews, and break prompts.
> **Phase 4:** conversational typed/voice brain dump, disruption re-planning with
> per-change confirmation, and AI priority grouping. Energy learning remains deferred
> and scores zero unless separately specified.
> **Phase 5/8:** mood check-ins; Apple Reminders decision; interactive widgets;
> Google sign-in; explicit native VoiceOver/Dynamic Type/sound-toggle acceptance.
> Any still-deferred feature scores zero in the published matrix; do not group multiple
> deferrals into an unweighted 15% bucket.

### 10. Define native client generation/auth and split Phase 7

Replace Phase 7 tasks 2–5 (`roadmap:199-206`) with subphases:

> **7A Contract proof:** pin a supported Swift OpenAPI toolchain; generate and compile a
> client in CI from the committed spec; add golden decoding/error/auth tests.
> **7B Native auth:** define Better Auth REST/session transport, custom scheme/universal
> link, magic-link callback, Sign in with Apple nonce/account linking, trusted origins,
> Keychain storage, refresh/revoke/logout, and private-relay behavior; prove on device.
> **7C Data/sync:** implement the shared revision/cursor/idempotency protocol, protected
> local storage, foreground sync, conflicts, logout purge, and offline tests.
> **7D Planner UI:** Today/editor/Anytime, then Week/Routines, each with VoiceOver,
> Dynamic Type, reduced motion, and physical-device recordings.
> **7E Focus/notifications:** elapsed-time reconstruction, local notifications, and
> background/lock tests; no assumption of indefinite background execution.
> **7F Release:** certificate/bundle/entitlement/privacy-manifest preflight, CI archive,
> physical-device critical loop, and TestFlight upload.

Only after these edits is the roadmap suitable for mostly autonomous mid-tier execution.
