import SwiftUI

// MARK: - Inbox: brain dump. No dates, no deadlines, nothing ever turns red.

@Observable @MainActor
final class InboxCaptureSubmissionModel {
    enum Outcome {
        case created(TaskItem)
        case queued
    }

    var draft: String
    private(set) var isSaving = false
    private(set) var errorMessage: String?
    private var activeOperationID: UUID?

    init(draft: String = "") {
        self.draft = draft
    }

    func submit(
        isOnline: Bool,
        isCurrent: () -> Bool,
        createOnline: (String) async throws -> TaskItem,
        enqueueOffline: (String) async throws -> Void,
        onFailure: (Error) async -> Void = { _ in }
    ) async -> Outcome? {
        let originalDraft = draft
        let title = originalDraft.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        guard
            !title.isEmpty,
            !isSaving,
            !Task.isCancelled,
            isCurrent()
        else {
            return nil
        }

        let operationID = UUID()
        activeOperationID = operationID
        isSaving = true
        errorMessage = nil
        defer { finish(operationID) }
        do {
            let outcome: Outcome
            if isOnline {
                outcome = .created(try await createOnline(title))
            } else {
                try await enqueueOffline(title)
                outcome = .queued
            }
            guard
                !Task.isCancelled,
                activeOperationID == operationID,
                isCurrent()
            else {
                return nil
            }
            if draft == originalDraft {
                draft = ""
            }
            return outcome
        } catch {
            guard
                !Task.isCancelled,
                activeOperationID == operationID,
                isCurrent()
            else {
                return nil
            }
            await onFailure(error)
            guard
                !Task.isCancelled,
                activeOperationID == operationID,
                isCurrent()
            else {
                return nil
            }
            errorMessage =
                "Couldn’t save that thought yet. It’s still here so you can try again."
            return nil
        }
    }

    func invalidateOperation() {
        activeOperationID = nil
        isSaving = false
        errorMessage = nil
    }

    private func finish(_ operationID: UUID) {
        guard activeOperationID == operationID else { return }
        activeOperationID = nil
        isSaving = false
    }
}

@Observable @MainActor
final class InboxDataModel {
    private(set) var items: [TaskItem] = []
    private(set) var loading = true
    private var loadGeneration = 0

    func adoptCreated(_ item: TaskItem) {
        loadGeneration += 1
        items.removeAll { $0.id == item.id }
        items.insert(item, at: 0)
        loading = false
    }

    func remove(ids: Set<String>) {
        loadGeneration += 1
        items.removeAll { ids.contains($0.id) }
    }

    func load(
        isCurrent: () -> Bool,
        fetch: () async throws -> [TaskItem],
        onUnauthorized: () async -> Void
    ) async {
        guard !Task.isCancelled, isCurrent() else { return }
        loadGeneration += 1
        let generation = loadGeneration
        do {
            let loaded = try await fetch()
            guard
                generation == loadGeneration,
                !Task.isCancelled,
                isCurrent()
            else {
                return
            }
            items = loaded
        } catch {
            guard
                generation == loadGeneration,
                !Task.isCancelled,
                isCurrent()
            else {
                return
            }
            if AppSessionFailure.classify(error) == .unauthorized {
                await onUnauthorized()
            }
        }
        if generation == loadGeneration, isCurrent() {
            loading = false
        }
    }

    func deletionSnapshot(for indexSet: IndexSet) -> [TaskItem] {
        let snapshot = items
        return indexSet.compactMap { index in
            snapshot.indices.contains(index) ? snapshot[index] : nil
        }
    }

    func delete(
        items selected: [TaskItem],
        isCurrent: () -> Bool,
        delete: (TaskItem) async throws -> Void,
        onUnauthorized: () async -> Void
    ) async {
        guard isCurrent() else { return }
        let selectedIDs = Set(selected.map(\.id))

        for item in selected {
            guard !Task.isCancelled, isCurrent() else { return }
            do {
                try await delete(item)
            } catch {
                guard !Task.isCancelled, isCurrent() else { return }
                if AppSessionFailure.classify(error) == .unauthorized {
                    await onUnauthorized()
                }
                return
            }
        }
        guard !Task.isCancelled, isCurrent() else { return }
        remove(ids: selectedIDs)
    }

