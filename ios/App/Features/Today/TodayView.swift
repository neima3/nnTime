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
    @State private var editorStart = 9 * 60
    @State private var loadError: String?
    /// 0 = today, ±n days.
    @State private var dayOffset = 0

    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Color.kCanvas.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.kIris)
                } else if blocks.isEmpty {
                    emptyState
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            header
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                            TimelineCanvas(
                                blocks: blocks,
                                nowMin: nowMin,
                                onComplete: { block in Task { await toggle(block) } },
                                onDelete: { block in Task { await remove(block) } },
                                onFocus: { block in
                                    NotificationCenter.default.post(
                                        name: .kairoStartFocus,
                                        object: nil,
                                        userInfo: ["title": block.title, "emoji": block.emoji, "duration": block.durationMin]
                                    )
                                },
                                onOpen: { block in editingBlock = block },
                                onMove: { block, newStart in Task { await move(block, to: newStart) } }
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

                fab
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dayOffset -= 1
                        Task { await load() }
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.kInkSoft)
                    }
                    .accessibilityLabel("Previous day")
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
                        if dayOffset == 0 && blocks.contains(where: { !$0.done }) {
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
                PickForMeSheet(blocks: blocks, nowMin: nowMin)
            }
            .refreshable { await load() }
        }
        .task { await load() }
        .onReceive(tick) { _ in nowMin = KTime.nowMinutes(in: app.timezone) }
        .onReceive(NotificationCenter.default.publisher(for: .kairoDayChanged)) { _ in
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
            Text(loadError ?? "Nothing scheduled yet. Add your first activity and watch it take shape.")
                .font(.kBody(14.5))
                .foregroundStyle(Color.kInkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
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
        nowMin = dayOffset == 0 ? KTime.nowMinutes(in: app.timezone) : -1
        let dateStr = KTime.dateString(viewedDate, zone: app.timezone)
        date = dateStr
        do {
            let day = try await KairoAPI.shared.day(dateStr)
            let zone = TimeZone(identifier: day.zone) ?? app.timezone
            blocks = day.activities
                .map { $0.block(in: zone, category: app.category(for: $0.categoryId)) }
                .sorted { $0.startMin < $1.startMin }
            loadError = nil
            if dayOffset == 0 {
                DayCache.write(
                    date: day.date,
                    zone: day.zone,
                    blocks: blocks.map {
                        CachedBlock(title: $0.title, emoji: $0.emoji, startMin: $0.startMin,
                                    durationMin: $0.durationMin, done: $0.done,
                                    category: $0.category.rawValue,
                                    activityId: $0.id, revision: $0.revision,
                                    occurrenceKey: $0.occurrenceKey)
                    }
                )
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch {
            loadError = (error as? APIError)?.errorDescription
        }
        loading = false
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
        if newDone {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        do {
            _ = try await KairoAPI.shared.setStatus(
                activityId: block.id,
                revision: block.revision,
                occurrenceKey: block.occurrenceKey,
                status: newDone ? "completed" : "pending",
                completedAt: newDone ? ISO8601DateFormatter().string(from: Date()) : nil
            )
            await load()
        } catch {
            await load()
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
    let onComplete: (DayBlock) -> Void
    let onDelete: (DayBlock) -> Void
    let onFocus: (DayBlock) -> Void
    let onOpen: (DayBlock) -> Void
    let onMove: (DayBlock, Int) -> Void

    private let ptPerMin: CGFloat = 1.7

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
                    Text("\(h / 60):00")
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
                    onComplete: { onComplete(block) },
                    onDelete: { onDelete(block) },
                    onFocus: { onFocus(block) },
                    onOpen: { onOpen(block) },
                    onMove: { delta in
                        let snapped = ((block.startMin + delta + 7) / 15) * 15
                        let clamped = max(0, min(23 * 60 + 45 - block.durationMin, snapped))
                        if clamped != block.startMin { onMove(block, clamped) }
                    }
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
    let onComplete: () -> Void
    let onDelete: () -> Void
    let onFocus: () -> Void
    let onOpen: () -> Void
    /// Called with the dragged minute delta (positive = later).
    let onMove: (Int) -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var lifting = false

    private var isPast: Bool { block.endMin <= nowMin && !block.done }
    private var isCurrent: Bool { block.startMin <= nowMin && nowMin < block.endMin && !block.done }
    private var compact: Bool { CGFloat(block.durationMin) * 1.7 < 66 }

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
                    Text("\(KTime.hhmm(block.startMin)) – \(KTime.hhmm(block.endMin)) · \(KTime.duration(block.durationMin))\(stepsSuffix)")
                        .font(.kMono(11, weight: .medium))
                }
                .opacity(0.7)
                .lineLimit(1)
                if stepRows > 0 {
                    VStack(alignment: .leading, spacing: 1) {
                        ForEach(Array(block.checklist.prefix(stepRows)).indices, id: \.self) { i in
                            let step = block.checklist[i]
                            Text("\(step.done ? "✓" : "○") \(step.label)")
                                .font(.kBody(11, weight: .medium))
                                .strikethrough(step.done)
                                .opacity(0.65)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .foregroundStyle(block.category.ink)

            Spacer(minLength: 4)

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
                .frame(width: compact ? 26 : 30, height: compact ? 26 : 30)
            }
            .accessibilityLabel(block.done ? "Mark \(block.title) incomplete" : "Complete \(block.title)")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, compact ? 5 : 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: compact ? .center : .top)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(block.category.fill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isCurrent ? Color.kNow : Color.clear, lineWidth: 2)
        )
        .opacity(block.done ? 0.7 : isPast ? 0.55 : 1)
        .saturation(isPast ? 0.5 : 1)
        .compositingGroup()
        .kCardShadow()
        .offset(y: dragOffset)
        .scaleEffect(lifting ? 1.03 : 1)
        .zIndex(lifting ? 10 : 0)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: lifting)
        .onTapGesture { onOpen() }
        .gesture(
            LongPressGesture(minimumDuration: 0.35)
                .onEnded { _ in
                    lifting = true
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                }
                .sequenced(before: DragGesture())
                .onChanged { value in
                    if case .second(true, let drag?) = value {
                        dragOffset = drag.translation.height
                    }
                }
                .onEnded { value in
                    if case .second(true, let drag?) = value {
                        let deltaMin = Int((drag.translation.height / 1.7).rounded())
                        onMove(deltaMin)
                    }
                    dragOffset = 0
                    lifting = false
                }
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(block.title), \(KTime.hhmm(block.startMin)) to \(KTime.hhmm(block.endMin)), \(block.category.rawValue), \(block.done ? "done" : "not done")")
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Double tap to edit")
        .accessibilityAction(named: block.done ? "Mark incomplete" : "Complete") { onComplete() }
        .accessibilityAction(named: "Focus on this") { onFocus() }
        .accessibilityAction(named: "Delete") { onDelete() }
    }
}
