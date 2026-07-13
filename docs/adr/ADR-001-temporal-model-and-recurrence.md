# ADR-001 — Temporal model & recurrence

Status: **Accepted** (2026-07-12, post Codex review). Binding on all executors.

## Instants, zones, dates
- Timed instants stored as UTC (`timestamptz`). Every recurrence series and
  every calendar source row also stores an **IANA timezone** (`tz`).
- Each user has an explicit **planning timezone** and locale in typed
  `user_settings` columns (not JSON). Defaults from browser on signup;
  changeable in settings.
- Date-only values (Anytime day attachment, all-day activities, day buckets)
  are Postgres `date` columns — never midnight-UTC timestamps.
- `GET /api/v1/day/{YYYY-MM-DD}?tz=<iana>`: `tz` optional, defaults to the
  authenticated user's planning zone; response echoes the zone and the
  resolved UTC bounds `[start, end)` (exclusive end).
- Duration is authoritative (`duration_min`); end time is derived. Overnight
  activities are allowed (duration may cross midnight); the day view renders a
  split block at midnight, each half linking to the same occurrence.
- Timezone travel: manual activities keep **local wall time** in the series
  zone; calendar-imported events keep the **absolute instant** from the
  provider. Documented in UI copy when the user changes planning zone.
- DST: recurrence expands in wall-clock time in the series `tz`, then converts
  to instants. Nonexistent local times (spring-forward gap) shift forward to
  the first valid instant; ambiguous times (fall-back fold) take the FIRST
  occurrence. Required deterministic tests: DST gap, DST fold, leap day,
  month-end (e.g. Jan 31 monthly), series split, planning-zone change.

## Recurrence model (no rrule-string-on-activity)
- `activity_series`: id, user_id, tz, local dtstart, RRULE, EXDATE/RDATE,
  template fields (title, emoji, category, duration, checklist template,
  energy, tags, priority), revision.
- `activity_occurrences`: materialized-or-overridden instances keyed by
  `(series_id, occurrence_key)` where `occurrence_key` = original local start
  (stable identity). Rows exist when an occurrence is overridden, completed,
  skipped, cancelled, or within the materialization horizon; otherwise
  occurrences are expanded virtually for display.
- One-off activities are a series with no RRULE and one occurrence.
- Edit scopes:
  - **This occurrence:** write/patch the occurrence row. Master untouched.
  - **This and future:** transaction: truncate old series (UNTIL before the
    selected occurrence) + create a new series starting there. Overrides
    before the split stay with the old series; at/after move to the new one.
    Occurrence identity (`occurrence_key`) survives the split.
  - **All:** update the master. Field-level overrides survive unless the
    edited field is the overridden field (override wins conflict).
- Delete scopes mirror edit scopes (this = cancellation row; future = UNTIL
  truncate; all = soft-delete series with tombstones).
- Completed past occurrences are never mutated by series edits.
- Routine-materialized and calendar-imported occurrences record `source` and
  `source_ref`; calendar-imported ones are read-only in Kairo.

## Tasks: two buckets, one table
`tasks.bucket ∈ {inbox, anytime}`. `inbox` = brain-dump To-do (own nav route,
no day attachment). `anytime` = attached to a `date` with no time. "Schedule"
converts a task to an activity series (move: task soft-deleted with
`converted_to` ref; checklist and history transfer; identity recorded in
planner_events).

## History
`planner_events` is append-only: (user_id, entity type/id, event type
[complete, uncomplete, skip, reschedule, focus_start/stop, energy_change,
mood_checkin, carryover], payload, occurred_at, tz). Streaks and stats read
ONLY this table. `done_at` style flags on rows are denormalized display state.
