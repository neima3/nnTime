import SwiftUI
import WidgetKit

// MARK: - Today: proportional timeline (1 min = 1.7 pt), now-line, gentle header

struct TodayView: View {
    @Environment(AppState.self) private var app
    @State private var blocks: [DayBlock] = []
    @State private var date = ""
    @State private var loading = true
    @State private var nowMin = 0
    @State private var showEditor = false
    @State private var editingBlock: DayBlock?
    @State private var showPick = false
    @State private var showReview = false
    @State private var editorStart = 9 * 60
    @State private var loadError: String?
    @State private var peakHour: Int?
    @State private var peakDismissedDay = ""
    @State private var ritualDismissedDay = ""
    @State private var briefDismissedDay = ""
    @State private var showTemplates = false
    @State private var usingCachedDay = false
    @State private var mutationsLocked = false
    @State private var submittingOccurrences:
        Set<OfflineTodayOccurrenceIdentity> = []
    @State private var latestLoadID = UUID()
    @State private var cachedMutationFailure:
        OfflineTodayStatusMutation.Failure.Stage?
    /// 0 = today, ±n days.
    @State private var dayOffset = 0
    /// Device-local "today I don't have it" switch (mirrors web LowBattery).
    @State private var lowBattery = false

    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Color.kCanvas.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.kIris)
                } else if blocks.isEmpty {
                    VStack(spacing: 14) {
                        if noticeMode != .hidden {
                            cachedNotice
                                .padding(.horizontal, 16)
                        }
                        emptyState
                    }
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            header
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                            if let brief = dailyBrief {
                                brief
                                    .padding(.horizontal, 16)
                                    .padding(.top, 10)
                            }
                            if dayOffset == 0 && !mutationsLocked {
                                lowBatteryRow
                                    .padding(.horizontal, 20)
                                    .padding(.top, 8)
                            }
                            if noticeMode != .hidden {
                                cachedNotice
                                    .padding(.horizontal, 16)
                                    .padding(.top, 10)
                            }
                            if let ritual = dayRitual {
                                ritual
                                    .padding(.horizontal, 16)
                                    .padding(.top, 10)
                            }
                            if let nudge = peakNudge {
                                nudge
                                    .padding(.horizontal, 16)
                                    .padding(.top, 10)
                            }
                            TimelineCanvas(
                                blocks: blocks,
                                nowMin: nowMin,
                                readOnly: mutationsLocked,
                                lowBattery: lowBattery && dayOffset == 0,
                                onComplete: { block in Task { await toggle(block) } },
                                onDelete: { block in Task { await remove(block) } },
                                onFocus: { block in
                                    var info: [String: Any] = [
                                        "title": block.title, "emoji": block.emoji,
                                        "duration": block.durationMin,
                                        "activityId": block.id, "revision": block.revision,
                                    ]
                                    if let ok = block.occurrenceKey { info["occurrenceKey"] = ok }
                                    if !block.checklist.isEmpty {
                                        info["checklist"] = block.checklist.map { ["label": $0.label, "done": $0.done] }
                                    }
                                    NotificationCenter.default.post(
                                        name: .kairoStartFocus, object: nil, userInfo: info
                                    )
                                },
                                onOpen: { block in editingBlock = block },
                                onMove: { block, newStart in Task { await move(block, to: newStart) } },
                                pendingOccurrences: disabledOccurrences
                            )
                            .padding(.horizontal, 16)
                            .padding(.bottom, 120)
                        }
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                withAnimation(.spring(response: 0.5, dampingFraction: 0.9)) {
                                    proxy.scrollTo("now-line", anchor: .center)
                                }
                            }
                        }
                    }
                }

                if !mutationsLocked {
                    fab
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 14) {
                        Button {
                            dayOffset -= 1
                            Task { await load() }
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.kInkSoft)
                        }
                        .accessibilityLabel("Previous day")
                        if !mutationsLocked,
                           dayOffset == 0,
                           blocks.contains(where: { !$0.done })
                        {
                            Button { showReview = true } label: {
                                Image(systemName: "checklist").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kIris)
                            }
                            .accessibilityLabel("Review today")
                        }
                    }
                }
                ToolbarItem(placement: .principal) {
                    Button {
                        guard dayOffset != 0 else { return }
                        dayOffset = 0
                        Task { await load() }
                    } label: {
                        VStack(spacing: 0) {
                            Text(weekdayText.uppercased())
                                .font(.kBody(11, weight: .bold))
                                .kerning(1.4)
                                .foregroundStyle(Color.kIris)
                            Text(titleText)
                                .font(.kDisplay(17, relativeTo: .headline))
                                .foregroundStyle(Color.kInk)
                        }
                    }
                    .accessibilityLabel(dayOffset == 0 ? "Today" : "Back to today")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        // Quick-jump (H3): search is one tap from the day you're on.
                        NavigationLink {
                            SearchView()
                        } label: {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.kInkSoft)
                        }
                        .accessibilityLabel("Search")
                        if !mutationsLocked,
                           dayOffset == 0,
                           blocks.contains(where: { !$0.done })
                        {
                            Button { showPick = true } label: {
                                Image(systemName: "dice").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kIris)
                            }
                            .accessibilityLabel("Pick for me")
                        }
                        Button {
                            dayOffset += 1
                            Task { await load() }
                        } label: {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.kInkSoft)
                        }
                        .accessibilityLabel("Next day")
                    }
                }
            }
            .toolbarBackground(Color.kCanvas, for: .navigationBar)
            .sheet(isPresented: $showEditor, onDismiss: { Task { await load() } }) {
                EditorSheet(date: date, startMin: editorStart)
            }
            .sheet(item: $editingBlock, onDismiss: { Task { await load() } }) { block in
                EditorSheet(date: date, startMin: block.startMin, editing: block)
            }
            .sheet(isPresented: $showPick) {
                PickForMeSheet(blocks: blocks, nowMin: nowMin, lowBattery: lowBattery && dayOffset == 0)
            }
            .sheet(isPresented: $showReview, onDismiss: { Task { await load() } }) {
                ReviewSheet(date: date, zone: app.timezone, items: blocks) { }
            }
            .sheet(isPresented: $showTemplates, onDismiss: { Task { await load() } }) {
                NavigationStack { TemplatesView() }
            }
            .refreshable {
                await app.synchronize()
                await load()
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            SyncStatusNotices(surface: .today)
        }
        .task { await load() }
        .onReceive(tick) { _ in nowMin = KTime.nowMinutes(in: app.timezone) }
        .onReceive(NotificationCenter.default.publisher(for: .kairoDayChanged)) { _ in
            Task { await load() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .kairoSyncCompleted)) { _ in
            Task { await load() }
        }
    }

    private var viewedDate: Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = app.timezone
        return cal.date(byAdding: .day, value: dayOffset, to: Date()) ?? Date()
    }

    private var titleText: String {
        let df = DateFormatter()
        df.dateFormat = "MMMM d"
        df.timeZone = app.timezone
        return df.string(from: viewedDate)
    }

    private var weekdayText: String {
        let df = DateFormatter()
        df.dateFormat = "EEEE"
        df.timeZone = app.timezone
        return df.string(from: viewedDate)
    }

    private var doneCount: Int { blocks.filter(\.done).count }

    /// Day Rituals (parity) — a morning kickoff on a sparse day, an evening
    /// shutdown when things are still open. Time-windowed, once per day.
    /// Warm morning orientation (web DailyBrief parity): morning-only,
    /// today-only, once per day. Reuses the loaded peak-hour insight.
    private var dailyBrief: AnyView? {
        guard dayOffset == 0, !mutationsLocked else { return nil }
        var hour = Calendar.current.component(.hour, from: Date())
#if DEBUG
        // The tour fixture pins a morning hour so the card is provable at
        // any wall-clock time.
        if ProcessInfo.processInfo.arguments.contains("-kairoTodayFixture") {
            hour = 9
        }
#endif
        let today = KTime.dateString(Date(), zone: .current)
        guard DailyBriefPolicy.shouldShow(
            hour: hour, dismissedDay: briefDismissedDay, today: today
        ) else { return nil }

        let done = blocks.filter(\.done).count
        let first = blocks.filter { !$0.done }.min { $0.startMin < $1.startMin }

        return AnyView(
            HStack(alignment: .top, spacing: 12) {
                Text("☀️")
                    .font(.system(size: 18))
                    .frame(width: 36, height: 36)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.kCatButter))
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(DailyBriefPolicy.greeting(hour: hour)). \(DailyBriefPolicy.summary(total: blocks.count, done: done))")
                        .font(.kBody(14, weight: .bold))
                        .foregroundStyle(Color.kInk)
                    if let first {
                        Text("First up · \(first.emoji) \(first.title) at \(KTime.hhmm(first.startMin))")
                            .font(.kBody(13, weight: .medium))
                            .foregroundStyle(Color.kInkSoft)
                    }
                    if let peakHour {
                        Text("💡 Your focus usually peaks around \(Insights.hourLabel(peakHour)) — a good slot for the hard one.")
                            .font(.kBody(12.5, weight: .medium))
                            .foregroundStyle(Color.kInkSoft)
                    }
                }
                Spacer(minLength: 0)
                Button {
                    briefDismissedDay = today
                    UserDefaults.standard.set(today, forKey: "kairo.briefDismissed")
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.kInkFaint)
                        .frame(width: 28, height: 28)
                }
                .accessibilityLabel("Dismiss brief for today")
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.kCatButter.opacity(0.35))
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
            )
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1))
            .kCardShadow()
        )
    }

    private var dayRitual: AnyView? {
        guard dayOffset == 0, !mutationsLocked else { return nil }
        let today = KTime.dateString(Date(), zone: .current)
        guard ritualDismissedDay != today else { return nil }
        let hour = Calendar.current.component(.hour, from: Date())
        let unfinished = blocks.contains { !$0.done }

        func dismiss() {
            ritualDismissedDay = today
            UserDefaults.standard.set(today, forKey: "kairo.ritualDismissed")
        }

        if hour < 11 && blocks.count < 2 {
            return AnyView(ritualCard(
                emoji: "🌤", tint: Color.kCatButter, ink: Color.kCatButterInk,
                title: "Ease into today", body: "A light day so far. Want a ready-made block to start from?",
                actionLabel: "Browse templates", action: { showTemplates = true }, dismiss: dismiss))
        }
        if hour >= 19 && unfinished {
            return AnyView(ritualCard(
                emoji: "🌙", tint: Color.kCatLilac, ink: Color.kCatLilacInk,
                title: "Close the day gently", body: "A few things are still open. No pressure — just decide what they become.",
                actionLabel: "Review today", action: { showReview = true }, dismiss: dismiss))
        }
        return nil
    }

    private func ritualCard(emoji: String, tint: Color, ink: Color, title: String, body: String,
                            actionLabel: String, action: @escaping () -> Void, dismiss: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Text(emoji).font(.system(size: 22))
                .frame(width: 34, height: 34)
                .background(RoundedRectangle(cornerRadius: 10).fill(tint))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.kBody(13.5, weight: .bold)).foregroundStyle(Color.kInk)
                Text(body).font(.kBody(12)).foregroundStyle(Color.kInkSoft)
            }
            Spacer(minLength: 4)
            Button(action: action) {
                Text(actionLabel).font(.kBody(12.5, weight: .bold)).foregroundStyle(ink)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(Capsule().fill(tint))
            }
            Button(action: dismiss) {
                Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.kInkFaint)
            }
            .accessibilityLabel("Dismiss for today")
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1)))
    }

    /// Peak-focus nudge (R4) — shown only today, inside the personal peak
    /// window, once per day. Fed by the stats focus-hours data.
    private var peakNudge: AnyView? {
        guard dayOffset == 0,
              !mutationsLocked,
              let peak = peakHour
        else {
            return nil
        }
        let today = KTime.dateString(Date(), zone: .current)
        guard peakDismissedDay != today else { return nil }
        let nowHour = Calendar.current.component(.hour, from: Date())
        guard Insights.isInPeakWindow(nowHour: nowHour, peakHour: peak) else { return nil }
        let isNow = nowHour == peak
        return AnyView(
            HStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kIris)
                    .frame(width: 34, height: 34)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.kIrisSoft))
                VStack(alignment: .leading, spacing: 1) {
                    Text(isNow ? "This is usually your sharpest hour"
                               : "Your focus peaks around \(Insights.hourLabel(peak))")
                        .font(.kBody(13.5, weight: .bold)).foregroundStyle(Color.kInk)
                    Text("Protect it with one focus block?")
                        .font(.kBody(12)).foregroundStyle(Color.kInkSoft)
                }
                Spacer(minLength: 4)
                Button {
                    NotificationCenter.default.post(name: .kairoStartFocus, object: nil,
                        userInfo: ["title": "Deep work", "emoji": "🧠", "duration": 45])
                } label: {
                    Text("Focus").font(.kBody(13, weight: .bold)).foregroundStyle(Color.kInkInverse)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Capsule().fill(Color.kIris))
                }
                Button {
                    peakDismissedDay = today
                    UserDefaults.standard.set(today, forKey: "kairo.peakNudgeDismissed")
                } label: {
                    Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                }
                .accessibilityLabel("Dismiss for today")
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color.kIrisGhost)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kIris.opacity(0.3), lineWidth: 1)))
        )
    }

    /// Earliest not-done block still ahead of now (today only).
    private var upNext: DayBlock? {
        blocks
            .filter { !$0.done && $0.endMin > nowMin && $0.startMin > nowMin }
            .min { $0.startMin < $1.startMin }
    }

    private func upNextMeta(_ block: DayBlock) -> String {
        let inMin = block.startMin - nowMin
        return inMin <= 90 ? "in \(inMin) min" : "at \(KTime.hhmm(block.startMin))"
    }

    /// Low-battery chip + softened note — device-local, today only.
    private var lowBatteryRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                lowBattery.toggle()
                LowBatteryDay.set(date, on: lowBattery)
                UISelectionFeedbackGenerator().selectionChanged()
            } label: {
                Label(lowBattery ? "Low-battery day" : "Low battery?",
                      systemImage: "battery.25percent")
                    .font(.kBody(13, weight: .semibold))
                    .foregroundStyle(lowBattery ? Color.kCatButterInk : Color.kInkSoft)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(
                        Capsule().fill(lowBattery ? Color.kCatButter : Color.kSurface)
                            .overlay(Capsule().stroke(
                                lowBattery ? Color.kCatButterInk.opacity(0.3) : Color.kBorder,
                                lineWidth: 1))
                    )
            }
            .accessibilityLabel("Low-battery day")
            .accessibilityValue(lowBattery ? "on" : "off")
            .accessibilityHint("Dims heavy activities and suggests lighter ones")
            if lowBattery {
                Text("Low-battery day — heavy things are dimmed. Doing less on purpose still counts as a plan.")
                    .font(.kBody(12.5, weight: .medium))
                    .foregroundStyle(Color.kInkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var header: some View {
        HStack(spacing: 10) {
            if !blocks.isEmpty {
                ProgressRing(fraction: Double(doneCount) / Double(blocks.count))
                    .frame(width: 34, height: 34)
                    .accessibilityLabel("Day progress")
                    .accessibilityValue("\(doneCount) of \(blocks.count) done")
                VStack(alignment: .leading, spacing: 1) {
                    Text(doneCount == blocks.count ? "Day done!" : "\(doneCount) of \(blocks.count) done")
                        .font(.kBody(13, weight: .semibold))
                        .foregroundStyle(doneCount == blocks.count ? Color.kSuccess : Color.kInk)
                    Text(loadHint)
                        .font(.kBody(11, weight: .medium))
                        .foregroundStyle(Color.kInkSoft)
                }
            }
            Spacer()
            if dayOffset == 0, let next = upNext {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("UP NEXT")
                        .font(.kBody(9.5, weight: .bold))
                        .kerning(1.1)
                        .foregroundStyle(Color.kIris)
                    Text("\(next.emoji) \(next.title)")
                        .font(.kBody(12.5, weight: .semibold))
                        .foregroundStyle(Color.kInk)
                        .lineLimit(1)
                    Text(upNextMeta(next))
                        .font(.kMono(10.5, weight: .medium))
                        .foregroundStyle(Color.kInkSoft)
                }
            }
        }
        .padding(14)
        .kCard(radius: 18)
    }

    private var loadHint: String {
        let planned = blocks.reduce(0) { $0 + $1.durationMin }
        let hours = Double(planned) / 60
        let label = hours < 6.4 ? "a light day" : hours <= 11.2 ? "a comfortable day" : "a lot for one day"
        return String(format: "%.1f h planned · %@", hours, label)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Text("✨").font(.system(size: 44))
            Text("Your day is clear")
                .font(.kDisplay(22))
                .foregroundStyle(Color.kInk)
            Text(
                loadError
                    ?? (usingCachedDay
                        ? "This saved day has no scheduled activities."
                        : "Nothing scheduled yet. Add your first activity and watch it take shape.")
            )
                .font(.kBody(14.5))
                .foregroundStyle(Color.kInkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            if !mutationsLocked {
                Button {
                    editorStart = 9 * 60
                    showEditor = true
                } label: {
                    Label("Add activity", systemImage: "plus")
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(Color.kInkInverse)
                        .padding(.horizontal, 22).padding(.vertical, 13)
                        .background(Capsule().fill(Color.kIris))
                }
                .kFloatShadow()
            }
        }
    }

    private var cachedNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(
                systemName:
                    durablePendingOccurrences.isEmpty
                        ? "lock.doc"
                        : "checkmark.icloud"
            )
                .font(.system(size: 14, weight: .semibold))
            VStack(alignment: .leading, spacing: 2) {
                Text(
                    noticeMode == .dayUnavailable
                        ? "Day unavailable"
                        : noticeMode == .savedDay
                        ? "Saved day"
                        : "Saved on this iPhone"
                )
                    .font(.kBody(13, weight: .bold))
                Text(
                    noticeMode == .dayUnavailable
                        ? "Reconnect to load this day."
                        : cachedMutationFailure == .enqueue
                        ? "Couldn’t save that change. Try again when your connection returns."
                        : cachedMutationFailure == .cachePersistence
                            ? "Your protected change is waiting to sync, but this saved-day view could not update."
                        : durablePendingOccurrences.isEmpty
                            ? "You can complete activities here. Other changes need a connection."
                            : "Your change is protected and will sync automatically."
                )
                .font(.kBody(12))
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.kCatButterInk)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.kCatButter)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            noticeMode == .dayUnavailable
                ? "Day unavailable. Reconnect to load this day."
                : cachedMutationFailure == .enqueue
                ? "Saved day. Change not saved. Try again when your connection returns."
                : cachedMutationFailure == .cachePersistence
                    ? "Saved on this iPhone. Protected change pending sync. Saved day view could not update."
                    : durablePendingOccurrences.isEmpty
                        ? "Saved day. Completion is available. Other changes need a connection."
                        : "Saved on this iPhone. Change pending sync."
        )
    }

    private var durablePendingOccurrences:
        Set<OfflineTodayOccurrenceIdentity>
    {
        CachedDayAdapter.visiblePendingOccurrences(
            app.pendingActivityStatuses,
            inFlight: [],
            blocks: blocks
        )
    }

    private var visibleSubmittingOccurrences:
        Set<OfflineTodayOccurrenceIdentity>
    {
        CachedDayAdapter.visiblePendingOccurrences(
            [],
            inFlight: submittingOccurrences,
            blocks: blocks
        )
    }

    private var disabledOccurrences:
        Set<OfflineTodayOccurrenceIdentity>
    {
        durablePendingOccurrences.union(visibleSubmittingOccurrences)
    }

    private var noticeMode: TodayLoadPolicy.NoticeMode {
        TodayLoadPolicy.noticeMode(
            mutationsLocked: mutationsLocked,
            usingCachedDay: usingCachedDay,
            hasDurableVisiblePending:
                !durablePendingOccurrences.isEmpty,
            hasSubmittingVisible:
                !visibleSubmittingOccurrences.isEmpty
        )
    }

    private var fab: some View {
        Button {
            editorStart = min(1380, ((KTime.nowMinutes(in: app.timezone) + 30 + 14) / 15) * 15)
            showEditor = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Color.kInkInverse)
                .frame(width: 58, height: 58)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.kIris))
        }
        .kFloatShadow()
        .padding(.trailing, 20)
        .padding(.bottom, 16)
        .accessibilityLabel("New activity")
    }

    // MARK: Data

    private func load() async {
#if DEBUG
        // Deterministic tour fixture: a normal (mutable) Today with mixed
        // energies so the low-battery surfaces can be proven without a server.
        if ProcessInfo.processInfo.arguments.contains("-kairoTodayFixture") {
            // Pin the zone: bootstrap ordering must not shift the date key
            // (an early load in UTC lands on a different calendar day).
            let zone = TimeZone(identifier: "America/New_York") ?? .current
            let dateStr = KTime.dateString(viewedDate, zone: zone)
            date = dateStr
            nowMin = dayOffset == 0 ? KTime.nowMinutes(in: zone) : -1
            lowBattery = LowBatteryDay.isOn(dateStr)
            // Reruns of the tour always start with a visible brief.
            UserDefaults.standard.removeObject(forKey: "kairo.briefDismissed")
            briefDismissedDay = ""
            blocks = [
                DayBlock(
                    id: "fixture-deep-work", title: "Deep work block", emoji: "🧠",
                    startMin: 9 * 60, durationMin: 90, category: .lilac,
                    done: false, recurring: false, revision: 1,
                    occurrenceKey: nil, checklist: [], energy: .high),
                DayBlock(
                    id: "fixture-walk", title: "Slow walk", emoji: "🌤",
                    startMin: 11 * 60, durationMin: 30, category: .mint,
                    done: false, recurring: false, revision: 1,
                    occurrenceKey: nil, checklist: [], energy: .low),
                DayBlock(
                    id: "fixture-email", title: "Email sweep", emoji: "📮",
                    startMin: 13 * 60, durationMin: 45, category: .sky,
                    done: false, recurring: false, revision: 1,
                    occurrenceKey: nil, checklist: [], energy: nil),
            ]
            loading = false
            return
        }
#endif
        guard let requestedScope = app.sessionScope else {
            loading = false
            return
        }
        let requestedOffset = dayOffset
        let dateStr = KTime.dateString(viewedDate, zone: app.timezone)
        let loadID = UUID()
        latestLoadID = loadID
        loading = true
        nowMin = requestedOffset == 0
            ? KTime.nowMinutes(in: app.timezone)
            : -1
        date = dateStr
        lowBattery = LowBatteryDay.isOn(dateStr)
        do {
            let day = try await KairoAPI.shared.day(dateStr)
            guard
                latestLoadID == loadID,
                dayOffset == requestedOffset,
                TodayLoadPolicy.isCurrentScope(
                    requested: requestedScope,
                    current: app.sessionScope
                )
            else {
                return
            }
            guard TodayLoadPolicy.shouldApply(
                responseDate: day.date,
                requestedDate: dateStr
            ) else {
                let mismatch =
                    TodayLoadPolicy.responseDateMismatchState()
                blocks = mismatch.blocks
                usingCachedDay = mismatch.usingCachedDay
                mutationsLocked = mismatch.mutationsLocked
                loadError = "This day could not be verified. Try again."
                loading = mismatch.loading
                app.offlineReadOnly = true
                return
            }
            let zone = TimeZone(identifier: day.zone) ?? app.timezone
            let serverBlocks = day.activities
                .map { $0.block(in: zone, category: app.category(for: $0.categoryId)) }
                .sorted { $0.startMin < $1.startMin }
            blocks = CachedDayAdapter.overlayPendingStatuses(
                app.pendingActivityStatuses,
                on: serverBlocks
            )
            loadError = nil
            usingCachedDay = false
            mutationsLocked = false
            cachedMutationFailure = nil
            app.offlineReadOnly = false
            if requestedOffset == 0 {
                guard
                    latestLoadID == loadID,
                    TodayLoadPolicy.isCurrentScope(
                        requested: requestedScope,
                        current: app.sessionScope
                    ),
                    await KairoAPI.shared.sessionScope() == requestedScope
                else {
                    return
                }
                DayCache.write(
                    scope: requestedScope,
                    date: day.date,
                    zone: day.zone,
                    blocks: blocks.map {
                        CachedBlock(title: $0.title, emoji: $0.emoji, startMin: $0.startMin,
                                    durationMin: $0.durationMin, done: $0.done,
                                    category: $0.category.rawValue,
                                    activityId: $0.id, revision: $0.revision,
                                    occurrenceKey: $0.occurrenceKey)
                    },
                    hourCycle: KairoPrefs.hourCycle
                )
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch {
            guard
                latestLoadID == loadID,
                dayOffset == requestedOffset,
                TodayLoadPolicy.isCurrentScope(
                    requested: requestedScope,
                    current: app.sessionScope
                )
            else {
                return
            }
            if let cached = DayCache.read(
                   scope: requestedScope,
                   date: dateStr
               )
            {
                let cachedBlocks = CachedDayAdapter.overlayPendingStatuses(
                    app.pendingActivityStatuses,
                    on: CachedDayAdapter.blocks(from: cached)
                )
                let failure = TodayLoadPolicy.failureState(
                    cachedBlocks: cachedBlocks
                )
                blocks = failure.blocks
                loadError = nil
                usingCachedDay = failure.usingCachedDay
                mutationsLocked = failure.mutationsLocked
                app.offlineReadOnly = true
            } else {
                let failure = TodayLoadPolicy.failureState(
                    cachedBlocks: nil
                )
                blocks = failure.blocks
                loadError = (error as? APIError)?.errorDescription
                    ?? "This day isn’t available offline."
                usingCachedDay = failure.usingCachedDay
                mutationsLocked = failure.mutationsLocked
                app.offlineReadOnly = true
            }
        }
        guard TodayLoadPolicy.isCurrentScope(
            requested: requestedScope,
            current: app.sessionScope
        ) else {
            return
        }
        loading = false
        if requestedOffset == 0, !mutationsLocked {
            await loadPeak(scope: requestedScope)
            guard TodayLoadPolicy.isCurrentScope(
                requested: requestedScope,
                current: app.sessionScope
            ) else {
                return
            }
            await NotificationManager.reschedule(blocks: blocks, zone: app.timezone)
        }
    }

    /// Pull the peak-focus hour from stats (only worth showing today).
    private func loadPeak(scope: String) async {
        peakDismissedDay = UserDefaults.standard.string(forKey: "kairo.peakNudgeDismissed") ?? ""
        ritualDismissedDay = UserDefaults.standard.string(forKey: "kairo.ritualDismissed") ?? ""
        briefDismissedDay = UserDefaults.standard.string(forKey: "kairo.briefDismissed") ?? ""
        let stats = try? await KairoAPI.shared.stats()
        guard TodayLoadPolicy.isCurrentScope(
            requested: scope,
            current: app.sessionScope
        ) else {
            return
        }
        guard let stats,
              let hours = stats.focusHours,
              Insights.focusSessionCount(hours.hours) >= Insights.peakMinSessions else {
            peakHour = nil
            return
        }
        peakHour = hours.peakHour
    }

    private func move(_ block: DayBlock, to newStartMin: Int) async {
        do {
            _ = try await KairoAPI.shared.moveActivity(
                activityId: block.id,
                revision: block.revision,
                occurrenceKey: block.occurrenceKey,
                startAt: KTime.instant(date: date, minutes: newStartMin, zone: app.timezone)
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {}
        await load()
    }

    private func remove(_ block: DayBlock) async {
        do {
            try await KairoAPI.shared.deleteActivity(activityId: block.id, revision: block.revision)
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            await load()
        } catch {
            await load()
        }
    }

    private func toggle(_ block: DayBlock) async {
        let newDone = !block.done
        if mutationsLocked {
            await toggleCached(block, done: newDone)
            return
        }
        if newDone {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        do {
            _ = try await KairoAPI.shared.setStatus(
                activityId: block.id,
                revision: block.revision,
                occurrenceKey: block.occurrenceKey,
                status: newDone ? .completed : .pending,
                completedAt: newDone ? ISO8601DateFormatter().string(from: Date()) : nil
            )
            await load()
        } catch {
            await load()
        }
    }

    private func toggleCached(
        _ block: DayBlock,
        done: Bool
    ) async {
        guard
            let scope = app.sessionScope,
            let occurrenceKey = block.occurrenceKey,
            OfflineTodayMutationPolicy.cachedDay
                .allowsCompletion(for: block)
        else {
            return
        }
        cachedMutationFailure = nil
        let identity = OfflineTodayOccurrenceIdentity(
            activityID: block.id,
            occurrenceKey: occurrenceKey
        )
        guard
            let identity,
            OfflineTodayMutationPolicy.cachedDay.canBegin(
                identity,
                pending: disabledOccurrences
            )
        else {
            return
        }
        let capturedLoadID = latestLoadID
        let capturedDate = date
        let capturedOffset = dayOffset
        func renderDisposition()
            -> TodayLoadPolicy.MutationRenderDisposition
        {
            TodayLoadPolicy.mutationRenderDisposition(
                capturedLoadID: capturedLoadID,
                currentLoadID: latestLoadID,
                capturedDate: capturedDate,
                currentDate: date,
                capturedOffset: capturedOffset,
                currentOffset: dayOffset
            )
        }
        let optimisticBlocks: [DayBlock]
        do {
            optimisticBlocks = try CachedDayAdapter.settingCompletion(
                done,
                for: block,
                in: blocks
            )
        } catch {
            return
        }
        submittingOccurrences.insert(identity)
        let mutation = OfflineTodayStatusMutation(
            enqueue: { activityID, status, occurredAt, key in
                _ = try await app.enqueueActivityStatus(
                    activityID: activityID,
                    status: status,
                    occurredAt: occurredAt,
                    occurrenceKey: key,
                    scope: scope
                )
            },
            persist: { scope, date, activityID, key, done in
                _ = try DayCache.updateStatus(
                    scope: scope,
                    date: date,
                    activityID: activityID,
                    occurrenceKey: key,
                    done: done
                )
            }
        )

        do {
            try await mutation.perform(
                scope: scope,
                date: capturedDate,
                block: block,
                done: done
            ) { renderedDone in
                guard app.sessionScope == scope else {
                    return
                }
                submittingOccurrences.remove(identity)
                let disposition = renderDisposition()
                guard disposition != .differentVisibleDay else {
                    return
                }
                if disposition == .exactLoad,
                   renderedDone == done
                {
                    blocks = optimisticBlocks
                } else {
                    blocks = (try? CachedDayAdapter.settingCompletion(
                        renderedDone,
                        for: block,
                        in: blocks
                    )) ?? blocks
                }
            }
            if app.sessionScope == scope,
               done,
               renderDisposition() != .differentVisibleDay
            {
                UINotificationFeedbackGenerator()
                    .notificationOccurred(.success)
            }
            if app.sessionScope == scope {
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch let failure as OfflineTodayStatusMutation.Failure {
            if app.sessionScope == scope,
               renderDisposition() != .differentVisibleDay
            {
                cachedMutationFailure = failure.stage
            }
            if app.sessionScope == scope,
               failure.stage == .enqueue
            {
                submittingOccurrences.remove(identity)
            }
        } catch {
            if app.sessionScope == scope,
               renderDisposition() != .differentVisibleDay
            {
                cachedMutationFailure = .enqueue
                submittingOccurrences.remove(identity)
            }
        }
    }
}

// MARK: - Progress ring

struct ProgressRing: View {
    var fraction: Double

    var body: some View {
        ZStack {
            Circle().stroke(Color.kBorder, lineWidth: 5)
            Circle()
                .trim(from: 0, to: max(0.001, fraction))
                .stroke(fraction >= 1 ? Color.kSuccess : Color.kIris,
                        style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.6, dampingFraction: 0.9), value: fraction)
        }
    }
}

// MARK: - Timeline canvas

struct TimelineCanvas: View {
    let blocks: [DayBlock]
    let nowMin: Int
    let readOnly: Bool
    var lowBattery: Bool = false
    let onComplete: (DayBlock) -> Void
    let onDelete: (DayBlock) -> Void
    let onFocus: (DayBlock) -> Void
    let onOpen: (DayBlock) -> Void
    let onMove: (DayBlock, Int) -> Void
    let pendingOccurrences: Set<OfflineTodayOccurrenceIdentity>

    private let ptPerMin: CGFloat = 1.7

    static func hourMark(
        for minutes: Int,
        hourCycle: String? = nil
    ) -> String {
        KTime.hourLabel(minutes / 60, hourCycle: hourCycle)
    }

    private var dayStart: Int {
        min(7 * 60, blocks.map { ($0.startMin / 60) * 60 }.min() ?? 7 * 60)
    }

    private var dayEnd: Int {
        max(23 * 60, blocks.map { Int(ceil(Double($0.endMin) / 60) * 60) }.max() ?? 23 * 60)
    }

    private func y(_ minutes: Int) -> CGFloat {
        CGFloat(minutes - dayStart) * ptPerMin
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Hour rules
            ForEach(Array(stride(from: dayStart, through: dayEnd, by: 60)), id: \.self) { h in
                HStack(alignment: .top, spacing: 10) {
                    Text(Self.hourMark(for: h))
                        .font(.kMono(11, weight: .medium))
                        .foregroundStyle(Color.kInkFaint)
                        .frame(width: 40, alignment: .trailing)
                        .offset(y: -6)
                    Rectangle().fill(Color.kBorder).frame(height: 1)
                }
                .offset(y: y(h))
            }

            // Now line
            if nowMin >= dayStart && nowMin <= dayEnd {
                HStack(spacing: 6) {
                    Text(KTime.hhmm(nowMin))
                        .font(.kMono(10, weight: .bold))
                        .foregroundStyle(Color.kNowInk)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 5).fill(Color.kNow))
                    Circle().fill(Color.kNow).frame(width: 7, height: 7)
                    Rectangle().fill(Color.kNow).frame(height: 2)
                }
                .offset(y: y(nowMin) - 8)
                .id("now-line")
                .accessibilityHidden(true)
                .zIndex(2)
            }

            // Blocks
            ForEach(blocks) { block in
                BlockCard(
                    block: block,
                    nowMin: nowMin,
                    readOnly: readOnly,
                    lowBattery: lowBattery,
                    onComplete: { onComplete(block) },
                    onDelete: { onDelete(block) },
                    onFocus: { onFocus(block) },
                    onOpen: { onOpen(block) },
                    onMove: { delta in
                        let snapped = ((block.startMin + delta + 7) / 15) * 15
                        let clamped = max(0, min(23 * 60 + 45 - block.durationMin, snapped))
                        if clamped != block.startMin { onMove(block, clamped) }
                    },
                    pending:
                        OfflineTodayOccurrenceIdentity(block: block)
                            .map { pendingOccurrences.contains($0) }
                            ?? false
                )
                    .frame(height: max(34, CGFloat(block.durationMin) * ptPerMin))
                    .padding(.leading, 52)
                    .offset(y: y(block.startMin))
            }
        }
        .frame(height: y(dayEnd) + 40, alignment: .top)
    }
}

// MARK: - Activity block card

struct BlockCard: View {
    let block: DayBlock
    let nowMin: Int
    let readOnly: Bool
    var lowBattery: Bool = false
    let onComplete: () -> Void
    let onDelete: () -> Void
    let onFocus: () -> Void
    let onOpen: () -> Void
    /// Called with the dragged minute delta (positive = later).
    let onMove: (Int) -> Void
    let pending: Bool

    @State private var dragOffset: CGFloat = 0
    @State private var lifting = false

    private var isPast: Bool { block.endMin <= nowMin && !block.done }
    private var isCurrent: Bool { block.startMin <= nowMin && nowMin < block.endMin && !block.done }
    private var compact: Bool { CGFloat(block.durationMin) * 1.7 < 66 }
    private var heavy: Bool {
        LowBatteryDay.isHeavy(energy: block.energy, done: block.done, lowBattery: lowBattery)
    }

    /// Checklist lines only when the block is tall enough to hold them.
    private var stepRows: Int {
        guard !compact, !block.checklist.isEmpty else { return 0 }
        let h = CGFloat(block.durationMin) * 1.7
        return max(0, min(3, Int((h - 64) / 16)))
    }

    private var stepsSuffix: String {
        guard !block.checklist.isEmpty else { return "" }
        return " · \(block.checklist.filter(\.done).count)/\(block.checklist.count) steps"
    }

    private var fullMetadata: String {
        "\(KTime.hhmm(block.startMin)) – \(KTime.hhmm(block.endMin)) · \(KTime.duration(block.durationMin))\(stepsSuffix)"
    }

    private var compactMetadata: String {
        "\(KTime.hhmm(block.startMin)) – \(KTime.hhmm(block.endMin))"
    }

    var body: some View {
        HStack(spacing: 10) {
            Text(block.emoji)
                .font(.system(size: compact ? 16 : 19))
                .frame(width: compact ? 30 : 38, height: compact ? 30 : 38)
                .background(Circle().fill(Color.kSurfaceRaised.opacity(0.8)))

            VStack(alignment: .leading, spacing: 1) {
                Text(block.title)
                    .font(.kBody(compact ? 14 : 15, weight: .semibold))
                    .strikethrough(block.done)
                    .lineLimit(1)
                HStack(spacing: 3) {
                    if block.recurring {
                        Image(systemName: "repeat").font(.system(size: 9, weight: .bold))
                    }
                    ViewThatFits(in: .horizontal) {
                        Text(fullMetadata)
                            .fixedSize(horizontal: true, vertical: false)
                        Text(compactMetadata)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    .font(.kMono(11, weight: .medium))
                    if heavy {
                        Text("heavy")
                            .font(.kBody(9.5, weight: .bold))
                            .padding(.horizontal, 5).padding(.vertical, 1.5)
                            .background(Capsule().fill(Color.kSurfaceRaised.opacity(0.85)))
                            .accessibilityLabel("Heavy for a low-battery day")
                    }
                }
                .lineLimit(1)
                if stepRows > 0 {
                    VStack(alignment: .leading, spacing: 1) {
                        ForEach(Array(block.checklist.prefix(stepRows)).indices, id: \.self) { i in
                            let step = block.checklist[i]
                            Text("\(step.done ? "✓" : "○") \(step.label)")
                                .font(.kBody(11, weight: .medium))
                                .strikethrough(step.done)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .foregroundStyle(block.category.ink)

            Spacer(minLength: 4)

            if !readOnly
                || OfflineTodayMutationPolicy.cachedDay
                    .allowsCompletion(for: block)
            {
                Button(action: onComplete) {
                    ZStack {
                        Circle()
                            .fill(block.done ? Color.kSuccess : Color.clear)
                            .overlay(
                                Circle().stroke(
                                    block.done ? Color.clear : block.category.ink.opacity(0.5),
                                    lineWidth: 2
                                )
                            )
                        if block.done {
                            Image(systemName: "checkmark")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.kInkInverse)
                        }
                    }
                    .frame(
                        width: compact ? 26 : 30,
                        height: compact ? 26 : 30
                    )
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                }
                .accessibilityLabel(
                    block.done
                        ? "Mark \(block.title) not done"
                        : "Complete \(block.title)"
                )
                .disabled(pending)
                .opacity(pending ? 0.65 : 1)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, compact ? 5 : 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: compact ? .center : .top)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    block.category.fill.opacity(
                        block.done ? 0.82 : isPast ? 0.72 : 1
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isCurrent ? Color.kNow : Color.clear, lineWidth: 2)
        )
        .saturation(isPast ? 0.5 : 1)
        .compositingGroup()
        .opacity(heavy ? 0.55 : 1)
        .kCardShadow()
        .offset(y: dragOffset)
        .scaleEffect(lifting ? 1.03 : 1)
        .zIndex(lifting ? 10 : 0)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: lifting)
        .onTapGesture {
            guard !readOnly else { return }
            onOpen()
        }
        .gesture(
            LongPressGesture(minimumDuration: 0.35)
                .onEnded { _ in
                    guard !readOnly else { return }
                    lifting = true
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                }
                .sequenced(before: DragGesture())
                .onChanged { value in
                    guard !readOnly else { return }
                    if case .second(true, let drag?) = value {
                        dragOffset = drag.translation.height
                    }
                }
                .onEnded { value in
                    guard !readOnly else { return }
                    if case .second(true, let drag?) = value {
                        let deltaMin = Int((drag.translation.height / 1.7).rounded())
                        onMove(deltaMin)
                    }
                    dragOffset = 0
                    lifting = false
                }
        )
        .modifier(
            BlockAccessibilityModifier(
                block: block,
                readOnly: readOnly,
                allowsCompletion:
                    !readOnly
                        || OfflineTodayMutationPolicy.cachedDay
                            .allowsCompletion(for: block),
                pending: pending,
                heavy: heavy,
                onComplete: onComplete,
                onFocus: onFocus,
                onDelete: onDelete,
                onOpen: onOpen
            )
        )
    }
}

private struct BlockAccessibilityModifier: ViewModifier {
    let block: DayBlock
    let readOnly: Bool
    let allowsCompletion: Bool
    let pending: Bool
    var heavy: Bool = false
    let onComplete: () -> Void
    let onFocus: () -> Void
    let onDelete: () -> Void
    let onOpen: () -> Void

    @ViewBuilder
    func body(content: Content) -> some View {
        let labelled = content
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                "\(block.title), \(KTime.hhmm(block.startMin)) to \(KTime.hhmm(block.endMin)), \(block.category.rawValue), \(block.done ? "done" : "not done")\(heavy ? ", heavy for a low-battery day" : "")"
            )
        if readOnly {
            if allowsCompletion {
                if pending {
                    labelled.accessibilityHint(
                        "Saved on this iPhone and waiting to sync. Completion is temporarily unavailable."
                    )
                } else {
                    labelled
                        .accessibilityAddTraits(.isButton)
                        .accessibilityHint(
                            "Double tap to change completion. Other changes need a connection."
                        )
                        .accessibilityAction {
                            onComplete()
                        }
                        .accessibilityAction(
                            named:
                                block.done
                                    ? "Mark not done"
                                    : "Complete"
                        ) {
                            onComplete()
                        }
                }
            } else {
                labelled.accessibilityHint(
                    "Saved activity. Completion is unavailable because this occurrence cannot be identified safely."
                )
            }
        } else {
            let interactive = labelled
                .accessibilityAddTraits(.isButton)
                .accessibilityHint(
                    pending
                        ? "Double tap to edit. Completion is saved on this iPhone and temporarily unavailable."
                        : "Double tap to edit"
                )
                .accessibilityAction {
                    onOpen()
                }
                .accessibilityAction(named: "Focus on this") {
                    onFocus()
                }
                .accessibilityAction(named: "Delete") {
                    onDelete()
                }
            if TodayBlockActionPolicy.canExposeCompletionAction(
                readOnly: false,
                pending: pending,
                offlineCompletionEligible: allowsCompletion
            ) {
                interactive.accessibilityAction(
                    named:
                        block.done
                            ? "Mark not done"
                            : "Complete"
                ) {
                    onComplete()
                }
            } else {
                interactive
            }
        }
    }
}
