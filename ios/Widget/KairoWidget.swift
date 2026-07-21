import WidgetKit
import SwiftUI

// MARK: - "Next up" widget (ios-adaptation.md §3, small)
// Renders from the on-device day cache; a timeline entry per block boundary
// keeps the countdown honest without any network.

struct NextUpEntry: TimelineEntry {
    let date: Date
    let block: CachedBlock?
    let isCurrent: Bool
    /// Full day context for the medium strip.
    let blocks: [CachedBlock]
    let nowMin: Int
}

struct NextUpProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextUpEntry {
        let sample = CachedBlock(title: "Morning reset", emoji: "🌤", startMin: 480, durationMin: 30, done: false, category: "butter")
        return NextUpEntry(date: Date(), block: sample, isCurrent: false, blocks: [sample], nowMin: 470)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextUpEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextUpEntry>) -> Void) {
        let now = Date()
        var entries = [entry(at: now)]

        // Re-render at every upcoming block boundary today.
        if let snap = DayCache.read(), let zone = TimeZone(identifier: snap.zone) {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = zone
            let startOfDay = cal.startOfDay(for: now)
            let boundaries = snap.blocks
                .flatMap { [$0.startMin, $0.endMin] }
                .compactMap { cal.date(byAdding: .minute, value: $0, to: startOfDay) }
                .filter { $0 > now }
                .sorted()
                .prefix(12)
            entries.append(contentsOf: boundaries.map { entry(at: $0.addingTimeInterval(1)) })
        }

        // Refresh from the cache at least hourly.
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(3600))))
    }

    private func entry(at date: Date) -> NextUpEntry {
        guard let snap = DayCache.read(), let zone = TimeZone(identifier: snap.zone) else {
            return NextUpEntry(date: date, block: nil, isCurrent: false, blocks: [], nowMin: 0)
        }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let comps = cal.dateComponents([.hour, .minute], from: date)
        let nowMin = (comps.hour ?? 0) * 60 + (comps.minute ?? 0)

        let sorted = snap.blocks.sorted { $0.startMin < $1.startMin }
        if let current = sorted.first(where: { !$0.done && $0.startMin <= nowMin && nowMin < $0.endMin }) {
            return NextUpEntry(date: date, block: current, isCurrent: true, blocks: sorted, nowMin: nowMin)
        }
        let next = sorted
            .filter { !$0.done && $0.startMin > nowMin }
            .min { $0.startMin < $1.startMin }
        return NextUpEntry(date: date, block: next, isCurrent: false, blocks: sorted, nowMin: nowMin)
    }
}

struct NextUpWidgetView: View {
    var entry: NextUpEntry
    @Environment(\.widgetFamily) private var family

    private func fill(_ category: String) -> Color {
        switch category {
        case "peach": Color(red: 1.0, green: 0.851, blue: 0.761)
        case "butter": Color(red: 1.0, green: 0.914, blue: 0.651)
        case "mint": Color(red: 0.784, green: 0.929, blue: 0.839)
        case "lilac": Color(red: 0.886, green: 0.859, blue: 0.984)
        case "rose": Color(red: 0.98, green: 0.835, blue: 0.891)
        default: Color(red: 0.784, green: 0.891, blue: 0.98)
        }
    }

    private func ink(_ category: String) -> Color {
        switch category {
        case "peach": Color(red: 0.639, green: 0.290, blue: 0.110)
        case "butter": Color(red: 0.541, green: 0.412, blue: 0.0)
        case "mint": Color(red: 0.118, green: 0.478, blue: 0.298)
        case "lilac": Color(red: 0.357, green: 0.282, blue: 0.788)
        case "rose": Color(red: 0.690, green: 0.216, blue: 0.412)
        default: Color(red: 0.114, green: 0.416, blue: 0.651)
        }
    }

    var body: some View {
        switch family {
        case .systemMedium: mediumStrip
        case .systemLarge: largeList
        case .accessoryCircular: accessoryCircular
        case .accessoryRectangular: accessoryRectangular
        case .accessoryInline: accessoryInline
        default: smallCard
        }
    }

