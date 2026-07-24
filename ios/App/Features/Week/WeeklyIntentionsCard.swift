import SwiftUI

// MARK: - Weekly Intentions (G3 parity) — 1-3 gentle aims, synced with web.
// Persisted in settings.notificationPrefs.intentions, keyed by the Monday of
// the current week so it matches the web F7 feature exactly.

struct WeeklyIntentionsCard: View {
    @Environment(AppState.self) private var app
    @State private var items: [Intention] = []
    @State private var draft = ""
    @State private var revision: Int?
    @State private var prefs: [String: Any] = [:]
    @State private var loaded = false

    struct Intention: Identifiable {
        let id = UUID()
        var text: String
        var done: Bool
    }

    /// Monday of the current week, "YYYY-MM-DD" in the planning zone.
    private var weekKey: String {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = app.timezone
        cal.firstWeekday = 2
        let today = Date()
        let start = cal.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        return KTime.dateString(start, zone: app.timezone)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "target").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.kIris)
                Text("This week, I'd love to…").font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
            }
            Text("Up to three gentle aims · no streak, resets Monday")
                .font(.kBody(12)).foregroundStyle(Color.kInkSoft)

            VStack(spacing: 8) {
                ForEach(items.indices, id: \.self) { i in
                    HStack(spacing: 10) {
                        Button { toggle(i) } label: {
                            Image(systemName: items[i].done ? "checkmark.square.fill" : "square")
                                .font(.system(size: 18))
                                .foregroundStyle(items[i].done ? Color.kIris : Color.kInkFaint)
                        }
                        .accessibilityLabel(items[i].done ? "Mark not done" : "Mark done")
                        Text(items[i].text)
                            .font(.kBody(14))
                            .foregroundStyle(items[i].done ? Color.kInkFaint : Color.kInk)
                            .strikethrough(items[i].done)
                        Spacer()
                        Button { remove(i) } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.kInkFaint)
                        }
                        .accessibilityLabel("Remove aim")
                    }
                }
            }
            .padding(.top, items.isEmpty ? 0 : 12)

            if items.count < 3 {
                HStack(spacing: 8) {
                    TextField(items.isEmpty ? "e.g. move my body 3 times" : "add another…", text: $draft)
                        .font(.kBody(14))
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: 11).fill(Color.kSurfaceRaised)
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(Color.kBorder, lineWidth: 1)))
                        .onSubmit { add() }
                        .disabled(!loaded)
                    Button { add() } label: {
                        Text("Add").font(.kBody(13, weight: .bold)).foregroundStyle(Color.kInkInverse)
                            .padding(.horizontal, 13).padding(.vertical, 9)
                            .background(Capsule().fill(Color.kIris))
                    }
                    .disabled(!loaded || draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.top, 12)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 20)
        .task { await load() }
    }

    // MARK: Data

    private func load() async {
        guard let obj = try? await KairoAPI.shared.settingsRaw() else {
            await MainActor.run { loaded = true }
            return
        }
        let rev = obj["revision"] as? Int
        let np = obj["notificationPrefs"] as? [String: Any] ?? [:]
        var loadedItems: [Intention] = []
        if let intent = np["intentions"] as? [String: Any],
           intent["week"] as? String == weekKey,
           let arr = intent["items"] as? [[String: Any]] {
            loadedItems = arr.compactMap {
                guard let t = $0["text"] as? String else { return nil }
                return Intention(text: t, done: ($0["done"] as? Bool) ?? false)
            }
        }
        await MainActor.run {
            revision = rev
            prefs = np
            items = Array(loadedItems.prefix(3))
            loaded = true
        }
    }

    private func persist() {
        guard let rev = revision else { return }
        var np = prefs
        np["intentions"] = [
            "week": weekKey,
            "items": items.map { ["text": $0.text, "done": $0.done] },
        ]
        prefs = np
        Task {
            if let updated = try? await KairoAPI.shared.updateSettings(patch: ["notificationPrefs": np], revision: rev) {
                await MainActor.run { revision = updated.revision }
            }
        }
    }

    private func add() {
        let t = draft.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty, items.count < 3 else { return }
        draft = ""
        items.append(Intention(text: t, done: false))
        UISelectionFeedbackGenerator().selectionChanged()
        persist()
    }

    private func toggle(_ i: Int) {
        items[i].done.toggle()
        UISelectionFeedbackGenerator().selectionChanged()
        persist()
    }

    private func remove(_ i: Int) {
        items.remove(at: i)
        persist()
    }
}
