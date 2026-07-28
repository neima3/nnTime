import SwiftUI

// MARK: - Search / quick-jump (H3)
//
// "Where did I put that?" — type a few letters, get the matching blocks and
// to-dos across your whole planner, tap one to land on its day. Matching and
// ranking happen server-side (the generated search operation) so results
// are identical to the web.
//
// Debounced so typing doesn't fire a request per keystroke, and every state
// (idle / searching / empty / results) says something kind rather than nothing.

struct SearchView: View {
    @Environment(AppState.self) private var app

    @State private var query = ""
    @State private var hits: [SearchResponse.Hit] = []
    @State private var today = ""
    @State private var searching = false
    @State private var searchedFor: String?
    @State private var failed = false
    @State private var jumpTo: DayJump?
    /// Bumped on each keystroke; a debounce task bails if it is no longer current.
    @State private var generation = 0

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack(spacing: 0) {
                searchField
                content
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Search")
                    .font(.kBody(15, weight: .bold))
                    .foregroundStyle(Color.kInk)
            }
        }
        .navigationDestination(item: $jumpTo) { jump in
            SearchDayView(jump: jump)
        }
    }

    // MARK: Field

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.kInkFaint)
            TextField("Find a block or a to-do", text: $query)
                .font(.kBody(15))
                .foregroundStyle(Color.kInk)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .accessibilityLabel("Search your planner")
                .onChange(of: query) { _, _ in scheduleSearch() }
                .onSubmit { runSearch(for: query, immediate: true) }
            if !query.isEmpty {
                Button {
                    query = ""
                    hits = []
                    searchedFor = nil
                    failed = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.kInkFaint)
                }
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .kCard(radius: 16)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 14)
    }

    // MARK: States

    @ViewBuilder
    private var content: some View {
        if failed {
            message(emoji: "🌥", title: "Couldn't reach your planner",
                    body: "Check your connection and try that again.")
        } else if query.trimmingCharacters(in: .whitespaces).isEmpty {
            message(emoji: "🔍", title: "Find anything you've planned",
                    body: "Titles first, notes too. Tap a result to jump to its day.")
        } else if searching && hits.isEmpty {
            ProgressView().tint(.kIris).frame(maxHeight: .infinity)
        } else if hits.isEmpty && searchedFor != nil {
            message(emoji: "🫧", title: "Nothing matched",
                    body: "Try fewer letters, or a word from the title.")
        } else {
            results
        }
    }

    private var results: some View {
        ScrollView {
            VStack(spacing: 8) {
                ForEach(hits) { hit in
                    Button {
                        jump(to: hit)
                    } label: {
                        SearchRow(hit: hit, today: today,
                                  category: app.category(for: hit.categoryId))
                    }
                    .buttonStyle(.plain)
                    .disabled(hit.date == nil)
                }
                if hits.contains(where: { $0.date == nil }) {
                    Text("Undated to-dos live in your Inbox.")
                        .font(.kBody(12))
                        .foregroundStyle(Color.kInkFaint)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
    }

    private func message(emoji: String, title: String, body: String) -> some View {
        VStack(spacing: 8) {
            Text(emoji).font(.system(size: 40))
            Text(title).font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
            Text(body)
                .font(.kBody(13))
                .foregroundStyle(Color.kInkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxHeight: .infinity)
    }

    // MARK: Actions

    private func jump(to hit: SearchResponse.Hit) {
        guard let date = hit.date else { return }
        jumpTo = DayJump(dateStr: date, title: hit.title)
    }

    /// Debounce: wait a beat after the last keystroke before asking the server.
    private func scheduleSearch() {
        generation += 1
        let mine = generation
        let text = query
        failed = false
        if text.trimmingCharacters(in: .whitespaces).isEmpty {
            hits = []
            searchedFor = nil
            searching = false
            return
        }
        Task {
            try? await Task.sleep(nanoseconds: 280_000_000)
            guard mine == generation else { return }
            runSearch(for: text, immediate: false)
        }
    }

    private func runSearch(for text: String, immediate: Bool) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        if immediate { generation += 1 }
        let mine = generation
        searching = true
        Task {
            do {
                let res = try await KairoAPI.shared.search(trimmed)
                guard mine == generation else { return }   // a newer query won
                today = res.today
                hits = res.items
                searchedFor = trimmed
                failed = false
            } catch {
                guard mine == generation else { return }
                hits = []
                failed = true
            }
            if mine == generation { searching = false }
        }
    }
}

// MARK: - One result row

private struct SearchRow: View {
    let hit: SearchResponse.Hit
    let today: String
    let category: KairoCategory

    var body: some View {
        HStack(spacing: 12) {
            Text(hit.emoji ?? (hit.isTask ? "📋" : "🕒"))
                .font(.system(size: 20))
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 12).fill(category.fill))
            VStack(alignment: .leading, spacing: 2) {
                Text(hit.title)
                    .font(.kBody(14, weight: .semibold))
                    .foregroundStyle(Color.kInk)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(SearchFormat.dateLabel(hit.date, today: today))
                        .font(.kBody(12, weight: .medium))
                        .foregroundStyle(Color.kInkSoft)
                    if let startMin = hit.startMin, hit.date != nil {
                        Text(KTime.hhmm(startMin))
                            .font(.kMono(11))
                            .foregroundStyle(Color.kInkFaint)
                    }
                    if hit.repeats {
                        Image(systemName: "repeat")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.kInkFaint)
                            .accessibilityLabel("Repeats")
                    }
                    if hit.matchedOn == "notes" {
                        Text("in notes")
                            .font(.kBody(11))
                            .foregroundStyle(Color.kInkFaint)
                    }
                }
            }
            Spacer()
            if hit.date != nil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.kInkFaint)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 14)
        .accessibilityElement(children: .combine)
        .accessibilityHint(hit.date == nil ? "Undated — lives in your Inbox" : "Opens that day")
    }
}

