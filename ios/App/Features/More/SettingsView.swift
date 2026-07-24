import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var app
    @State private var remindersOn = KairoPrefs.remindersEnabled
    @State private var permissionDenied = false
    @State private var hourCycle = "h12"
    @State private var weekStart = 0
    @State private var settingsRevision: Int?

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    group("Appearance") {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Theme")
                                .font(.kBody(14, weight: .semibold))
                                .foregroundStyle(Color.kInk)
                            HStack(spacing: 8) {
                                ForEach(KairoPrefs.Theme.allCases) { theme in
                                    Button {
                                        app.theme = theme
                                        KairoPrefs.theme = theme
                                        UISelectionFeedbackGenerator().selectionChanged()
                                    } label: {
                                        Text(theme.label)
                                            .font(.kBody(13, weight: .semibold))
                                            .foregroundStyle(app.theme == theme ? Color.kIris : Color.kInkSoft)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 11)
                                            .background(
                                                RoundedRectangle(cornerRadius: 12)
                                                    .fill(app.theme == theme ? Color.kIrisSoft : Color.kSurface)
                                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(app.theme == theme ? Color.kIris : Color.kBorder, lineWidth: 1))
                                            )
                                    }
                                }
                            }
                        }
                        .padding(16)
                    }

                    group("Comfort") {
                        Toggle(isOn: Binding(
                            get: { app.reducedStimulation },
                            set: { v in app.reducedStimulation = v; KairoPrefs.reducedStimulation = v }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Reduced stimulation")
                                    .font(.kBody(15, weight: .medium))
                                    .foregroundStyle(Color.kInk)
                                Text("Softer motion and calmer entrances")
                                    .font(.kBody(12.5))
                                    .foregroundStyle(Color.kInkSoft)
                            }
                        }
                        .tint(.kIris)
                        .padding(16)
                    }

                    group("Formatting") {
                        VStack(alignment: .leading, spacing: 14) {
                            segmented(title: "Time", options: [("h12", "12-hour"), ("h24", "24-hour")],
                                      selected: hourCycle) { v in
                                hourCycle = v
                                Task { await saveSettings(["hourCycle": v]) }
                            }
                            segmented(title: "Week starts", options: [("0", "Sunday"), ("1", "Monday")],
                                      selected: String(weekStart)) { v in
                                weekStart = Int(v) ?? 0
                                Task { await saveSettings(["weekStart": Int(v) ?? 0]) }
                            }
                        }
                        .padding(16)
                    }

                    group("Reminders") {
                        VStack(alignment: .leading, spacing: 0) {
                            Toggle(isOn: Binding(
                                get: { remindersOn },
                                set: { v in setReminders(v) }
                            )) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Gentle activity reminders")
                                        .font(.kBody(15, weight: .medium))
                                        .foregroundStyle(Color.kInk)
                                    Text("A nudge a few minutes before each block, and when it starts")
                                        .font(.kBody(12.5))
                                        .foregroundStyle(Color.kInkSoft)
                                }
                            }
                            .tint(.kIris)
                            if permissionDenied {
                                Text("Notifications are off for Kairo in iOS Settings. Turn them on there to get reminders.")
                                    .font(.kBody(12))
                                    .foregroundStyle(Color.kInkFaint)
                                    .padding(.top, 10)
                            }
                        }
                        .padding(16)
                    }

                    group("Your data") {
                        VStack(spacing: 0) {
                            linkRow("Export or delete on the web", "square.and.arrow.up",
                                    url: "https://time.neima.me/app/settings")
                        }
                    }

                    Button {
                        Task { await app.signOut() }
                    } label: {
                        Text("Sign out")
                            .font(.kBody(15, weight: .semibold))
                            .foregroundStyle(Color.kInkSoft)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .kCard(radius: 18)

                    Text("Kairo for iOS · 1.0")
                        .font(.kBody(12))
                        .foregroundStyle(Color.kInkFaint)
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Settings").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
            }
        }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .task { await loadSettings() }
    }

    private func segmented(title: String, options: [(String, String)], selected: String, onPick: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
            HStack(spacing: 8) {
                ForEach(options, id: \.0) { opt in
                    Button {
                        UISelectionFeedbackGenerator().selectionChanged()
                        onPick(opt.0)
                    } label: {
                        Text(opt.1)
                            .font(.kBody(13, weight: .semibold))
                            .foregroundStyle(selected == opt.0 ? Color.kIris : Color.kInkSoft)
                            .frame(maxWidth: .infinity).padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(selected == opt.0 ? Color.kIrisSoft : Color.kSurface)
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected == opt.0 ? Color.kIris : Color.kBorder, lineWidth: 1))
                            )
                    }
                }
            }
        }
    }

    private func loadSettings() async {
        guard let s = try? await KairoAPI.shared.settings() else { return }
        await MainActor.run {
            hourCycle = s.hourCycle ?? "h12"
            weekStart = s.weekStart ?? 0
            settingsRevision = s.revision
        }
    }

    private func saveSettings(_ patch: [String: Any?]) async {
        guard let rev = settingsRevision else { return }
        if let updated = try? await KairoAPI.shared.updateSettings(patch: patch, revision: rev) {
            await MainActor.run { settingsRevision = updated.revision }
        }
    }

    private func setReminders(_ on: Bool) {
        UISelectionFeedbackGenerator().selectionChanged()
        if on {
            Task {
                let granted = await NotificationManager.requestAuthorization()
                await MainActor.run {
                    if granted {
                        remindersOn = true
                        permissionDenied = false
                        KairoPrefs.remindersEnabled = true
                    } else {
                        remindersOn = false
                        permissionDenied = true
                        KairoPrefs.remindersEnabled = false
                    }
                }
            }
        } else {
            remindersOn = false
            KairoPrefs.remindersEnabled = false
            NotificationManager.cancelAll()
        }
    }

    private func group(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.kBody(12, weight: .bold)).kerning(1.1)
                .foregroundStyle(Color.kInkSoft)
                .padding(.leading, 4)
            content().frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
        }
    }

    private func linkRow(_ title: String, _ icon: String, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kIris)
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 9).fill(Color.kIrisGhost))
                Text(title).font(.kBody(15, weight: .medium)).foregroundStyle(Color.kInk)
                Spacer()
                Image(systemName: "arrow.up.right").font(.system(size: 12)).foregroundStyle(Color.kInkFaint)
            }
            .padding(.horizontal, 14).padding(.vertical, 13)
        }
    }
}
