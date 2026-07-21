import SwiftUI

// MARK: - Inbox: brain dump. No dates, no deadlines, nothing ever turns red.

struct InboxView: View {
    @State private var items: [TaskItem] = []
    @State private var draft = ""
    @State private var loading = true
    @State private var scheduling: TaskItem?
    @State private var tending = false
    @FocusState private var composing: Bool

    private var agedItems: [TaskItem] {
        items.filter { (Calendar.current.dateComponents([.day], from: $0.createdAt ?? Date(), to: Date()).day ?? 0) >= 7 }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                VStack(spacing: 0) {
                    composer
                        .padding(.horizontal, 20)
                        .padding(.top, 6)

                    if agedItems.count >= 3 {
                        Button { tending = true } label: {
                            HStack(spacing: 10) {
                                Text("🪴").font(.system(size: 18))
                                Text("\(agedItems.count) thoughts have been resting a while. Tend the garden?")
                                    .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInk).multilineTextAlignment(.leading)
                                Spacer()
                                Text("Tend").font(.kBody(12.5, weight: .bold)).foregroundStyle(Color.kCatButter)
                                    .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(Color.kCatButterInk))
                            }
                            .padding(14).background(RoundedRectangle(cornerRadius: 18).fill(Color.kCatButter.opacity(0.4)).overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.kCatButterInk.opacity(0.25), lineWidth: 1)))
                        }
                        .padding(.horizontal, 20).padding(.top, 10)
                    }

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
            .sheet(isPresented: $tending, onDismiss: { Task { await load() } }) {
                TendSheet(items: agedItems, onSchedule: { scheduling = $0; tending = false },
                          onDelete: { item in Task { try? await KairoAPI.shared.deleteTask(id: item.id, revision: item.revision); await load() } })
            }
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

// MARK: - Tend the garden: walk aged thoughts one by one

struct TendSheet: View {
    @Environment(\.dismiss) private var dismiss
    let items: [TaskItem]
    let onSchedule: (TaskItem) -> Void
    let onDelete: (TaskItem) -> Void
    @State private var index = 0

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if index < items.count {
                let item = items[index]
                let age = Calendar.current.dateComponents([.day], from: item.createdAt ?? Date(), to: Date()).day ?? 0
                VStack(spacing: 0) {
                    Text("TENDING · \(index + 1) OF \(items.count)").font(.kBody(11, weight: .bold)).kerning(1.3).foregroundStyle(Color.kInkFaint).padding(.top, 40)
                    Text("\(item.emoji ?? "📋") \(item.title)").font(.kDisplay(22)).foregroundStyle(Color.kInk).multilineTextAlignment(.center).padding(.horizontal, 24).padding(.top, 16)
                    Text("captured \(age) days ago — does it still matter?").font(.kBody(13)).foregroundStyle(Color.kInkSoft).padding(.top, 6)
                    Spacer()
                    VStack(spacing: 10) {
                        Button { onSchedule(item) } label: {
                            Text("Schedule it").font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInkInverse)
                                .frame(maxWidth: .infinity).padding(.vertical, 14).background(RoundedRectangle(cornerRadius: 16).fill(Color.kIris))
                        }
                        Button { index += 1 } label: {
                            Text("Keep — it can rest").font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInk)
                                .frame(maxWidth: .infinity).padding(.vertical, 14).background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface).overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1)))
                        }
                        Button { onDelete(item); index += 1 } label: {
                            Text("Let it go").font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInkSoft).frame(maxWidth: .infinity).padding(.vertical, 12)
                        }
                    }
                    .padding(.horizontal, 20).padding(.bottom, 24)
                }
            } else {
                VStack(spacing: 12) {
                    Text("Garden tended 🌿").font(.kDisplay(24)).foregroundStyle(Color.kInk)
                    Button("Done") { dismiss() }.font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kIris).padding(.top, 8)
                }
            }
        }
        .presentationDetents([.large])
    }
}
