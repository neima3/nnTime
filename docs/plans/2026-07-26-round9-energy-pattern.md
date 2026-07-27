# Round 9 — E07: energy-pattern learning ("charged hours")

**Goal:** ship the one deferred parity row that's genuinely Kairo-shaped:
learn *when this user's high-energy work actually gets done* from
planner_events, show it honestly on both platforms, and let it inform
Plan-my-day. Parity row E07 moves 0 → 1 with evidence.

**Design stance (binding):** honest and gentle, like every other insight.
No claims below the evidence gate (≥8 high-energy completions in 60 days,
best 3-hour window must hold ≥3). Copy never prescribes ("you must"), it
observes ("your heavy work tends to land…"). Tokens only. The pattern is
derived **server-side once** and returned in the stats payload — web and
iOS render the same truth; no double-implemented math.

## Subphases
- [x] 9A `computeEnergyPattern` — pure fn in stats.ts over pre-joined
      `{hourOfDay, energy}` completions: per-hour counts for high-energy
      completions + the best 3-hour window, gated on evidence. Unit tests
      (gate honesty, window wrap, empty, single-hour cluster).
- [x] 9B `getStats` joins completions → series energy (one query on the
      involved series ids), computes scheduled hour from occurrenceKey in
      the planning zone, returns `energyPattern`. DB-backed test.
- [x] 9C Web: "Charged hours" Stats card (design-sensitive — Fable) +
      Plan-my-day prompt enrichment when a window exists.
- [x] 9D iOS: Insights renders the same payload (wire model + card);
      tour test updated. xcodegen + full suite green ("Executed N").
- [x] 9E Gates (web unit+E2E, build), deploy, live verify, parity E07
      0 → 1 with evidence, progress.md entry.

## Rules
Standing execution rules apply (AGENTS.md). Stats payload changes must
keep the response schema loose-compatible for older iOS builds (additive
only).