    func reset() {
        loadGeneration += 1
        items = []
        loading = true
    }
}

struct InboxView: View {
    @Environment(AppState.self) private var app
    let connectivity: NetworkMonitor.Status

    @State private var data = InboxDataModel()
    @State private var capture = InboxCaptureSubmissionModel()
    @State private var submissionTask: Task<Void, Never>?
    @State private var scheduling: TaskItem?
    @State private var tending = false
    @FocusState private var composing: Bool

    private var pendingItems: [NativeSyncPendingTaskCreate] {
        app.pendingTaskCreates.filter { $0.bucket == "inbox" }
    }

    private var agedItems: [TaskItem] {
        data.items.filter { (Calendar.current.dateComponents([.day], from: $0.createdAt ?? Date(), to: Date()).day ?? 0) >= 7 }
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

                    if data.loading && pendingItems.isEmpty {
                        Spacer()
                        ProgressView().tint(.kIris)
                        Spacer()
                    } else if data.items.isEmpty && pendingItems.isEmpty {
                        ScrollView {
                            VStack(spacing: 10) {
                                Text("🌿").font(.system(size: 40))
                                Text("Inbox is empty")
                                    .font(.kDisplay(20))
                                    .foregroundStyle(Color.kInk)
                                Text("Dump a thought above — head stays clear.")
                                    .font(.kBody(14))
                                    .foregroundStyle(Color.kInkSoft)
                            }
                            .frame(maxWidth: .infinity, minHeight: 360)
                        }
                        .refreshable { await refresh() }
                    } else {
                        List {
                            if !pendingItems.isEmpty {
                                Section {
                                    ForEach(pendingItems) { item in
                                        pendingRow(item)
                                            .listRowBackground(Color.clear)
                                            .listRowSeparator(.hidden)
                                            .listRowInsets(
                                                EdgeInsets(
                                                    top: 5,
                                                    leading: 20,
                                                    bottom: 5,
                                                    trailing: 20
                                                )
                                            )
                                    }
                                } header: {
                                    Text("Saved locally")
                                        .font(.kBody(11, weight: .bold))
                                        .foregroundStyle(Color.kCatButterInk)
                                        .textCase(nil)
                                        .accessibilityAddTraits(.isHeader)
                                }
                            }

                            if !data.items.isEmpty {
                                Section {
                                    ForEach(data.items) { item in
                                        row(item)
                                            .listRowBackground(Color.clear)
                                            .listRowSeparator(.hidden)
                                            .listRowInsets(
                                                EdgeInsets(
                                                    top: 5,
                                                    leading: 20,
                                                    bottom: 5,
                                                    trailing: 20
                                                )
                                            )
                                            .swipeActions(
                                                edge: .leading,
                                                allowsFullSwipe: true
                                            ) {
                                                Button {
                                                    scheduling = item
                                                } label: {
                                                    Label(
                                                        "Schedule",
                                                        systemImage:
                                                            "calendar.badge.plus"
                                                    )
                                                }
                                                .tint(.kIris)
                                            }
                                    }
                                    .onDelete(perform: beginDelete)
                                } header: {
                                    if !pendingItems.isEmpty {
                                        Text("Inbox")
                                            .font(.kBody(11, weight: .bold))
                                            .foregroundStyle(Color.kInkFaint)
                                            .textCase(nil)
                                            .accessibilityAddTraits(.isHeader)
                                    }
                                }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .refreshable { await refresh() }
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
                          onDelete: { item in beginDelete(items: [item]) })
            }
            .sheet(item: $scheduling) { item in
                EditorSheet(
                    date: KTime.dateString(zone: .current),
                    startMin: nextQuarterHour(),
                    initialTitle: item.title,
                    onCreated: {
                        beginDelete(items: [item])
                    }
                )
            }
        }
        .task { await load() }
        .onReceive(
            NotificationCenter.default.publisher(for: .kairoSyncCompleted)
        ) { _ in
            Task { await load() }
        }
        .onChange(of: app.sessionScope) {
            submissionTask?.cancel()
            submissionTask = nil
            capture.invalidateOperation()
            data.reset()
            scheduling = nil
            tending = false
            Task { await load() }
        }
        .onDisappear {
            submissionTask?.cancel()
            submissionTask = nil
            capture.invalidateOperation()
        }
    }

