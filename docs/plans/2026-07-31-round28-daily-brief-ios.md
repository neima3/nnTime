# Round 28 — Daily Brief on native Today (parity port)

**Goal:** close the second web↔iOS gap from the Round 27 sweep: the web's
Smart Daily Brief (T9) had no native counterpart.

## Scope

1. **The card.** A warm morning orientation on native Today: greeting by
   hour tier, "N things on today, M already done" (or the gentle empty-day
   line), "First up · emoji title at time", and the learned focus-peak tip
   — reusing the peak-hour insight Today already loads for its nudge.
   Morning-only (hour < 12), today-only, dismissible for the day
   (`kairo.briefDismissed`).
2. **Contract pinning.** `DailyBriefPolicy` (pure) carries the show gate,
   greeting tiers, and summary copy; unit tests pin all three to
   `src/components/DailyBrief.tsx`.
3. **Determinism.** The `-kairoTodayFixture` pins a 9am hour for the brief
   and clears its dismissal on launch, so the tour proves show →
   dismiss-for-the-day at any wall-clock time and stays rerunnable.

## Non-goals

No web changes, no server surface, no parity-checklist rows.
