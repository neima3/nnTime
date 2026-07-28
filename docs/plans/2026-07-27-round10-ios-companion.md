# Round 10 — iOS companion parity (+ Health stretch)

**Goal:** Round 9's web companion (T11) left iOS behind — port it so both
platforms speak with one voice. Stretch: the 8B Apple Health write-path
(mindful minutes from completed focus sessions, explicit opt-in).

**Design stance:** identical presence contract to the web — same lines, same
4-minute rotation derived from elapsed time, same honesty (the app, not a
fake human), same escape hatch. Device-local preference (a vibe, not data).
The breathing dot respects reduced motion/stimulation.

## Subphases
- [x] 10A `CompanionLines.swift` (Shared) — the exact web lines + rotation
      math, mirrored like KTime mirrors time-format.ts. Unit tests pin the
      mirror (same inputs → same line indices as companion.test.ts).
- [x] 10B FocusView: Companion toggle chip on setup (KairoPrefs-persisted),
      Body-double ritual auto-on, presence card during running/paused/
      overtime with Solo escape; dot animation gated on reduce-motion +
      reduced-stimulation.
- [x] 10C KairoRound10Tour: ritual → "Companion on" chip → start → card
      visible → Solo. xcodegen after new files; trust "Executed N".
- [x] 10D Docs + commit + push; CI green (web untouched).
- [x] 10E (stretch) HealthKit: opt-in toggle in Settings, write mindful
      minutes on focus completion, usage strings + entitlement. Shipped and
      simulator-verified in Round 11; physical-iPhone authorization and a
      sample appearing in Apple Health remain a release check.
