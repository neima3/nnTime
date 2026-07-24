import SwiftUI

// MARK: - Month (F3 parity) — a calendar at a glance.
// A Monday-first month grid with completion dots (from the stats window) and
// today highlighted. Tapping a day previews that day's blocks.

struct MonthView: View {
    @Environment(AppState.self) private var app
    @State private var anchor = Date()          // any day in the shown month
    @State private var completedByDate: [String: Int] = [:]
    @State private var preview: DayPreview?

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = app.timezone
        c.firstWeekday = 2 // Monday
        return c
    }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    monthHeader
                    weekdayRow
                    grid
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Month").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
            }
        }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .task { await loadDots() }
        .sheet(item: $preview) { p in
            NavigationStack { DayPreviewView(preview: p) }
                .presentationDetents([.medium, .large])
        }
    }

    private var monthHeader: some View {
        HStack {
            Button { shiftMonth(-1) } label: {
                Image(systemName: "chevron.left").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            }
            .accessibilityLabel("Previous month")
            Spacer()
            Text(monthLabel).font(.kDisplay(20)).foregroundStyle(Color.kInk)
            Spacer()
            Button { shiftMonth(1) } label: {
                Image(systemName: "chevron.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            }
            .accessibilityLabel("Next month")
        }
    }

    private var weekdayRow: some View {
        HStack(spacing: 6) {
            ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { d in
                Text(d).font(.kBody(11, weight: .bold)).foregroundStyle(Color.kInkFaint)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var grid: some View {
        let cells = monthCells()
        let todayKey = KTime.dateString(Date(), zone: app.timezone)
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
            ForEach(cells.indices, id: \.self) { i in
                if let day = cells[i] {
                    let key = KTime.dateString(day, zone: app.timezone)
                    let isToday = key == todayKey
                    let count = completedByDate[key] ?? 0
                    Button {
                        preview = DayPreview(dateStr: key, label: dayLabel(day))
                    } label: {
                        VStack(spacing: 4) {
                            Text("\(cal.component(.day, from: day))")
                                .font(.kBody(14, weight: isToday ? .bold : .medium))
                                .foregroundStyle(isToday ? Color.kIris : Color.kInk)
                            Circle()
                                .fill(count > 0 ? Color.kIris : Color.clear)
                                .frame(width: 5, height: 5)
                                .opacity(count > 0 ? min(1, 0.4 + Double(count) * 0.2) : 0)
                        }
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(isToday ? Color.kIrisGhost : Color.kSurface)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(isToday ? Color.kIris : Color.kBorder, lineWidth: 1))
                        )
                    }
                } else {
                    Color.clear.frame(height: 44)
                }
            }
        }
    }

    // MARK: Data + layout

    private var monthLabel: String {
        let df = DateFormatter(); df.dateFormat = "LLLL yyyy"; df.timeZone = app.timezone
        return df.string(from: anchor)
    }

    private func dayLabel(_ d: Date) -> String {
        let df = DateFormatter(); df.dateFormat = "EEEE, MMM d"; df.timeZone = app.timezone
        return df.string(from: d)
    }

    private func shiftMonth(_ delta: Int) {
        if let d = cal.date(byAdding: .month, value: delta, to: anchor) {
            anchor = d
            UISelectionFeedbackGenerator().selectionChanged()
        }
    }

    /// Cells for the shown month, Monday-first, with leading nil padding.
    private func monthCells() -> [Date?] {
        guard let interval = cal.dateInterval(of: .month, for: anchor) else { return [] }
        let first = interval.start
        let daysInMonth = cal.range(of: .day, in: .month, for: anchor)?.count ?? 30
        let weekday = cal.component(.weekday, from: first) // 1=Sun…7=Sat
        let lead = (weekday - cal.firstWeekday + 7) % 7
        var cells: [Date?] = Array(repeating: nil, count: lead)
        for d in 0..<daysInMonth {
            cells.append(cal.date(byAdding: .day, value: d, to: first))
        }
        while cells.count % 7 != 0 { cells.append(nil) }
        return cells
    }

    private func loadDots() async {
        guard let stats = try? await KairoAPI.shared.stats() else { return }
        await MainActor.run {
            completedByDate = stats.byDate.mapValues { $0.completed }
        }
    }
}

struct DayPreview: Identifiable {
    let dateStr: String
    let label: String
    var id: String { dateStr }
}

private struct DayPreviewView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let preview: DayPreview
    @State private var blocks: [DayBlock] = []
    @State private var loading = true

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if loading {
                ProgressView().tint(.kIris)
            } else if blocks.isEmpty {
                VStack(spacing: 8) {
                    Text("🌤").font(.system(size: 40))
                    Text("Nothing scheduled").font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
                    Text("A clear day.").font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                }
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(blocks) { b in
                            HStack(spacing: 12) {
                                Text(b.emoji).font(.system(size: 20))
                                    .frame(width: 40, height: 40)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(b.category.fill))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(b.title).font(.kBody(14, weight: .semibold))
                                        .foregroundStyle(b.done ? Color.kInkFaint : Color.kInk)
                                        .strikethrough(b.done)
                                    Text(KTime.hhmm(b.startMin)).font(.kMono(12)).foregroundStyle(Color.kInkSoft)
                                }
                                Spacer()
                            }
                            .padding(10).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 14)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(preview.label).font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
            }
        }
        .task { await load() }
    }

    private func load() async {
        if let day = try? await KairoAPI.shared.day(preview.dateStr) {
            let zone = TimeZone(identifier: day.zone) ?? app.timezone
            blocks = day.activities
                .map { $0.block(in: zone, category: app.category(for: $0.categoryId)) }
                .sorted { $0.startMin < $1.startMin }
        }
        loading = false
    }
}
