# Tiimo — Feature Inventory

Research date: 2026-07-12. Compiled from Tiimo's public marketing site, FAQ/help pages, App Store listing, third-party reviews, and community feedback board. All descriptions below are written in my own words — no copyrighted Tiimo copy or images are reproduced. Facts only, no build plan.

---

## 1. Product overview

**What it is:** Tiimo is a visual daily planner built specifically for neurodivergent users — ADHD, autistic, and otherwise "brain-different" people who struggle with executive function, time-blindness, task initiation, and traditional list-based planners. It combines a color-coded visual timeline, a to-do/brain-dump list, a visual focus timer, gentle notifications, and (as of 2025) an AI "Co-Planner" into one cross-device app.

**Positioning:** Explicitly *not* a general productivity app — marketed as "a visual planner for every neurotype," built with and for the ADHD/autism/dyslexia community (one co-founder is a dyslexic ADHDer). Distinguishes itself from calendar apps by treating itself as a personal daily planner rather than a scheduling/calendar-of-record tool (this is why calendar sync is explicitly one-way import only, by design — see §2).

**Target users:** Adults and teens with ADHD, autism, dyslexia, and other neurodivergent profiles; also marketed secondarily to students, freelancers, and anyone with executive-function or time-management challenges. Family/caregiver use is supported via shared profiles.

**Platforms:** iOS, iPadOS, watchOS (Apple Watch app added ~mid-2026, per App Store changelog), Android (rebuilt from scratch in 2025/2026 as a native rewrite — currently behind iOS in feature parity), and a web app (webapp.tiimoapp.com). No native macOS or Windows desktop app — "desktop" support means the responsive web app.

**Recognition:** Apple App Store "iPhone App of the Year" 2025; Apple Design Awards finalist 2024; reported 3M+ downloads / 500K+ active users; ~4.6/5 rating on ~18K App Store ratings.

**Pricing model — free vs. Tiimo Pro (Premium):**
- **Free tier** (iOS/Android only — the web app requires a trial or paid subscription to use at all): visual planner/timeline, to-do list, focus timer, "Anytime" tasks, basic personalization, and *limited* access to AI features (subtask generation / Co-Planner has a capped number of free uses).
- **Tiimo Pro (paid subscription):** unlocks unlimited AI Co-Planner/subtask generation, calendar sync/import (Google, Apple, Outlook via Google), multi-device sync, up to 5 shared family/support profiles under one subscription, full personalization (themes, icons, dyslexia font, etc.), neuroinclusive courses and community hub content, and full widget/Live Activity features.
- **Trial:** 7-day free trial, but only offered on the *annual* plan; monthly plans are charged immediately with no trial.
- **Price:** roughly $6/month or ~$35–42/year (varies by region/store); purchased via App Store, Google Play, or Stripe on the web.
- **No ads**, ever, even on the free tier (explicit brand commitment — "why Tiimo isn't fully free but will always be ad-free").
- Subscriptions are managed through whichever platform they were purchased on (Apple, Google, or Stripe) and accounts cannot be merged once created.

---

## 2. Feature inventory

