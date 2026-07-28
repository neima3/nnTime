# Round 13 — Private Sleep-Aware Wind-Down Design

**Status:** Approved by the existing Phase 8B/K04 roadmap scope and the
project's autonomous-execution rule.

**Objective:** Complete the code half of K04 by letting an iPhone user
explicitly opt in to a gentle wind-down suggestion derived from recent Apple
Health sleep times, without uploading, syncing, or retaining Health samples.

## Decision

Kairo will expose two independent controls in the existing Apple Health
Settings card:

1. **Save focused minutes** keeps the existing write-only mindful-session
   behavior.
2. **Sleep-aware wind-down** requests read access to Sleep Analysis only,
   infers a typical sleep start entirely on the device, and schedules one
   gentle local notification 45 minutes beforehand.

This is preferable to a combined Health toggle because HealthKit recommends
requesting each type when the feature needs it, and existing users must not be
surprised by a new read request. It is preferable to server-synced insights
because a cross-device sleep profile is unnecessary for one iPhone
notification and would expand Kairo's privacy, retention, API, and deletion
surface.

## Privacy and consent contract

- Both controls default off and can be enabled or disabled independently.
- The sleep control requests only `HKCategoryType(.sleepAnalysis)` as a read
  type. It does not add a new write type.
- The permission sheet has a dedicated `NSHealthShareUsageDescription`
  explaining that recent sleep times are used for a private wind-down
  suggestion.
- Raw samples, source names, sleep stages, dates, and durations never enter
  Kairo's database, network layer, logs, analytics, app-group defaults, or
  widget cache.
- The only durable user state is the device-local boolean that the person
  enabled the feature. The derived time exists in memory long enough to render
  Settings and schedule the next local notification.
- HealthKit deliberately does not reveal whether read access was denied.
  Therefore Kairo never labels an empty query as "permission denied." It says
  that no recent pattern is available and explains that access may be limited
  or there may not be enough sleep history.
- Turning the feature off removes Kairo's pending wind-down notification but
  does not alter Health data or activity reminders.

## Sleep inference

`SleepScheduleInference` is a pure, independently tested unit.

1. Query the most recent 28 days, sorted oldest to newest.
2. Accept only asleep categories: unspecified asleep, core, deep, and REM.
   Exclude in-bed and awake samples.
3. Collapse all asleep stages that belong to the same local night to the
   earliest asleep start. A start between midnight and noon belongs to the
   previous night; this keeps a 12:30 AM sleep onset adjacent to 11:45 PM.
4. Require at least four distinct nights. Fewer nights produce
   `insufficientData`.
5. Convert local start times onto a noon-to-noon circular axis and take the
   median, which resists a single unusually late night and handles midnight
   without averaging 11:50 PM and 12:10 AM into noon.
6. The wind-down minute is 45 minutes before the median sleep minute.
7. Build the next future local occurrence using the current calendar and
   timezone. Calendar construction owns DST normalization; no UTC-midnight
   arithmetic is used.

This is a suggestion, not a sleep-quality score, diagnosis, or assertion that
the person should sleep at that time.

## Runtime and notification flow

`HealthKitClient` gains two focused operations:

- request sleep-read authorization;
- fetch asleep intervals within an explicit date range.

`HealthKitManager` remains the privacy boundary. Enabling sleep wind-down:

1. checks HealthKit availability;
2. requests Sleep Analysis read access;
3. stores the opt-in only after the authorization request completes;
4. queries recent asleep samples;
5. derives the schedule;
6. asks `NotificationManager` to replace only the
   `kairo-sleep-wind-down` request.

When Kairo becomes active, it refreshes the suggestion if the device-local
opt-in is still on. This lets new Health data update the next notification
without background Health delivery or a long-running observer.

Activity reminder reconciliation must stop calling
`removeAllPendingNotificationRequests()`. It will inspect pending requests and
remove only Kairo activity identifiers (`cushion-` and `start-`), preserving
the sleep suggestion. Likewise, disabling sleep wind-down removes only its
stable identifier.

The suggestion is scheduled only when iOS notifications are authorized and
its fire time is outside the user's quiet hours. Health access can remain
enabled when notifications are off; Settings says that the pattern is ready
but notifications need to be enabled.

## Settings presentation

The existing Apple Health card remains one card and uses the binding native
Settings patterns:

- two 44-point toggle rows separated by the existing hairline token;
- Onest body/meta typography and existing ink/iris tokens;
- a short disclosure under each toggle;
- progress indicator and status copy below the sleep row;
- no new color, radius, shadow, icon system, or screen.

Successful copy names the derived local time: “Wind-down around 10:45 PM · 45
min before your usual sleep time.” Empty-data copy is calm and explicit. The
write-only copy is narrowed to that specific control so it no longer claims
the entire app never reads Health data.

VoiceOver receives separate labels and hints that name exactly what each
control reads or writes. The status remains visible at larger Dynamic Type
sizes because it wraps naturally inside the existing card.

## Failure behavior

- Health unavailable: toggle returns off; no query or notification.
- Authorization request throws: toggle returns off and shows a retry message.
- Empty/limited/denied read: toggle remains on, no notification, neutral
  no-pattern message.
- Query error: toggle remains on, no stale notification, retry message.
- Notification permission absent: inference succeeds, no request is scheduled,
  and Settings directs the user to enable notifications.
- Quiet hours contain the suggested time: no notification is scheduled and
  Settings explains that quiet hours are being respected.
- Disabling either Health feature never changes the other.
- Focus completion remains server-authoritative; sleep read failures cannot
  affect focus or mindful-minute writes.

## Verification

- TDD unit coverage for stage filtering, same-night collapse, midnight,
  median/outlier behavior, four-night threshold, next-occurrence construction,
  independent preferences, authorization/query failures, and notification
  outcomes.
- XCUITest verifies both controls default off, the read/write disclosures are
  accurate, the sleep row is reachable, and Light/Dark screenshots render at
  the existing production design bar. It does not automate the system Health
  permission sheet.
- The full native suite must pass serially with no Main Thread Checker output;
  generic arm64 device build must include both Health usage descriptions and
  the HealthKit entitlement.
- Web lint, typecheck, 547+ tests, and production build remain green.
- K04 remains partial until a signed physical iPhone proves both authorization
  flows, a mindful sample in Health, and a real sleep-derived notification.
  Simulator UI and unsigned/device builds are not substituted for that proof.

