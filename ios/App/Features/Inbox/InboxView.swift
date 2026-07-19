import SwiftUI

// MARK: - Inbox: brain dump. No dates, no deadlines, nothing ever turns red.

struct InboxView: View {
    @State private var items: [TaskItem] = []
    @State private var draft = ""
    @State private var loading = true
    @State private var scheduling: TaskItem?
    @FocusState private var composing: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                VStack(spacing: 0) {
                    composer
                        .padding(.horizontal, 20)
                        .padding(.top, 6)

                    if loading {
                        Spacer()
                        ProgressView().tint(.kIris)
                        Spacer()
                    } else if items.isEmpty {
                        Spacer()
                        VStack(spacing: 10) {
                            Text("🌿").font(.system(size: 40))
                            Text("Inbox is empty")
                                .font(.kDisplay(20))
                                .foregroundStyle(Color.kInk)
                            Text("Dump a thought above — head stays clear.")
                                .font(.kBody(14))
                                .foregroundStyle(Color.kInkSoft)
                        }
                        Spacer()
                    } else {
                        List {
                            ForEach(items) { item in
                                row(item)
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                                    .listRowInsets(EdgeInsets(top: 5, leading: 20, bottom: 5, trailing: 20))
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button {
                                            scheduling = item
                                        } label: {
                                            Label("Schedule", systemImage: "calendar.badge.plus")
                                        }
                                        .tint(.kIris)
                                    }
                            }
                            .onDelete { indexSet in
                                Task { await delete(indexSet) }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .refreshable { await load() }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Inbox")
                        .font(.kDisplay(18, relativeTo: .headline))
                        .foregroundStyle(Color.kInk)
                }
            }
            .toolbarBackground(Color.kCanvas, for: .navigationBar)
            .sheet(item: $scheduling) { item in
                EditorSheet(
                    date: KTime.dateString(zone: .current),
                    startMin: nextQuarterHour(),
                    initialTitle: item.title,
                    onCreated: {
                        Task {
                            try? await KairoAPI.shared.deleteTask(id: item.id, revision: item.revision)
                            await load()
                        }
                    }
                )
            }
        }
        .task { await load() }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            Image(systemName: "plus")
                .foregroundStyle(Color.kInkFaint)
            TextField("Get it out of your head…", text: $draft)
                .font(.kBody(15, weight: .medium))
                .focused($composing)
                .onSubmit { Task { await add() } }
            if !draft.isEmpty {
                Button {
                    Task { await add() }
                } label: {
                    Text("Add")
                        .font(.kBody(13, weight: .bold))
                        .foregroundStyle(Color.kInkInverse)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(Color.kIris))
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 13)
        .kCard(radius: 18)
    }

    private func row(_ item: TaskItem) -> some View {
        HStack(spacing: 12) {
            Text(item.emoji ?? "📋")
                .font(.system(size: 18))
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.kCatSky))
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.kBody(15, weight: .semibold))
                    .foregroundStyle(Color.kInk)
                if let age = ageDays(item), age >= 7 {
                    Text("resting \(age) days")
                        .font(.kBody(11, weight: .bold))
                        .foregroundStyle(Color.kCatButterInk)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.kCatButter))
                }
            }
            Spacer()
        }
        .padding(12)
        .kCard(radius: 16)
    }

    private func ageDays(_ item: TaskItem) -> Int? {
        guard let created = item.createdAt else { return nil }
        return Calendar.current.dateComponents([.day], from: created, to: Date()).day
    }

    private func nextQuarterHour() -> Int {
        let now = Calendar.current.dateComponents([.hour, .minute], from: Date())
        let minutes = (now.hour ?? 9) * 60 + (now.minute ?? 0) + 30
        return min(23 * 60, ((minutes + 14) / 15) * 15)
    }

    private func load() async {
        do {
            items = try await KairoAPI.shared.tasks(bucket: "inbox")
        } catch {}
        loading = false
    }

    private func add() async {
        let title = draft.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        draft = ""
        do {
            let created = try await KairoAPI.shared.createTask(title: title, bucket: "inbox")
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                items.insert(created, at: 0)
            }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } catch {
            draft = title
        }
    }

    private func delete(_ indexSet: IndexSet) async {
        for index in indexSet {
            let item = items[index]
            try? await KairoAPI.shared.deleteTask(id: item.id, revision: item.revision)
        }
        withAnimation { items.remove(atOffsets: indexSet) }
    }
}