    private var composer: some View {
        @Bindable var capture = capture
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "plus")
                    .foregroundStyle(Color.kInkFaint)
                TextField(
                    "Get it out of your head…",
                    text: $capture.draft
                )
                    .font(.kBody(15, weight: .medium))
                    .focused($composing)
                    .onSubmit { beginAdd() }
                if !capture.draft.isEmpty {
                    Button {
                        beginAdd()
                    } label: {
                        if capture.isSaving {
                            ProgressView()
                                .tint(.kInkInverse)
                                .frame(minWidth: 24)
                        } else {
                            Text("Add")
                                .font(.kBody(13, weight: .bold))
                        }
                    }
                    .foregroundStyle(Color.kInkInverse)
                    .frame(minWidth: 44, minHeight: 44)
                    .padding(.horizontal, 4)
                    .background(Capsule().fill(Color.kIris))
                    .disabled(
                        capture.isSaving
                            || capture.draft.trimmingCharacters(
                                in: .whitespacesAndNewlines
                            ).isEmpty
                    )
                    .accessibilityLabel(
                        capture.isSaving ? "Saving thought" : "Add thought"
                    )
                }
            }
            if let errorMessage = capture.errorMessage {
                Text(errorMessage)
                    .font(.kBody(12, weight: .semibold))
                    .foregroundStyle(Color.kCatRoseInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Save failed. \(errorMessage)")
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

    private func pendingRow(_ item: NativeSyncPendingTaskCreate) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "iphone")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.kCatButterInk)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.kCatButter)
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.kBody(15, weight: .semibold))
                    .foregroundStyle(Color.kInk)
                Text("Saved on this iPhone")
                    .font(.kBody(11, weight: .bold))
                    .foregroundStyle(Color.kCatButterInk)
            }
            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.kCatButter.opacity(0.32))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(
                            Color.kCatButterInk.opacity(0.24),
                            lineWidth: 1
                        )
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(item.title). Pending sync. Saved on this iPhone."
        )
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
        guard let scope = app.sessionScope else { return }
        await data.load(
            isCurrent: { app.sessionScope == scope },
            fetch: { try await KairoAPI.shared.tasks(bucket: "inbox") },
            onUnauthorized: { await app.handleSessionInvalidation() }
        )
    }

    private func refresh() async {
        await app.synchronize()
        await load()
    }

    private func add(scope: String) async {
        guard !Task.isCancelled, app.sessionScope == scope else { return }
        let outcome = await capture.submit(
            isOnline: connectivity == .online,
            isCurrent: { app.sessionScope == scope },
            createOnline: { title in
                try await KairoAPI.shared.createTask(
                    title: title,
                    bucket: "inbox"
                )
            },
            enqueueOffline: { title in
                _ = try await app.enqueueTaskCreate(
                    title: title,
                    bucket: "inbox",
                    scope: scope
                )
            },
            onFailure: { error in
                if AppSessionFailure.classify(error) == .unauthorized {
                    await app.handleSessionInvalidation()
                }
            }
        )
        guard let outcome, app.sessionScope == scope else { return }
        switch outcome {
        case let .created(created):
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                data.adoptCreated(created)
            }
            await load()
        case .queued:
            break
        }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func beginAdd() {
        guard !capture.isSaving, let scope = app.sessionScope else { return }
        submissionTask?.cancel()
        submissionTask = Task { await add(scope: scope) }
    }

    private func beginDelete(_ indexSet: IndexSet) {
        guard let scope = app.sessionScope else { return }
        let selected = data.deletionSnapshot(for: indexSet)
        beginDelete(items: selected, scope: scope)
    }

    private func beginDelete(items: [TaskItem]) {
        guard let scope = app.sessionScope else { return }
        beginDelete(items: items, scope: scope)
    }

    private func beginDelete(items: [TaskItem], scope: String) {
        Task { await delete(items: items, scope: scope) }
    }

    private func delete(items: [TaskItem], scope: String) async {
        guard !Task.isCancelled, app.sessionScope == scope else { return }
        await data.delete(
            items: items,
            isCurrent: { app.sessionScope == scope },
            delete: { item in
                try await KairoAPI.shared.deleteTask(
                    id: item.id,
                    revision: item.revision
                )
            },
            onUnauthorized: { await app.handleSessionInvalidation() }
        )
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
