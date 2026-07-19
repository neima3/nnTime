import SwiftUI

// MARK: - New activity sheet (native detent sheet per ios-adaptation.md §2)

struct EditorSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    let date: String
    @State var startMin: Int
    @State private var title = ""
    @State private var emoji = "📋"
    @State private var durationMin = 45
    @State private var category: KairoCategory = .sky
    @State private var repeats: Repeat = .none
    @State private var busy = false
    @State private var error: String?

    init(date: String, startMin: Int) {
        self.date = date
        _startMin = State(initialValue: startMin)
    }

    enum Repeat: String, CaseIterable, Identifiable {
        case none = "Doesn't repeat"
        case daily = "Daily"
        case weekdays = "Weekdays"
        var id: String { rawValue }

        var rrule: String? {
            switch self {
            case .none: nil
            case .daily: "FREQ=DAILY"
            case .weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
            }
        }
    }

    private let emojis = ["📋", "💊", "🎨", "🚶", "🍜", "🏋️", "📞", "☕", "📚", "🧠", "🧹", "✨"]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        // Title + emoji
                        HStack(spacing: 12) {
                            Menu {
                                ForEach(emojis, id: \.self) { e in
                                    Button(e) { emoji = e }
                                }
                            } label: {
                                Text(emoji)
                                    .font(.system(size: 24))
                                    .frame(width: 52, height: 52)
                                    .background(RoundedRectangle(cornerRadius: 14).fill(category.fill))
                            }
                            TextField("What are you doing?", text: $title)
                                .font(.kBody(17, weight: .medium))
                                .padding(.horizontal, 16).padding(.vertical, 14)
                                .background(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .fill(Color.kSurface)
                                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kIris, lineWidth: 2))
                                )
                        }

                        // Category
                        section("Category") {
                            HStack(spacing: 8) {
                                ForEach(KairoCategory.allCases, id: \.self) { cat in
                                    Button {
                                        category = cat
                                    } label: {
                                        Circle()
                                            .fill(cat.fill)
                                            .frame(width: 34, height: 34)
                                            .overlay(
                                                Circle().stroke(
                                                    category == cat ? cat.ink : .clear, lineWidth: 2.5
                                                )
                                            )
                                    }
                                    .accessibilityLabel(cat.rawValue)
                                }
                            }
                        }

                        // When
                        section("When") {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 8) {
                                    stepper(
                                        label: KTime.hhmm(startMin),
                                        minus: { startMin = max(0, startMin - 15) },
                                        plus: { startMin = min(23 * 60 + 45, startMin + 15) }
                                    )
                                    stepper(
                                        label: KTime.duration(durationMin),
                                        minus: { durationMin = max(5, durationMin - 15) },
                                        plus: { durationMin = min(480, durationMin + 15) }
                                    )
                                }
                                HStack(spacing: 6) {
                                    ForEach([15, 25, 45, 60, 90], id: \.self) { d in
                                        chip("\(d)m", selected: durationMin == d) { durationMin = d }
                                    }
                                }
                            }
                        }

                        // Repeats
                        section("Repeats") {
                            HStack(spacing: 6) {
                                ForEach(Repeat.allCases) { r in
                                    chip(r.rawValue, selected: repeats == r) { repeats = r }
                                }
                            }
                        }

                        if let error {
                            Text(error)
                                .font(.kBody(13, weight: .medium))
                                .foregroundStyle(Color.kDanger)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("New activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.kInkSoft)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy { ProgressView() } else {
                            Text("Save").font(.kBody(15, weight: .bold)).foregroundStyle(Color.kIris)
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func section(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(.kBody(12, weight: .bold))
                .kerning(1.2)
                .foregroundStyle(Color.kInkSoft)
            content()
        }
    }

    private func chip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.kBody(13, weight: .semibold))
                .foregroundStyle(selected ? Color.kIris : Color.kInkSoft)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    Capsule().fill(selected ? Color.kIrisSoft : Color.kSurface)
                        .overlay(Capsule().stroke(selected ? Color.kIris : Color.kBorder, lineWidth: 1))
                )
        }
    }

    private func stepper(label: String, minus: @escaping () -> Void, plus: @escaping () -> Void) -> some View {
        HStack(spacing: 0) {
            Button(action: minus) {
                Image(systemName: "minus").frame(width: 36, height: 40)
            }
            Text(label)
                .font(.kMono(15))
                .frame(minWidth: 72)
            Button(action: plus) {
                Image(systemName: "plus").frame(width: 36, height: 40)
            }
        }
        .foregroundStyle(Color.kInk)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.kSurface)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.kBorder, lineWidth: 1))
        )
    }

    private func save() async {
        busy = true
        error = nil
        let categoryId = app.categoryMap.first(where: { $0.value == category })?.key
        do {
            _ = try await KairoAPI.shared.createActivity(
                tz: app.timezone.identifier,
                dtstartLocal: KTime.instant(date: date, minutes: startMin, zone: app.timezone),
                title: title.trimmingCharacters(in: .whitespaces),
                emoji: emoji,
                durationMin: durationMin,
                rrule: repeats.rrule,
                categoryId: categoryId
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
            busy = false
        } catch {
            self.error = "Couldn't save — try again."
            busy = false
        }
    }
}
