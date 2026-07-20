import WidgetKit
import SwiftUI

// MARK: - "Next up" widget (ios-adaptation.md §3, small)
// Renders from the on-device day cache; a timeline entry per block boundary
// keeps the countdown honest without any network.

struct NextUpEntry: TimelineEntry {
    let date: Date
    let block: CachedBlock?
    let isCurrent: Bool
}

struct NextUpProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextUpEntry {
        NextUpEntry(date: Date(),
                    block: CachedBlock(title: "Morning reset", emoji: "🌤", startMin: 480, durationMin: 30, done: false, category: "butter"),
                    isCurrent: false)
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
            return NextUpEntry(date: date, block: nil, isCurrent: false)
        }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let comps = cal.dateComponents([.hour, .minute], from: date)
        let nowMin = (comps.hour ?? 0) * 60 + (comps.minute ?? 0)

        if let current = snap.blocks.first(where: { !$0.done && $0.startMin <= nowMin && nowMin < $0.endMin }) {
            return NextUpEntry(date: date, block: current, isCurrent: true)
        }
        let next = snap.blocks
            .filter { !$0.done && $0.startMin > nowMin }
            .min { $0.startMin < $1.startMin }
        return NextUpEntry(date: date, block: next, isCurrent: false)
    }
}

struct NextUpWidgetView: View {
    var entry: NextUpEntry

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
        Group {
            if let block = entry.block {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(block.emoji)
                            .font(.system(size: 18))
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(.white.opacity(0.65)))
                        Spacer()
                        if entry.isCurrent {
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
        .supportedFamilies([.systemSmall])
    }
}