### A. Visual timeline / day view

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Color-coded daily timeline | Tasks/activities render as colored blocks (not plain text rows) on a chronological timeline for the day, each carrying its own icon and color so the day can be scanned visually rather than read | iOS, Android, Web, Watch | Free |
| Day / week / month views | Multiple zoom levels for viewing the schedule beyond just "today" | iOS, Web | Free (month/week breadth may vary; not fully documented) |
| "Anytime" activities | Tasks/activities that aren't pinned to a clock time — they float in a flexible zone of the day rather than a fixed slot, for things that don't need scheduling precision | All | Free |
| Drag-and-drop rearranging | Tasks can be dragged to new times/positions on the timeline | iOS, Android, Web | Free |
| Time-of-day grouping (Android) | The rebuilt Android app groups tasks into Morning/Afternoon/Evening bands rather than a precise timeline (a simplified interim design vs. iOS) | Android | Free |
| "Review Today" | A guided end-of-day (or on-demand) check to see what's left undone and decide whether to reschedule, skip, or complete it | iOS, Web | Free/Pro (exact gating undocumented) |
| Visual gaps between events | **Reported as missing** by users — no built-in visualization of free time between fixed events; a known gap versus competitors | — | N/A (feature gap) |
| Fixed calendar items vs. shiftable tasks | Imported calendar events are locked in place while Tiimo-native tasks can shift/reflow around them (noted both as a feature and, per user feedback, a limitation since drag-and-drop doesn't move imported calendar items) | iOS, Android, Web | Free/Pro |

Notes on gaps in public documentation: Tiimo's own marketing pages do not explicitly document a "now-line" (current-time indicator) or an explicit vertical-vs-horizontal timeline toggle. Design showcase sources describing the UI in technical rendering detail were not accessible for confirmation. Given the product's "visual timeline" framing and screenshots referenced in reviews, a now-line-style current-time marker is very likely present but could not be independently confirmed from text sources — flag as unverified rather than asserted.

### B. Tasks & to-dos

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Tasks (scheduled) vs. To-dos (unscheduled) | Explicit two-bucket model: "Tasks" live on the Today timeline with a time or as Anytime; "To-dos" live in a separate To-do tab as an unscheduled brain-dump/mental inbox until moved onto the plan | All | Free |
| To-do tab / brain dump / inbox | A dedicated capture space explicitly framed as an "external hard drive" for anything floating in the user's head — add now, schedule later, no forced organization | All | Free |
| Subtasks / checklists | Tasks can be broken into a checklist of subtasks/steps, either manually or via AI | All | Free (manual) / Pro (AI-generated, unlimited) |
| Icons per task | Each task/activity gets a custom icon from a large library for quick visual recognition | All | Free (Pro unlocks full/seasonal icon sets) |
| Colors per task | Each task can be assigned one of 3,000+ colors; suggested convention of using color meaningfully (e.g., green = rest, blue = focus) | All | Free (basic) / Pro (full palette) |
| Tags | Freeform or preset tags for categorizing tasks (e.g., by energy, category, urgency); a tag-based library/search view has been in development | All | Free/Pro |
| Notes | Free-text notes field attached to a task | All | Free |
| Duration / time estimates | Tasks can carry a manually-set or AI-suggested time estimate, addressing ADHD "time blindness" and overcommitment | All | AI-suggested estimates are Pro; manual duration setting is free |
| Priority levels | Tasks can be sorted High/Medium/Low priority, adjustable via drag-and-drop, with AI-assisted priority grouping/suggestions | All | Free (manual) / Pro (AI grouping) |
| Energy-level tagging | Reviews and marketing copy reference tagging/organizing tasks by "energy" alongside category/urgency, and smart scheduling that reportedly learns energy patterns over time; exact UI mechanics not fully documented in first-party text sources | iOS, Web (implied) | Pro (implied, tied to AI features) |
| All-day / no-time tasks | Handled via the "Anytime" designation rather than a distinct "all-day" flag | All | Free |
| Recurring/repeat tasks | Activities can repeat on an interval; current options are basic (daily/weekly/every N weeks up to ~4) — users have publicly requested more flexible custom recurrence (e.g., every 6/8/11 weeks), which is a known product gap | All | Free/Pro |
| Skip / mark incomplete | Users can skip a task instance or mark it incomplete rather than only "done" | All | Free |

### C. Routines & recurring activities

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Routines (activity sequences) | A "routine" bundles multiple activities/steps into one repeatable sequence (e.g., a morning routine), sped up by not having to rebuild the sequence daily | All | Free (basic) / Pro (advanced customization) |
| Repeat scheduling | Attach a start day + repeat interval to a routine or single activity | All | Free/Pro |
| Routine builder / library redesign | Company has been actively redesigning the in-app routine builder and a personal "library" of saved routines, including tag-based search/filtering and a "favorites" folder concept | iOS (in progress) | Pro (implied) |
| Community/shared routine templates | **Not yet shipped as of this research** — a public gallery of community-created routine templates has been repeatedly requested by users; Tiimo's team has acknowledged interest but has not committed to an in-app implementation (may be handled externally, e.g. social media, instead) | — | N/A (feature gap) |
| Pause a recurring routine | Requested by users as a way to temporarily suspend (not delete) a recurring routine; status as shipped/unshipped unclear from available sources | — | Unclear |

### D. Focus timer / activity timer

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Visual countdown / progress ring | The timer shows elapsed/remaining time as a visual progress display (a "progress ring") rather than only a numeric countdown, intended to make abstract time tangible | iOS, iPadOS, watchOS, Android, Web | Free (basic use) |
| Auto-start on scheduled tasks | If a task has a set time, its timer starts automatically when that time arrives; flexible/Anytime tasks are started manually via a "Start task" action | All | Free |
| Pause / resume | Timer can be paused and resumed | All | Free |
| Extend ("+1 minute") | A quick-add control lets the user add a minute (or several) to a running timer rather than letting it hit zero and stop | All | Free/Pro (unclear) |
| Manual complete / drag-to-finish | Users can manually mark a timed task complete by dragging the timer to completion rather than waiting it out | All | Free |
| Checklist-during-focus | Subtasks/checklist items can be displayed and checked off while a single task's timer runs, supporting single-task focus | All | Free |
| Widget / Live Activity / Dynamic Island timer | The running timer is mirrored to iOS Home Screen widgets, Lock Screen Live Activities, and Dynamic Island so it's visible without opening the app | iOS/iPadOS | Free/Pro (widgets under Pro personalization, per FAQ) |
| Ambient sounds / "Focus tunes" | Built-in ambient sound/music option to play during focus sessions — confirmed as a feature being actively rolled out (not universally available at time of research); not yet on Android as of the 2025/2026 rebuild | iOS (rolling out); planned for Android | Likely Pro |
| Hyperfocus support | No dedicated "hyperfocus alarm" feature confirmed; instead Tiimo relies on recurring break reminders, the visual timer staying on-screen, and mood-tracking pattern insights to help users notice and interrupt hyperfocus episodes | iOS, Web | Free/Pro mix |
| Break prompts | Recurring reminders can be scheduled to prompt a pause/check-in, especially framed as useful before tasks known to trigger hyperfocus | All | Free/Pro |
| Known gap: screen dimming during timer | User complaints report the screen can still lock/dim during an active timer, undermining the "always-visible" countdown promise | — | N/A (reported bug/gap) |

### E. AI features

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| AI Co-Planner (conversational planning) | Chat-style assistant — type or speak what's on your mind ("brain dump") and the AI turns it into structured tasks with times, icons, and tags | iOS, iPadOS, Web (Android planned, not yet shipped as of the Android rebuild) | Limited free uses; unlimited on Pro |
| AI task breakdown / subtask generation | Given a broad task or goal, AI generates a step-by-step checklist of subtasks automatically | iOS, Android, Web | Limited free / unlimited Pro |
| AI time estimation | AI suggests a realistic duration for a task or each of its subtasks | iOS, Web | Pro (implied) |
| Natural-language / voice add | Tasks can be created by typing or speaking naturally rather than filling structured fields | iOS, iPadOS, Web | Free/Pro |
| Dynamic re-planning via chat | User can tell the Co-Planner about a disruption in natural language (e.g., "I'm running 10 minutes late") and the AI shifts/reshuffles the rest of the day's schedule accordingly | iOS, Web | Pro (implied) |
| AI priority grouping | AI clusters/ranks to-dos by apparent priority to reduce decision fatigue | iOS, Android, Web | Free (limited) / Pro (unlimited) |
| Smart scheduling / energy-pattern learning | Marketing/review sources describe the app "learning" a user's energy patterns over time and suggesting optimal timing for certain task types; treat as an emerging/marketing-stage claim rather than a fully documented, verifiable feature | iOS (implied) | Pro (implied) |

### F. Calendar integration

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Calendar import | One-time-setup import from Apple Calendar, Google Calendar, and Outlook/Exchange (Outlook must first be connected through Google Calendar on Apple devices, since direct Outlook import isn't supported there) | iOS, Web (Android: Google Calendar planned, not yet shipped) | Pro |
| Reminders (Apple) sync | Imports/syncs with Apple Reminders in addition to calendar events | iOS | Pro |
| One-way sync only, by design | Tiimo deliberately does **not** support two-way sync — imported calendar events flow into Tiimo, but Tiimo-native tasks are not pushed back out to Google/Outlook/Apple Calendar. This is a stated product decision (Tiimo positions itself as a personal planner layered on top of a calendar-of-record, not a calendar replacement), not a technical limitation still being worked on | — | Pro |
| Per-device import step | Each device must import the calendar separately once; after that, sync continues automatically | All | Pro |
| Imported events are "locked" | Calendar-sourced events render on the timeline but can't be dragged/edited like native Tiimo tasks | All | Pro |

### G. Notifications & reminders

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Per-notification-type toggles | Users can turn on/off categories of notifications independently (rather than one global on/off) in Settings → Notifications | iOS, Web | Free |
| Custom timing | Users can set specific times for recurring reminder types | iOS, Web | Free |
| Custom sounds | Notification sound can be chosen/changed, separately configurable on web (webapp.tiimoapp.com/settings/notifications-sounds) vs. iOS system settings | iOS, Web | Free |
| "Review Today" daily check-in | A once-daily prompt to reflect on the day and reset/replan | iOS | Free/Pro |
| "Review your week" | A weekly (Sunday) prompt summarizing completed tasks and helping plan the coming week | iOS | Free/Pro |
| Gentle/soft notification design | Explicit design philosophy of "nudges, not demands" — softer tones and copy versus harsh alarm-style alerts, intended to avoid overwhelming neurodivergent users | All | Free |
| Halfway/mid-task nudges | Referenced in user feedback threads as a pain point (e.g., a break-reminder firing halfway through the break rather than at start/end) rather than a clearly documented, reliable feature — treat as partially implemented/inconsistent | iOS | Free/Pro |
| Per-task notification granularity | Users have publicly requested finer, per-task notification control beyond app-wide settings; appears not fully available yet | — | N/A (feature gap) |

### H. Widgets & watch

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Home Screen widgets | Widgets showing the day's plan / to-do list / focus timer at a glance | iOS, iPadOS | Free (basic) / Pro (customization) |
| Lock Screen widgets | Same categories of glanceable info surfaced on the Lock Screen | iOS | Pro (implied) |
| Interactive widgets | Newer widget generation allows direct interaction (e.g., checking off a task) from the widget itself, not just viewing | iOS | Pro (implied) |
| Live Activities / Dynamic Island | Running focus timer or current task shown live on the Lock Screen and in the Dynamic Island on supported iPhones | iOS | Free/Pro |
| Apple Watch app | Dedicated watchOS app added in 2026 (per App Store "What's New") letting users view today's plan and start/track the focus timer from the wrist | watchOS | Pro (implied, ties to multi-device sync) |
| Watch complications | **Reported gap** — users note the current watch experience is limited to opening the app rather than offering richer watch face complications | watchOS | N/A (feature gap) |

### I. Personalization

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| 3,000+ color options | Large color palette for tasks/activities/UI elements | All | Free (subset) / Pro (full range) |
| Custom icon library | Large icon set for tasks, including seasonal/refresh icon packs | All | Free (subset) / Pro (full range) |
| Light / Dark / System theme | Standard appearance modes | All | Free |
| Dyslexia-friendly font | Optional font switch aimed at reducing reading fatigue/visual stress | iOS, Web | Free/Pro |
| Adjustable text size | Text can scale up to 200%+ (works with/extends system Dynamic Type) | iOS | Free |
| Family/shared profiles | Up to 5 profiles under one Pro subscription, each with separate schedules/settings (useful for partners, kids, support workers); settings are stored per-device/profile, not merged | iOS, Web | Pro |
| Apple Family Sharing support | Alternative to manual profile-sharing — Family Sharing lets each family member have a private account under one shared subscription bill | iOS | Pro |

### J. Library / templates

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Personal routine library | Saved routines/activity sequences a user can reuse; being redesigned to add tag-based search and a "favorites" concept | iOS | Free/Pro |
| Pre-made starter content at onboarding | New accounts are pre-populated with a few suggested sample items (e.g., "morning coffee," "start work," "dinner," evening wind-down) to demonstrate the format rather than starting from a blank day | All | Free |
| Community template gallery | **Not shipped.** Frequently requested by users (a public gallery of community-made routines to browse/copy); Tiimo has acknowledged the request but not committed to an in-app feature | — | N/A (feature gap) |
| Neuroinclusive courses | Structured educational content/guides on productivity, habits, and neurodivergent-specific strategies, positioned as a Pro perk | iOS, Web (implied) | Pro |
| Community hub | In-app or associated space with tips/content contributed by/for neurodivergent teens and adults | iOS (implied) | Pro |

### K. Stats / insights

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Planning streaks | Tracks consecutive days of planning/engagement, gamifying consistency | iOS (implied) | Free/Pro |
| Personal insights / stats | Summary stats on completed tasks and usage patterns intended to reinforce a sense of progress | iOS, Web | Pro (implied) |
| Mood tracking / check-ins | Users log how they're feeling as a quick reflection, separate from or alongside task completion | iOS, Web | Free/Pro |
| Apple Health sync (Tiimo Wellbeing) | Mood/reflection check-ins sync into Apple Health, shown alongside sleep, movement, and other health metrics so users can spot correlations between mood and physical patterns | iOS | Pro (implied) |
| Editorial "review techniques" (Winventory, Progress Check, Tiny Rewards) | These are coaching *techniques* described in Tiimo's educational/blog content (resource hub) for reviewing wins and giving small self-rewards — they read as guidance/content rather than confirmed dedicated in-app UI features; worth noting as part of Tiimo's product *philosophy* around motivation, but should not be assumed to be literal named app screens without further in-product verification | — | Content, not confirmed as app UI |

### L. Accounts & sync

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Sign-up via Apple / Google / Email | Standard auth options | iOS, Web | Free |
| Cross-device sync | Signing in with the same account on multiple devices keeps the plan in sync automatically (once each device's calendar import, if any, is separately configured) | iOS, Android, Web, Watch | Free (core data) / Pro (full feature sync, e.g. calendar) |
| No account merging | Explicitly unsupported — two separate accounts cannot later be combined into one | — | N/A (limitation) |
| Family/shared profile billing | One Pro subscription can cover up to 5 people via in-app profiles or Apple Family Sharing | iOS | Pro |
| Web app requires subscription | Unlike iOS/Android, the web planner is not usable on a free tier — it requires an active trial or paid subscription | Web | Pro-gated entirely |

### M. Accessibility

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| VoiceOver / screen reader support | Compatible with iOS VoiceOver for gesture/speech-based navigation | iOS | Free |
| Dynamic Type support | Respects/extends iOS system text-size settings | iOS | Free |
| Dyslexia-friendly font toggle | See Personalization above | iOS, Web | Free/Pro |
| High-contrast / dark mode | Supports reduced eye-strain color schemes | All | Free |
| Sound toggles | Users can turn off completion/countdown sounds and notification sounds individually rather than only a master mute | All | Free |
| Sensory-friendly design ethos | General design commitment (stated in company content) to reduce sensory overwhelm — muted/considered color use, gentle animations, minimal forced interruptions — rather than one single toggle | All | Free |
| Reduced-motion setting | Not explicitly documented as a standalone Tiimo setting in the sources reviewed; likely inherited from iOS system-level "Reduce Motion" rather than an in-app control — unverified | — | Unverified |

### N. Onboarding & settings

| Feature | Description | Platforms | Free/Pro |
|---|---|---|---|
| Short onboarding questionnaire | A small number of setup questions (publicly reported as reduced from 3 to 2 over time) used to tailor paywall messaging and initial suggestions, including asking about neurodivergent status to tailor copy | iOS | Free |
| Pre-filled starter schedule | New users land on a Today view pre-populated with a few sample activities rather than a blank slate | iOS | Free |
| Guided 5-step post-paywall setup | After choosing a plan, users go through a structured multi-step setup (rather than being dropped straight into the full app) covering core preferences | iOS | Free/Pro |
| Opt-in notification permission framing | Notification permission is asked for with an explicit, low-pressure opt-in early in onboarding rather than an aggressive system prompt | iOS | Free |
| Single, simplified pricing screen | Pricing was simplified over time from multiple confusing tiers down to one plan with two billing-period choices (monthly/annual) | iOS | N/A (business model) |
| Settings: notifications, sounds, appearance, profiles, calendar import, subscription management | Central settings area covering all the above personalization/account topics | All | Free/Pro mix |

---

## 3. What makes it distinctive (UX patterns to match in spirit)

- **Two-bucket mental model (Tasks vs. To-dos):** a hard product distinction between "things with a time" (on the timeline) and "things without a time yet" (in an unstructured brain-dump inbox) — this separation, not just a single flat task list, is core to how the app reduces overwhelm.
- **"Anytime" as a first-class scheduling state:** rather than forcing every task into a clock slot or bucketing everything as "all day," Tiimo treats flexible/no-fixed-time tasks as their own visual category on the timeline.
- **Visual-first, not text-first, day view:** the day is represented as colored, icon-bearing blocks meant to be scanned at a glance rather than read line by line — explicitly designed against plain list/text UI.
- **AI framed as a co-planner/conversation partner, not a form-filler:** the AI's primary value proposition is unblocking task *initiation* ("brain dump → structured plan") rather than optimizing an already-organized schedule — it targets executive dysfunction specifically, including mid-day disruption replanning via natural language.
- **Deliberately one-way calendar sync:** Tiimo pulls in outside calendar events but never pushes its own tasks back out, a conscious positioning choice that it is a personal planning layer, not a calendar replacement or scheduling-of-record tool.
- **Notifications as gentle nudges, opt-in and granular:** soft tone, explicit permission-asking, and category-level (not just global) control, reflecting sensory-sensitivity design for the target audience.
- **Motivation through small reflection rituals rather than heavy gamification:** streaks exist, but the more emphasized pattern is lightweight review rituals (daily/weekly check-ins, noticing wins) instead of aggressive points/badges systems.
- **Family/shared-profile model as a first-class use case:** up to 5 profiles under one subscription is treated as a core feature (for parents, partners, support workers), not an afterthought.
- **Distinct brand personality:** a recognizable illustrated mascot/visual identity is called out by outside observers as a deliberate memorability strategy, differentiating Tiimo from "faceless" utility apps.
- **Deep, ongoing platform-parity investment:** Android was fully rebuilt from scratch (rather than patched) specifically to catch up to iOS, showing the product treats visual/interaction fidelity as core to the value proposition, not a nice-to-have — a signal that shortcuts on visual polish undermine the core promise for this audience.
- **Known rough edges worth avoiding in a competitor:** locked/undraggable imported calendar events, inconsistent break-timing nudges, timer-during-screen-lock issues, and limited custom recurrence intervals are recurring user complaints — areas where a competing app could differentiate by simply doing them well.

---

## 4. Sources

- https://www.tiimoapp.com/
- https://www.tiimoapp.com/product
- https://www.tiimoapp.com/product/ai-planning
- https://www.tiimoapp.com/product/visual-planning
- https://www.tiimoapp.com/product/focus
- https://www.tiimoapp.com/product/to-do-list
- https://www.tiimoapp.com/product/widgets-live-activities
- https://www.tiimoapp.com/faq
- https://www.tiimoapp.com/faq/manage-tasks
- https://www.tiimoapp.com/faq/widgets
- https://www.tiimoapp.com/faq/customize-and-add-profiles
- https://www.tiimoapp.com/faq/notifications
- https://www.tiimoapp.com/faq/focus-timer
- https://www.tiimoapp.com/faq/calendar-import
- https://www.tiimoapp.com/resource-hub/tiimo-android-relaunch
- https://www.tiimoapp.com/resource-hub/apple-tiimo-wellbeing
- https://www.tiimoapp.com/resource-hub/why-tiimo-went-freemium
- https://www.tiimoapp.com/resource-hub/discover-interactive-widgets-ios
- https://www.tiimoapp.com/resource-hub/new-ios-widgets
- https://www.tiimoapp.com/resource-hub/hyperfocus-adhd
- https://www.tiimoapp.com/resource-hub/sensory-design-neurodivergent-accessibility
- https://www.tiimoapp.com/resource-hub/accessibility-gaad-2025
- https://www.tiimoapp.com/resource-hub/avoid-losing-motivation-and-celebrate-your-wins
- https://www.tiimoapp.com/resource-hub/how-to-start-planning
- https://www.tiimoapp.com/resource-hub/5-steps-to-start-planning-with-tiimo
- https://www.tiimoapp.com/resource-hub/inclusive-planning
- https://www.tiimoapp.com/resource-hub/ai-co-planner-design
- https://www.tiimoapp.com/reviews
- https://apps.apple.com/us/app/tiimo-to-do-list-ai-planner/id1480220328
- https://play.google.com/store/apps/details?id=com.tiimo.androidappreactnative
- https://tiimo.nolt.io/ (public feature-request/feedback board, multiple threads: #26 routines on Android, #44 repeat every X days, #68 two-way calendar sync, #71 per-task notifications, #77 lock screen tasks-in-progress, #78 statistics, #126 skip/mark incomplete, #195 custom repeat >4 weeks, #428 community page, #488 pause recurring routines, #528 export to calendar, #846 don't auto-start tasks, #1025 desktop version, #1608 content suggestions)
- https://www.retention.blog/p/app-of-the-year-tiimo
- https://daringfireball.net/2025/12/2025_app_store_award_winners
- https://habi.app/insights/tiimo-alternatives/
- https://habi.app/insights/best-adhd-planner-apps/
- https://www.selfpause.com/resources/tiimo
- https://aiinsightsnews.net/tiimo/
- https://justuseapp.com/en/app/1480220328/tiimo-visual-daily-planner/reviews
- https://justuseapp.com/en/app/1480220328/tiimo-visual-daily-planner/contact
- https://screensdesign.com/showcase/tiimo-ai-plan-focus-to-do (accessed but returned only page title, no substantive content — cited as attempted but unconfirmed)

**Confidence note:** Most feature names and general behavior are corroborated across the company's own product/FAQ pages and independent reviews. A handful of specific implementation details (exact free/Pro gating line for individual sub-features, the presence/absence of a literal "now-line" or vertical/horizontal timeline toggle, and whether "Winventory"/"Progress Check" are actual UI screens versus blog-only coaching concepts) could not be fully confirmed from text-based sources and are flagged inline above rather than asserted as fact. For a build-decision-grade confirmation of those specific points, hands-on testing of the live app (App Store download) is recommended before finalizing the parity matrix.
