# ADHD App Features Research — 2026

Research date: 2026-07-18. Web-search synthesis across Tiimo, Routinery, Goblin
Tools, Amazing Marvin, Sunsama, Llama Life, Motion, Focusmate, Habitica, Finch,
plus ADHD-coaching and user-complaint sources. Compiled for Kairo feature
planning — not a build plan, facts + opportunity notes only. Sources inline.

Kairo already ships: proportional timeline w/ drag-resize, now-line, focus
timer (ring + ambient sound), inbox brain-dump, routines, AI task breakdown /
plan-my-day, soft streaks + mood check-ins, week/month views, end-of-day
review ("I did it / move to tomorrow / let it go"), energy + priority tags,
reduced-stimulation mode, PWA. Opportunity notes below are scoped to the gap.
---
## 1. Time blindness aids
**What competitors do:**
- **Tiimo** — every block is a colored countdown ring that visibly shrinks;
  the whole day renders as a draining color timeline so "later" is something
  you can see coming, not infer.
- **Routinery** — voice-guided (TTS) countdown per step; announces the next
  step aloud when the current one ends ("shower") so transitions don't
  require looking at a screen.
- **visualtimer.com / "In Your Face"** — full-screen visual timers built
  specifically for time-agnosia; some use screen takeovers, not just a widget.

**Consensus:** Time blindness (now called "time agnosia" in 2026 coverage) is
addressed by making time *visible and analog*, not numeric. A shrinking
ring/bar beats a digital countdown because it's parsed pre-attentively.
"Time-until" framing (e.g., "in 12 min") consistently outperforms clock time
for ADHD users who struggle converting 3:47pm into a felt sense of "soon."

