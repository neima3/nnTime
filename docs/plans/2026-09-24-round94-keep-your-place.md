# Round 94 — Keep your place (look + function pass)

Brief: "make this entire app look and function better like a 10x developer".
Chosen slice: no new surfaces. A hands-on pass on a seeded, realistic evening
(11 blocks, 19:00 local) at 1440×900 and 390×844, light + dark, then fix what
a person actually hits. Every item below was reproduced before it was touched.

## Defects found → fixes

| # | Found (evidence) | Fix |
|---|---|---|
| 1 | Today, desktop: page auto-scrolls to the now-line, so the right rail (Anytime, Up next + Start focus, sounds) scrolls away — half the screen empty | Rail is `sticky top-6`, scrolls internally if tall |
| 2 | Today, after auto-scroll the date, progress and day switcher are gone; on a phone you land on a timeline with no day | `TodayStickyBar`: zero-height sticky bar that appears when the header leaves the viewport — date, done/total, "Now" jump, prev/next |
| 3 | Now pill sat 8px above its line and covered the "7 PM" gutter label | Container centred on the time; the colliding hour label fades |
| 4 | "+" on Today always proposed 1 PM; `n` / command palette always 9 AM — in the past at 7 PM | `suggestNewStart`: first 45-min gap from now (to midnight), after whatever is running; other days 09:00. Editor applies it when opened without a time |
| 5 | **"Close the day" at 19:10 counted tonight's plan as "still open", and "Carry all to tomorrow" moved 21:00 Wind down etc. to tomorrow** | Only blocks whose end has passed are counted/carried (`partitionReviewItems`, same rule Review got in R92); copy says how many stay put |
| 6 | **Carrying (or Review → Move to tomorrow) a daily block duplicated it on tomorrow** | Ask tomorrow's day (`seriesIdsOnDay`); a series already there is let go today instead of stacked. Weekly blocks still move |
| 7 | Mobile: quick-capture pencil overlapped the Now strip on every page but Today | Strip flags `html[data-now-strip]`; pencil lifts above it; safe-area insets on both FABs |
| 8 | Now strip read "Free until 9:00 PM · at 9:00 PM" | "Free until 9:00 PM · in 1 hr 45 min" (`formatSpan`) |
| 9 | Month: dots only, half the page empty | md+: titled category chips (3 + "N more"), done struck through, today as a filled date; phone keeps dots |
| 11 | Focus: the session name field sat under Start and read as a static card; nothing pointed at the block that's on right now | Labelled "Focusing on", above Start; "On now: … Focus on it →" links the current (or ≤15-min-away) occurrence |
| 10 | Week: "09/20 – 09/26"; done blocks looked pending | "September 20 – 26" / "Sep 27 – Oct 3" (`weekRangeLabel`); done blocks struck + dimmed |

## Not changed (checked, fine)
Inbox, Routines, Templates, Play, Stats, Settings, Planner, landing — no
defects worth a change found in this pass. Completion → header ring does
update (router.refresh); it's just slow on the dev server.

## Verification
Unit: new tests in `slots`, `time-format`, `next-day-copies`, DayRituals pin.
Browser (Playwright + installed Chrome, `browser-qa/r94/`): before/after sets,
carry-forward and Review scripts asserting persisted API state.