    // Large: date header + up to 5 upcoming rows + "+n more".
    private var largeList: some View {
        let upcoming = entry.blocks.filter { $0.endMin > entry.nowMin }
        let shown = Array(upcoming.prefix(5))
        let more = upcoming.count - shown.count
        let paper = Color(red: 0.969, green: 0.957, blue: 0.933)
        let inkColor = Color(red: 0.141, green: 0.122, blue: 0.192)
        let softColor = Color(red: 0.435, green: 0.408, blue: 0.514)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("◔").font(.system(size: 15, weight: .bold))
                Text("Today").font(.system(size: 15, weight: .bold, design: .rounded))
                Spacer()
                let done = entry.blocks.filter(\.done).count
                if !entry.blocks.isEmpty {
                    Text("\(done)/\(entry.blocks.count)")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(softColor)
                }
            }
            if shown.isEmpty {
                Spacer()
                Text(entry.blocks.isEmpty ? "Nothing planned — add something kind." : "All done. Go be free. 🎉")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(softColor)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ForEach(Array(shown.enumerated()), id: \.offset) { _, block in
                    let active = block.startMin <= entry.nowMin
                    HStack(spacing: 9) {
                        Text(block.emoji).font(.system(size: 15))
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(fill(block.category)))
                        Text(block.title)
                            .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                            .lineLimit(1)
                        Spacer()
                        Text(String(format: "%d:%02d", block.startMin / 60, block.startMin % 60))
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundStyle(softColor)
                        if active {
                            Circle().fill(Color(red: 1.0, green: 0.361, blue: 0.302)).frame(width: 6, height: 6)
                        }
                    }
                }
                if more > 0 {
                    Text("+\(more) more").font(.system(size: 12, weight: .semibold)).foregroundStyle(softColor)
                }
                Spacer(minLength: 0)
            }
        }
        .foregroundStyle(inkColor)
        .containerBackground(paper, for: .widget)
        .widgetURL(URL(string: "kairo://today"))
    }

    // Lock-screen accessories.
    private var accessoryCircular: some View {
        let done = entry.blocks.filter(\.done).count
        let frac = entry.blocks.isEmpty ? 0 : Double(done) / Double(entry.blocks.count)
        return ZStack {
            AccessoryWidgetBackground()
            Circle().stroke(.tertiary, lineWidth: 4)
            Circle().trim(from: 0, to: max(0.001, frac))
                .stroke(.primary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("◔").font(.system(size: 16, weight: .bold))
        }
        .widgetURL(URL(string: "kairo://today"))
    }

    private var accessoryRectangular: some View {
        HStack(spacing: 6) {
            if let block = entry.block {
                Text(block.emoji)
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.isCurrent ? "Now" : "Up next")
                        .font(.system(size: 11, weight: .bold)).textCase(.uppercase)
                    Text(block.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Text(String(format: "%d:%02d", block.startMin / 60, block.startMin % 60))
                        .font(.system(size: 11, design: .monospaced))
                }
            } else {
                Text("◔ Nothing planned").font(.system(size: 12, weight: .semibold))
            }
        }
        .widgetURL(URL(string: "kairo://today"))
    }

    private var accessoryInline: some View {
        if let block = entry.block {
            Text("◔ \(String(format: "%d:%02d", block.startMin / 60, block.startMin % 60)) \(block.title)")
        } else {
            Text("◔ Nothing planned")
        }
    }

    /// Medium: the day as mini pills with a now-dot between past and future.
    private var mediumStrip: some View {
        let upcoming = entry.blocks.filter { $0.endMin > entry.nowMin }.prefix(4)
        let doneCount = entry.blocks.filter(\.done).count
        let paper = Color(red: 0.969, green: 0.957, blue: 0.933)
        let inkColor = Color(red: 0.141, green: 0.122, blue: 0.192)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("◔").font(.system(size: 13, weight: .bold))
                Text("TODAY")
                    .font(.system(size: 10, weight: .heavy)).kerning(1.2)
                Spacer()
                if !entry.blocks.isEmpty {
                    Text("\(doneCount) of \(entry.blocks.count) · \(entry.blocks.isEmpty ? 0 : doneCount * 100 / entry.blocks.count)%")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .opacity(0.6)
                }
            }
            .opacity(0.75)
            if upcoming.isEmpty {
                Spacer()
                Text(entry.blocks.isEmpty ? "Nothing planned — add something kind." : "All done. Go be free. 🎉")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .opacity(0.7)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                HStack(spacing: 6) {
                    ForEach(Array(upcoming.enumerated()), id: \.offset) { _, block in
                        let active = block.startMin <= entry.nowMin
                        VStack(alignment: .leading, spacing: 2) {
                            Text(block.emoji).font(.system(size: 15))
                            Text(block.title)
                                .font(.system(size: 10.5, weight: .bold, design: .rounded))
                                .lineLimit(1)
                            Text(String(format: "%d:%02d", block.startMin / 60, block.startMin % 60))
                                .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                                .opacity(0.7)
                        }
                        .padding(7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 10).fill(fill(block.category)))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(active ? Color(red: 1.0, green: 0.361, blue: 0.302) : .clear, lineWidth: 1.5)
                        )
                        .foregroundStyle(ink(block.category))
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .foregroundStyle(inkColor)
        .containerBackground(paper, for: .widget)
        .widgetURL(URL(string: "kairo://today"))
    }

    private var smallCard: some View {
        Group {
            if let block = entry.block {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top) {
                        Text(block.emoji)
                            .font(.system(size: 18))
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(.white.opacity(0.65)))
                        Spacer()
                        if let id = block.activityId, let rev = block.revision, !block.done {
                            Button(intent: CompleteActivityIntent(activityId: id, revision: rev, occurrenceKey: block.occurrenceKey)) {
                                Image(systemName: "circle")
                                    .font(.system(size: 20, weight: .semibold))
                                    .foregroundStyle(ink(block.category).opacity(0.55))
                            }
                            .buttonStyle(.plain)
                        } else if entry.isCurrent {
                            Circle()
                                .fill(Color(red: 1.0, green: 0.361, blue: 0.302))
                                .frame(width: 7, height: 7)
                        }
                    }
                    Spacer(minLength: 0)
                    Text(entry.isCurrent ? "NOW" : "UP NEXT")
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.1)
                        .opacity(0.65)
                    Text(block.title)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    Text(timeLine(block))
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .opacity(0.75)
                }
                .foregroundStyle(ink(block.category))
                .containerBackground(fill(block.category), for: .widget)
            } else {
                VStack(spacing: 5) {
                    Text("◔").font(.system(size: 26))
                    Text("Nothing planned —\nadd something kind.")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .multilineTextAlignment(.center)
                        .opacity(0.7)
                }
                .foregroundStyle(Color(red: 0.141, green: 0.122, blue: 0.192))
                .containerBackground(Color(red: 0.969, green: 0.957, blue: 0.933), for: .widget)
            }
        }
        .widgetURL(URL(string: "kairo://today"))
    }

    private func timeLine(_ block: CachedBlock) -> String {
        let h = block.startMin / 60, m = block.startMin % 60
        let start = String(format: "%d:%02d", h, m)
        if entry.isCurrent { return "until \(String(format: "%d:%02d", block.endMin / 60, block.endMin % 60))" }
        return start
    }
}

@main
struct KairoWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextUpWidget()
        #if canImport(ActivityKit)
        FocusLiveActivity()
        #endif
    }
}

struct NextUpWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KairoNextUp", provider: NextUpProvider()) { entry in
            NextUpWidgetView(entry: entry)
        }
        .configurationDisplayName("Next up")
        .description("Your current or next activity, at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge,
                            .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
