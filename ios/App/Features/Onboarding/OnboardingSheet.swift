import SwiftUI

// MARK: - First-run: build a real day in a tap (mirrors the web anchor picker)

struct OnboardingSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var picked: Set<Int> = [0, 2, 5]
    @State private var busy = false
    @State private var step = 0   // 0 = anchors, 1 = orientation
    let onDone: () -> Void

    private struct Anchor { let emoji, title, hint: String; let startMin, durationMin: Int; let daily: Bool }
    private let anchors: [Anchor] = [
        .init(emoji: "🌤", title: "Morning reset", hint: "8:00 · every day", startMin: 480, durationMin: 30, daily: true),
        .init(emoji: "💊", title: "Meds + breakfast", hint: "8:30 · every day", startMin: 510, durationMin: 15, daily: true),
        .init(emoji: "🎨", title: "Deep work block", hint: "9:30 · today", startMin: 570, durationMin: 90, daily: false),
        .init(emoji: "🍜", title: "Real lunch, no desk", hint: "12:30 · today", startMin: 750, durationMin: 45, daily: false),
        .init(emoji: "🏃", title: "Move a little", hint: "17:00 · today", startMin: 1020, durationMin: 30, daily: false),
        .init(emoji: "🌙", title: "Wind-down", hint: "21:30 · every day", startMin: 1290, durationMin: 30, daily: true),
    ]

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if step == 1 { orientation } else { anchorPicker }
        }
        .interactiveDismissDisabled(busy)
    }

    private var orientation: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Three things worth knowing").font(.kDisplay(26)).foregroundStyle(Color.kInk)
                Text("You'll find the rest as you go. No pressure to remember them.")
                    .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
            }
            .padding(.top, 8)

            VStack(spacing: 12) {
                orientationRow("dice", "Stuck on what to do?", "Tap “Pick for me” on Today — it chooses exactly one thing.")
                orientationRow("timer", "Focus a block", "Tap a block, then Focus — a calm timer that never shames overtime.")
                orientationRow("gamecontroller", "Need a reset?", "Brain breaks live in More — two minutes of play counts as rest.")
            }

            Spacer()

            Button { finish() } label: {
                Text("Start my day")
                    .font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkInverse)
                    .frame(maxWidth: .infinity).padding(.vertical, 15)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.kIris))
            }
            .kFloatShadow()
            Text("Every step is skippable. Nothing here is a commitment.")
                .font(.kBody(12)).foregroundStyle(Color.kInkFaint)
                .frame(maxWidth: .infinity)
        }
        .padding(20)
    }

    private func orientationRow(_ icon: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.kIris)
                .frame(width: 38, height: 38)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.kIrisSoft))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
                Text(body).font(.kBody(13)).foregroundStyle(Color.kInkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 16)
    }

    private var anchorPicker: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Pick your anchors").font(.kDisplay(26)).foregroundStyle(Color.kInk)
                    Text("A day with two or three anchors already has a shape. Tap what fits — drag the times later.")
                        .font(.kBody(14.5)).foregroundStyle(Color.kInkSoft)
                }
                .padding(.top, 8)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(anchors.indices, id: \.self) { i in
                        let on = picked.contains(i)
                        Button {
                            if on { picked.remove(i) } else { picked.insert(i) }
                            UISelectionFeedbackGenerator().selectionChanged()
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(anchors[i].emoji).font(.system(size: 20))
                                    Spacer()
                                    if on { Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.kIris) }
                                }
                                Text(anchors[i].title).font(.kBody(13.5, weight: .bold)).foregroundStyle(Color.kInk).lineLimit(1)
                                Text(anchors[i].hint).font(.kMono(11, weight: .medium)).foregroundStyle(Color.kInkSoft)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(on ? Color.kIrisSoft : Color.kSurface)
                                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? Color.kIris : Color.kBorder, lineWidth: 1))
                            )
                        }
                    }
                }

                Spacer()

                Button {
                    Task { await create() }
                } label: {
                    HStack(spacing: 8) {
                        if busy { ProgressView().tint(.kInkInverse) }
                        else {
                            Text("Create \(picked.count) anchor\(picked.count == 1 ? "" : "s")")
                                .font(.kBody(16, weight: .semibold))
                            Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold))
                        }
                    }
                    .foregroundStyle(Color.kInkInverse)
                    .frame(maxWidth: .infinity).padding(.vertical, 15)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.kIris))
                }
                .disabled(busy || picked.isEmpty)
                .opacity(picked.isEmpty ? 0.6 : 1)
                .kFloatShadow()

                Button("Skip — I'll build my own") { withAnimation { step = 1 } }
                    .font(.kBody(13, weight: .semibold))
                    .foregroundStyle(Color.kInkFaint)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
        }
        .interactiveDismissDisabled(busy)
    }

    private func create() async {
        busy = true
        let today = KTime.dateString(zone: app.timezone)
        for i in picked.sorted() {
            let a = anchors[i]
            _ = try? await KairoAPI.shared.createActivity(
                tz: app.timezone.identifier,
                dtstartLocal: KTime.instant(date: today, minutes: a.startMin, zone: app.timezone),
                title: a.title, emoji: a.emoji, durationMin: a.durationMin,
                rrule: a.daily ? "FREQ=DAILY" : nil, categoryId: nil
            )
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        busy = false
        withAnimation { step = 1 }
    }

    private func finish() {
        KairoPrefs.hasOnboarded = true
        onDone()
        dismiss()
    }
}