**Kairo opportunity:** Kairo has the now-line and proportional timeline
already — the gap is a persistent, glanceable "time until next thing" surfaced
outside the timeline (e.g. in the Up Next card / nav bar), and audio/voice
cues for routine step transitions, which Kairo's routines don't have yet.
Sources: [Tiimo time-agnosia](https://www.tiimoapp.com/resource-hub/adhd-time-agnosia-strategies), [Routinery](https://www.routinery.app/), [In Your Face](https://www.inyourface.app/adhd-hyperfocus/)

---
## 2. Task initiation / paralysis breakers
**What competitors do:**
- **Goblin Tools "Magic To-Do"** — pastes any vague task and returns concrete
  first steps; an adjustable "spiciness" slider controls how granular the
  breakdown is (mild → nuclear); free, no account, no setup.
- **Focusmate** — on-demand body doubling: book a 25/50-min session, get
  matched with a stranger, state your goal on camera, work silently, check in
  at the end. 2024 study of 220 neurodivergent participants: 85% reported
  significant improvement in task completion from body doubling.
- **"Just 5 minutes" rule** — coaching-consensus technique: commit to only 5
  minutes, lowering the perceived cost of starting; works because it removes
  the "finish the whole thing" pressure that triggers avoidance.

**Consensus / caveat:** Body doubling is one of the most evidence-backed ADHD
interventions that exists. But plain "just start for 5 minutes" advice
**fails without an external dopamine/structure cue** — pure willpower framing
doesn't help because ADHD initiation isn't a motivation problem, it's a
neurological activation-energy problem. Tools that pair the micro-commit with
a visible timer or a companion presence work; bare encouragement doesn't.

**Kairo opportunity:** Kairo's AI task breakdown covers "Magic To-Do" territory
already; adding a granularity control (spiciness-style slider) would be cheap
polish. The bigger gap is a **"Start just 5 min" quick-launch** on stuck/inbox
items that opens the focus timer pre-set to 5 min with one tap — no need to
estimate duration first. Body doubling (real-time matched sessions) is
out of scope for effort but a lightweight **solo "focus room" ambience** (the
existing ambient sounds + a subtle "someone else could be working" framing)
gets some of the psychological benefit for near-zero cost.
Sources: [Goblin Tools](https://lifestack.ai/blog/goblin-tools), [Focusmate/body doubling stat](https://www.pledgd.com/blog/body-doubling-apps), ["Just 5 minutes" rule](https://www.adhddeltacoaching.com.au/blogs/the-just-5-minutes-rule-your-secret-weapon-against-procrastination)

---
## 3. Dopamine/reward loops that don't feel infantilizing
**What competitors do:**
- **Finch** — raise a virtual bird via gentle wellness tasks; motivation comes
  from the emotional bond with the pet, not points. Analysis consensus: Finch
  works "not because it's gamified, but because it's gamified *well*" —
  playful communication, never punitive, never preachy about the psychology.
- **Habitica** — full RPG skin (XP, gear, boss battles with friends); appeals
  to a narrower "gamer" audience but has strong community accountability via
  co-op parties.
- **Llama Life** — confetti + sound on task completion; lightweight,
  immediate, no long-term meta-game to maintain.

**Consensus:** ADHD brains have blunted reward sensitivity, so tasks without
immediate payoff feel invisible — small, *immediate*, low-effort celebration
per completion works better than delayed/cumulative rewards. The infantilizing
failure mode is apps that narrate the psychology at the user ("you're
building a streak!") rather than just being satisfying. Reward mechanics also
suffer hedonic adaptation over time, so variety/surprise matters more than
escalating point totals.

**Kairo opportunity:** Kairo has soft streaks + mood check-ins already. Adding
a small **variable-reward completion moment** (a short, varied micro-animation
or sound on task completion, not identical every time) would extend the
existing pattern cheaply. Avoid adding a points/currency meta-game — it's the
one thing power users of Habitica-style apps say becomes a chore itself.
Sources: [Finch analysis](https://medium.com/illumination/a-dopamine-loop-that-nourishes-you-finch-is-my-favourite-self-care-app-right-now-151c05fefd2b), [Habitica](https://www.gamificationhub.org/gamification-app/), [Llama Life](https://toolfinder.com/lists/adhd-time-management-apps)

---
## 4. Hyperfocus management
**What competitors do:**
- **"Overtime guards"** (multiple ADHD timer apps) — reminders timed to fire
  when a focus session runs past its planned end, framed as supportive not
  alarming.
- **Routinery** — spoken transition alerts ease users out of a step with a
  verbal nudge rather than a jarring sound.
- **Full-screen takeover timers** — some ADHD-specific timer apps (ADHD Timer
  Collection, calmalama) interrupt with a full-screen overlay rather than a
  dismissible notification, because hyperfocused users tune out small UI.

**Consensus:** Soft/ambiguous cues (a badge, a quiet chime) get filtered out
during hyperfocus — the interrupt has to be *disruptive enough to register*
(full-screen or spoken) while staying non-alarming in tone. Gentle breaks
every 25–45 min are the commonly cited cadence to pre-empt hyperfocus crashes
rather than only reacting after the fact.

**Kairo opportunity:** Kairo's focus timer has a ring + ambient sound but no
overtime behavior. Adding an **"overtime" state** to the focus timer — the
ring keeps a visible mode change (e.g., color shift + gentle full-viewport
pulse) once the planned duration is exceeded, with an explicit "extend 10 min
/ wrap up" choice — is a natural, scoped extension of an existing component.
Sources: [Hyperfocus management](https://ask.metafilter.com/381066/Break-my-hyperfocus), [Overtime guards](https://apps.apple.com/us/app/adhd-timer-collection/id6634579526), [Routinery voice alerts](https://www.routinery.app/blog/best-routines-planner-apps)

---
## 5. Time estimation calibration
**What competitors do:**
- **Amazing Marvin** — every task carries a duration estimate; a "Capacity
  Estimator" visually warns when planned time exceeds realistic daily
  capacity; a dedicated planned-vs-actual comparison view shows where
  estimates diverge from reality over time, explicitly to recalibrate.
- **Sunsama** — daily work-hour target with a running total; warns when a
  user overcommits before the day starts, not after.

**Consensus:** ADHD time-estimation errors are systematic (chronic
underestimation), and the fix users report working is a **feedback loop**,
not a one-time warning — seeing estimate vs. actual repeatedly, per task type,
is what recalibrates the internal sense of duration over weeks.

**Kairo opportunity:** Kairo has duration fields already (per AGENTS.md
energy/priority tags exist; assume duration too via timeline blocks). The gap
is a lightweight **planned-vs-actual delta surfaced in the review flow** —
when a task is marked "I did it," show actual elapsed (from focus-timer
sessions or resize edits) next to the original estimate, and roll that up
into a "you tend to underestimate X-tagged tasks by ~40%" insight in stats,
not just raw logging.
Sources: [Amazing Marvin time estimates](https://amazingmarvin.com/features/time-estimates/), [Sunsama capacity](https://www.sunsama.com/for-adhd)

---
## 6. Overwhelm reduction
**What competitors do:**
- **Sunsama Focus Mode** — hides everything except the current task,
  eliminating the "seeing everything else waiting" anxiety that triggers
  task-switching.
- **Sunsama daily capacity limit** — set a target work-hour budget; the app
  warns before you overcommit the day, addressing the "blank page, what do I
  do today" paralysis by forcing a guided plan step.
- **Llama Life** — strict one-thing-at-a-time timeboxed queue; you literally
  cannot see task #4 while doing task #2.

**Consensus:** The core mechanic that works is **reducing simultaneous visual
choices to one**, not better prioritization algorithms — decision fatigue,
not task quantity, is the actual overwhelm trigger for most ADHD users.
Day-load/capacity meters that warn *before* commitment (not after failure)
are rated far more useful than post-hoc "you're behind" nagging.

**Kairo opportunity:** Kairo's focus mode presumably already isolates a
single task during a session. The bigger unshipped piece is a **day-load
meter on the planning surface** (today/planner view) — a simple visual bar
showing planned-hours vs. a personal realistic-capacity baseline, shown while
building the day rather than only in review. Pairs naturally with the
existing AI plan-my-day feature as a soft constraint.
Sources: [Sunsama for ADHD](https://saskadhd.com/sunsama-review-a-therapists-take-on-the-daily-planner-that-actually-works-with-your-brain/), [Llama Life](https://www.revenuerulebreaker.com/this-daily-planner-is-beloved-by-entrepreneurs-with-adhd/)

---
## 7. Working memory supports
**What competitors do:**
- **Voice brain-dump apps** (Sprout, Todoist Ramble, Jot, Grain, BrainYap,
  Recordo) — speak a messy stream of thoughts, AI transcribes and sorts into
  tasks/notes/reminders. Common framing: "you can speak ~4x faster than you
  type on a phone — for ADHD that's the difference between capturing and
  losing the thought."
- **Jot** — optimized purely for capture latency: launch → type/speak
  immediately, no folder/category prompt before the note lands.

**Consensus:** Working-memory support apps succeed by minimizing the friction
between "I have a thought" and "it's saved" to near zero — any required
triage step (choose a list, pick a category) before saving is where thoughts
get lost. Sorting/organizing should happen *after* capture, never gating it.

**Kairo opportunity:** Kairo's inbox brain-dump already exists as a
zero-friction capture surface. The clear gap is **voice input on inbox
capture** — a mic button that transcribes directly into an inbox item, with
AI triage (auto-suggest energy/tag/duration) happening after save, not before.
A secondary, cheap win: a **"where was I" resume affordance** — when reopening
the app mid-day, surface the last-viewed/in-progress task instead of always
defaulting to "now."
Sources: [Voice brain dump apps](https://apps.apple.com/us/app/jot-instant-brain-dump/id6755014707), [Working memory framing](https://www.sproutapp.tech/features/brain-dump)

---
## 8. What users complain about (pitfalls to avoid)

- **Streak shame spirals.** Duolingo/Beminder-style users report streaks feel
  punitive ("I feel like I'm being punished if I miss a day"); ADHD's
  all-or-nothing thinking means a broken long streak often causes total app
  abandonment, not a reset. **Fix that works:** relapse-forgiving mechanics —
  apps that let users restore a streak via a small catch-up task saw a
  reported 32% higher reactivation rate vs. strict-reset models.
- **Notification fatigue / rigid auto-rescheduling.** Motion users report the
  algorithm repeatedly bumping the same missed task feels shaming ("watching
  a machine reschedule the same task for the fifth time just adds shame") and
  that tightly-packed AI schedules leave no slack for the unplanned, causing
  burnout rather than relief.
- **Over-configuration at onboarding.** Consistent complaint pattern: "if a
  tool asks you to build a workflow before you can add a single task, it's
  already too friction-heavy." Building a new system requires sustained
  executive function — exactly what ADHD impairs — so elaborate setup causes
  abandonment before value is ever felt.
- **Gamification meta-game becoming its own chore.** Point/currency systems
  (heavy RPG mechanics) are cited as eventually adding overhead rather than
  reducing it, once the novelty fades (hedonic adaptation hits ADHD reward
  circuits especially fast).
- **Cluttered UI / info overload.** Repeated complaint against Motion
  specifically: "no real answer for people whose problem isn't scheduling —
  it's information overload." More views/toggles is not itself a feature.

**Kairo implication:** Kairo's soft streaks are already framed gently per
AGENTS.md — keep them explicitly forgiving (a missed day should never zero a
streak outright; use a grace mechanic) and resist ever adding a points/XP
economy. Any new AI auto-scheduling must default to leaving slack, never
packing the day to 100% capacity, and every new feature should be
usable with zero setup on first touch.
Sources: [Streak shame](https://affine.pro/blog/gamified-to-do-list-apps-adhd), [Motion complaints](https://www.saner.ai/blogs/motion-reviews), [Over-configuration](https://www.blabby.ai/blog/adhd-productivity-apps), [Relapse-forgiving stat](https://affine.pro/blog/gamified-to-do-list-apps-adhd)

---
## TOP 12 — ranked features Kairo could ship (web-only, no widgets/native)

| # | Feature | Why (1 line) | Effort |
|---|---|---|---|
| 1 | **Day-load / capacity meter on planner** | Directly targets the #1 overwhelm trigger (too many simultaneous choices) and pairs with existing plan-my-day AI | M |
| 2 | **Voice capture on inbox** | Removes the single biggest working-memory leak point (typing friction on mobile) | M |
| 3 | **Focus timer overtime state** | Closes the one real gap in an already-built component; prevents hyperfocus burnout without nagging | S |
| 4 | **"Start just 5 min" quick-launch on inbox/stuck items** | Turns the most evidence-backed paralysis-breaker into a one-tap action instead of advice | S |
| 5 | **Relapse-forgiving streak grace mechanic** | Directly prevents the #1 named complaint (shame-driven abandonment) across every competitor reviewed | S |
| 6 | **Planned-vs-actual delta in review + stats** | Turns existing review flow + focus-timer session data into the calibration loop that actually improves estimates | M |
| 7 | **AI breakdown granularity ("spiciness") slider** | Cheap extension of existing AI task-breakdown feature; gives users control over over/under-breakdown | S |
| 8 | **"Where was I" resume card on app open** | Working-memory support with near-zero UX cost; reduces re-orientation tax after every interruption | S |
| 9 | **Variable micro-celebration on completion** | Keeps existing soft-streak/mood system from going stale (hedonic adaptation) without adding a points economy | S |
| 10 | **Persistent "time until next" chip outside timeline** | Extends existing now-line concept to be glanceable from any screen, not just Today | S |
| 11 | **Voice/TTS step announcements in routines** | Matches Routinery's most-praised 2026 addition; helps hands-free/no-screen transitions during routines | M |
| 12 | **Ambient "focus room" framing for focus sessions** | Approximates body-doubling's psychological benefit (evidence-backed) without building real-time matching | L |

Effort key: S = days, M = ~1–2 weeks, L = multi-week/new subsystem (real-time infra for anything beyond ambience).
