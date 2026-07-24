import SwiftUI

// MARK: - Week: the next seven days as gentle cards.

struct WeekView: View {
    @Environment(AppState.self) private var app
    @State private var days: [WeekDay] = []
    @State private var loading = true
    @State private var editTarget: EditTarget?

    struct WeekDay: Identifiable {
        let id: String        // YYYY-MM-DD
        let label: String     // "Mon 20"
        let isToday: Bool
        let blocks: [DayBlock]
    }

    struct EditTarget: Identifiable {
        let date: String
        let block: DayBlock?
        var id: String { "\(date)-\(block?.id ?? "new")" }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                if loading {
                    ProgressView().tint(.kIris)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            WeeklyIntentionsCard()
                            ForEach(days) { day in
                                dayCard(day)
                            }
                        }
                        .padding(20)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Week")
                        .font(.kDisplay(18, relativeTo: .headline))
                        .foregroundStyle(Color.kInk)
                }
            }
            .toolbarBackground(Color.kCanvas, for: .navigationBar)
            .sheet(item: $editTarget, onDismiss: { Task { await load() } }) { t in
                EditorSheet(date: t.date, startMin: t.block?.startMin ?? 9 * 60, editing: t.block)
            }
        }
        .task { await load() }
    }

    private func dayCard(_ day: WeekDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(day.label)
                    .font(.kBody(14, weight: .bold))
                    .foregroundStyle(day.isToday ? Color.kIris : Color.kInk)
                if day.isToday {
                    Text("TODAY")
                        .font(.kBody(10, weight: .bold))
                        .kerning(1.2)
                        .foregroundStyle(Color.kIris)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Capsule().fill(Color.kIrisSoft))
                }
                Spacer()
                if !day.blocks.isEmpty {
                    Text(KTime.duration(day.blocks.reduce(0) { $0 + $1.durationMin }))
                        .font(.kMono(11, weight: .medium))
                        .foregroundStyle(Color.kInkFaint)
                }
                Button {
                    editTarget = EditTarget(date: day.id, block: nil)
                } label: {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.kIris)
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(Color.kIrisSoft))
                }
                .accessibilityLabel("Add activity on \(day.label)")
            }

            if day.blocks.isEmpty {
                Button {
                    editTarget = EditTarget(date: day.id, block: nil)
                } label: {
                    Text("Nothing planned — tap + to add, or leave the space.")
                        .font(.kBody(13))
                        .foregroundStyle(Color.kInkFaint)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            } else {
                ForEach(day.blocks) { block in
                    Button {
                        editTarget = EditTarget(date: day.id, block: block)
                    } label: {
                        HStack(spacing: 9) {
                            Text(block.emoji).font(.system(size: 14))
                            Text(block.title)
                                .font(.kBody(13.5, weight: .semibold))
                                .strikethrough(block.done)
                                .lineLimit(1)
                            Spacer()
                            Text(KTime.hhmm(block.startMin))
                                .font(.kMono(12, weight: .medium))
                                .opacity(0.75)
                        }
                        .foregroundStyle(block.category.ink)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .fill(block.category.fill)
                        )
                        .opacity(block.done ? 0.6 : 1)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 20)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(day.isToday ? Color.kIris.opacity(0.45) : .clear, lineWidth: 1.5)
        )
    }

    private func load() async {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = app.timezone
        let today = Date()
        let zone = app.timezone
        let categoryMap = app.categoryMap

        var result: [WeekDay] = []
        await withTaskGroup(of: (Int, WeekDay).self) { group in
            for offset in 0..<7 {
                let date = cal.date(byAdding: .day, value: offset, to: today) ?? today
                let key = KTime.dateString(date, zone: zone)
                let df = DateFormatter()
                df.dateFormat = "EEE d"
                df.timeZone = zone
                let label = df.string(from: date)
                group.addTask {
                    let blocks: [DayBlock]
                    if let day = try? await KairoAPI.shared.day(key) {
                        let z = TimeZone(identifier: day.zone) ?? zone
                        blocks = day.activities
                            .map { $0.block(in: z, category: $0.categoryId.flatMap { categoryMap[$0] } ?? .sky) }
                            .sorted { $0.startMin < $1.startMin }
                    } else {
                        blocks = []
                    }
                    return (offset, WeekDay(id: key, label: label, isToday: offset == 0, blocks: blocks))
                }
            }
            var collected: [(Int, WeekDay)] = []
            for await pair in group { collected.append(pair) }
            result = collected.sorted { $0.0 < $1.0 }.map(\.1)
        }
        days = result
        loading = false
    }
}