// MARK: - Date labels (mirrors searchDateLabel in src/lib/search.ts)

enum SearchFormat {
    static func dateLabel(_ date: String?, today: String) -> String {
        guard let date else { return "Anytime" }
        if date == today { return "Today" }
        guard let d = parse(date) else { return date }
        if let t = parse(today) {
            let days = Calendar(identifier: .gregorian)
                .dateComponents([.day], from: t, to: d).day ?? 0
            if days == 1 { return "Tomorrow" }
            if days == -1 { return "Yesterday" }
        }
        let df = DateFormatter()
        df.dateFormat = "EEE, MMM d"
        df.timeZone = TimeZone(identifier: "UTC")
        return df.string(from: d)
    }

    private static func parse(_ s: String) -> Date? {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "UTC")
        return df.date(from: s)
    }
}

// MARK: - Jumping to a day

struct DayJump: Identifiable, Hashable {
    let dateStr: String
    let title: String
    var id: String { dateStr + title }
}

/// The day a search result lives on, so a jump lands somewhere real rather than
/// just closing the sheet.
private struct SearchDayView: View {
    @Environment(AppState.self) private var app
    let jump: DayJump
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
                    Text("Nothing scheduled").font(.kBody(15, weight: .bold))
                        .foregroundStyle(Color.kInk)
                    Text("This day is clear.").font(.kBody(13)).foregroundStyle(Color.kInkSoft)
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
                                    Text(b.title)
                                        .font(.kBody(14, weight: .semibold))
                                        .foregroundStyle(
                                            b.title == jump.title ? Color.kIris : Color.kInk)
                                    Text(KTime.hhmm(b.startMin))
                                        .font(.kMono(12)).foregroundStyle(Color.kInkSoft)
                                }
                                Spacer()
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .kCard(radius: 14)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(SearchFormat.dateLabel(jump.dateStr, today: ""))
                    .font(.kBody(15, weight: .bold))
                    .foregroundStyle(Color.kInk)
            }
        }
        .task { await load() }
    }

    private func load() async {
        if let day = try? await KairoAPI.shared.day(jump.dateStr) {
            let zone = TimeZone(identifier: day.zone) ?? app.timezone
            blocks = day.activities
                .map { $0.block(in: zone, category: app.category(for: $0.categoryId)) }
                .sorted { $0.startMin < $1.startMin }
        }
        loading = false
    }
}
