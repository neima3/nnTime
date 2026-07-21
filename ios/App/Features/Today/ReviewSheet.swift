import SwiftUI

// MARK: - Review today: I-did-it / move to tomorrow / let it go. Totally fine.

struct ReviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    let date: String
    let zone: TimeZone
    let items: [DayBlock]
    let onChange: () -> Void

    @State private var remaining: [DayBlock]
    @State private var busy = false

    init(date: String, zone: TimeZone, items: [DayBlock], onChange: @escaping () -> Void) {
        self.date = date; self.zone = zone; self.items = items; self.onChange = onChange
        _remaining = State(initialValue: items.filter { !$0.done })
    }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if let item = remaining.first {
                VStack(spacing: 0) {
                    Text("REVIEW TODAY").font(.kBody(11, weight: .bold)).kerning(1.4).foregroundStyle(Color.kInkSoft).padding(.top, 40)
                    Text("\(remaining.count) \(remaining.count == 1 ? "thing" : "things") didn't happen")
                        .font(.kDisplay(26)).foregroundStyle(Color.kInk).multilineTextAlignment(.center).padding(.horizontal, 24).padding(.top, 4)
                    Text("Totally fine. Let's decide what they become.").font(.kBody(14)).foregroundStyle(Color.kInkSoft).padding(.top, 6)

                    HStack(spacing: 16) {
                        Text(item.emoji).font(.system(size: 30)).frame(width: 56, height: 56).background(RoundedRectangle(cornerRadius: 16).fill(item.category.fill))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.kDisplay(20)).foregroundStyle(item.category.ink).lineLimit(1)
                            Text(KTime.hhmm(item.startMin)).font(.kMono(13, weight: .medium)).foregroundStyle(Color.kInkSoft)
                        }
                        Spacer()
                    }
                    .padding(18).frame(maxWidth: .infinity).kCard(radius: 24).padding(.horizontal, 20).padding(.top, 28)

                    Spacer()

                    VStack(spacing: 10) {
                        Button { Task { await act(item, .complete) } } label: {
                            Label("I did it", systemImage: "checkmark").font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kSuccess)
                                .frame(maxWidth: .infinity).padding(.vertical, 15).background(RoundedRectangle(cornerRadius: 18).fill(Color.kSuccessSoft))
                        }
                        Button { Task { await act(item, .tomorrow) } } label: {
                            Label("Move to tomorrow", systemImage: "arrow.right").font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInk)
                                .frame(maxWidth: .infinity).padding(.vertical, 15).background(RoundedRectangle(cornerRadius: 18).fill(Color.kSurface).overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.kBorder, lineWidth: 1)))
                        }
                        Button { Task { await act(item, .letGo) } } label: {
                            Label("Let it go", systemImage: "wind").font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                                .frame(maxWidth: .infinity).padding(.vertical, 13)
                        }
                    }
                    .disabled(busy).opacity(busy ? 0.5 : 1)
                    .padding(.horizontal, 20).padding(.bottom, 24)
                }
            } else {
                VStack(spacing: 12) {
                    Text("All done ✨").font(.kDisplay(26)).foregroundStyle(Color.kInk)
                    Text("Nothing left to review for today.").font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                    Button("Back to my day") { dismiss() }.font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kIris).padding(.top, 8)
                }
            }
        }
        .presentationDetents([.large])
    }

    private enum Action { case complete, tomorrow, letGo }
    private func act(_ item: DayBlock, _ action: Action) async {
        busy = true
        switch action {
        case .complete:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            _ = try? await KairoAPI.shared.setStatus(activityId: item.id, revision: item.revision, occurrenceKey: item.occurrenceKey,
                status: "completed", completedAt: ISO8601DateFormatter().string(from: Date()))
        case .letGo:
            _ = try? await KairoAPI.shared.setStatus(activityId: item.id, revision: item.revision, occurrenceKey: item.occurrenceKey,
                status: "skipped", completedAt: nil)
        case .tomorrow:
            var cal = Calendar(identifier: .gregorian); cal.timeZone = zone
            let comps = date.split(separator: "-").compactMap { Int($0) }
            var dc = DateComponents(); dc.year = comps[0]; dc.month = comps[1]; dc.day = comps[2]
            let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.date(from: dc) ?? Date()) ?? Date()
            let tKey = KTime.dateString(tomorrow, zone: zone)
            _ = try? await KairoAPI.shared.moveActivity(activityId: item.id, revision: item.revision, occurrenceKey: item.occurrenceKey,
                startAt: KTime.instant(date: tKey, minutes: item.startMin, zone: zone))
        }
        remaining.removeFirst()
        onChange()
        busy = false
    }
}
