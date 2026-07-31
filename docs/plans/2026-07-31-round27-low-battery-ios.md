# Round 27 — Low-battery day on native Today (parity port)

**Goal:** close a real web↔iOS feature gap: the web's low-battery day
("today I don't have it") had no native counterpart. Port it with exact
semantics and honest accessibility.

## Scope

1. **Energy through the pipeline.** `DayActivity.energy` (already in the
   canonical contract) now decodes through the generated adapter into
   `Activity` and `DayBlock` (`ActivityEnergy` gains `Codable`).
2. **Today surfaces.** A per-date, device-local chip on Today (today
   only, hidden on read-only cached days): on → high-energy pending
   blocks dim to 55% with a "heavy" tag (visible, never hidden), a
   softened note appears, and the combined block accessibility label
   announces ", heavy for a low-battery day" so VoiceOver hears it.
3. **Pick-for-me preference.** `LowBatteryDay.pickRank` demotes heavy
   picks and slightly prefers light ones within each kind bucket —
   mirroring the web picker's weight adjustments — with a "keeping it
   light today" caption on the sheet.
4. **Determinism.** Debug-only `-kairoTodayFixture` seeds a mutable
   mixed-energy Today (pinned zone so bootstrap ordering can't shift the
   date key); `LowBatteryDay.set` forces a defaults flush so an
   immediate kill can't drop the toggle.

## Non-goals

No web changes (the web feature is untouched), no server surface, no
parity-checklist change (this closes a Kairo-extra gap, not a Tiimo row).
