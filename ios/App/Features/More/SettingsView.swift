import GoogleSignInSwift
import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var app
    @Environment(\.colorScheme) private var colorScheme
    @State private var remindersOn = KairoPrefs.remindersEnabled
    @State private var permissionDenied = false
    @State private var hourCycle = "h12"
    @State private var weekStart = 0
    @State private var settingsRevision: Int?
    @State private var quietHours = KairoPrefs.quietHoursEnabled
    @State private var healthSyncOn = KairoPrefs.healthSyncEnabled
    @State private var healthSyncBusy = false
    @State private var healthSyncStatus: HealthKitEnableResult?
    @State private var sleepWindDownOn = KairoPrefs.sleepWindDownEnabled
    @State private var sleepWindDownBusy = false
    @State private var sleepWindDownStatus: SleepWindDownEnableResult?
    @State private var appleLink = AppleLinkPresentationModel()
    @State private var appleLinkChallenge: NativeAppleChallenge?
    @State private var preparingAppleLink = false
    @State private var applePreparationError: String?
    @State private var googleLink = GoogleLinkPresentationModel()

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

                    // Access (I1) — the same four modes as the web's Settings →
                    // Access, stored on the account so they follow you across
                    // devices rather than living on this phone.
                    group("Access") {
                        VStack(alignment: .leading, spacing: 0) {
                            a11yToggle(
                                "High contrast",
                                hint: "Stronger ink and visible edges on every surface",
                                isOn: app.highContrast
                            ) { app.setA11y(highContrast: $0) }

                            divider
                            a11yToggle(
                                "Dyslexia-friendly font",
                                hint: "Atkinson Hyperlegible — letters that don't mirror each other",
                                isOn: app.dyslexiaFont
                            ) { app.setA11y(dyslexiaFont: $0) }

                            divider
                            a11yToggle(
                                "Larger text",
                                hint: "Everything one comfortable step up",
                                isOn: app.largerText
                            ) { app.setA11y(largerText: $0) }

                            divider
                            a11yToggle(
                                "Reduced stimulation",
                                hint: "Softer motion and calmer entrances",
                                isOn: app.reducedStimulation
                            ) { app.setA11y(reducedStimulation: $0) }
                        }
                        .padding(16)
                    }

                    group("Formatting") {
                        VStack(alignment: .leading, spacing: 14) {
                            segmented(title: "Time", options: [("h12", "12-hour"), ("h24", "24-hour")],
                                      selected: hourCycle) { v in
                                hourCycle = v
                                // Cache it before the round trip so every time
                                // label re-renders in the new format immediately.
                                KairoPrefs.hourCycle = v
                                app.a11yGeneration += 1
                                Task {
                                    await saveSettings(.init(
                                        hourCycle:
                                            HourCyclePreference(rawValue: v)
                                    ))
                                }
                            }
                            segmented(title: "Week starts", options: [("0", "Sunday"), ("1", "Monday")],
                                      selected: String(weekStart)) { v in
                                weekStart = Int(v) ?? 0
                                Task {
                                    await saveSettings(.init(
                                        weekStart: WeekStart(
                                            rawValue: Int(v) ?? 0
                                        )
                                    ))
                                }
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
                            if remindersOn {
                                Rectangle().fill(Color.kBorder).frame(height: 1).padding(.vertical, 12)
                                // I2: quiet hours are one setting per account, not
                                // per device — the same notificationPrefs.quietHours
                                // the web writes and the server's push delivery reads.
                                Toggle(isOn: Binding(
                                    get: { quietHours },
                                    set: { v in
                                        quietHours = v
                                        KairoPrefs.quietHoursEnabled = v
                                        Task { await app.pushSharedPrefs() }
                                    }
                                )) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Quiet hours").font(.kBody(15, weight: .medium)).foregroundStyle(Color.kInk)
                                        Text("No reminders \(hourText(KairoPrefs.quietStartHour))–\(hourText(KairoPrefs.quietEndHour)) — rest undisturbed · also applies on the web")
                                            .font(.kBody(12.5)).foregroundStyle(Color.kInkSoft)
                                    }
                                }
                                .tint(.kIris)
                            }
                        }
                        .padding(16)
                    }

                    group("Apple Health") {
                        VStack(alignment: .leading, spacing: 10) {
                            Toggle(isOn: Binding(
                                get: { healthSyncOn },
                                set: { setHealthSync($0) }
                            )) {
                                Text("Save focused minutes")
                                    .font(.kBody(15, weight: .medium))
                                    .foregroundStyle(Color.kInk)
                            }
                            .tint(.kIris)
                            .disabled(healthSyncBusy)
                            .accessibilityLabel("Save focused minutes")
                            .accessibilityHint(
                                "With your permission, writes completed focus sessions as mindful minutes. This control never reads Health data."
                            )

                            Text("Writes mindful minutes only. This setting never reads Health data.")
                                .font(.kBody(12.5))
                                .foregroundStyle(Color.kInkSoft)

                            HStack(spacing: 6) {
                                if healthSyncBusy {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(.kIris)
                                }
                                Text(healthSyncMessage)
                                    .font(.kBody(12))
                                    .foregroundStyle(healthSyncOn ? Color.kIris : Color.kInkFaint)
                            }

                            divider

                            Toggle(isOn: Binding(
                                get: { sleepWindDownOn },
                                set: { setSleepWindDown($0) }
                            )) {
                                Text("Sleep-aware wind-down")
                                    .font(.kBody(15, weight: .medium))
                                    .foregroundStyle(Color.kInk)
                            }
                            .tint(.kIris)
                            .disabled(sleepWindDownBusy)
                            .accessibilityLabel("Sleep-aware wind-down")
                            .accessibilityHint(
                                "With your permission, reads recent Sleep Analysis on this iPhone to suggest a wind-down time. Nothing is uploaded."
                            )

                            Text("Reads recent sleep times on this iPhone to suggest when to wind down. Nothing is uploaded.")
                                .font(.kBody(12.5))
                                .foregroundStyle(Color.kInkSoft)

                            HStack(spacing: 6) {
                                if sleepWindDownBusy {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(.kIris)
                                }
                                Text(sleepWindDownMessage)
                                    .font(.kBody(12))
                                    .foregroundStyle(sleepWindDownOn ? Color.kIris : Color.kInkFaint)
                            }
                        }
                        .padding(16)
                    }

                    if appleLink.showsControl || googleLink.showsControl {
                        group("Connected accounts") {
                            VStack(alignment: .leading, spacing: 0) {
                                if appleLink.showsControl {
                                    appleAccountContent
                                }
                                if appleLink.showsControl
                                    && googleLink.showsControl
                                {
                                    Rectangle()
                                        .fill(Color.kBorder)
                                        .frame(height: 1)
                                        .padding(.horizontal, 16)
                                }
                                if googleLink.showsControl {
                                    googleAccountContent
                                }
                            }
                        }
                    }

                    group("Your data") {
                        VStack(spacing: 0) {
                            linkRow("Export or delete on the web", "square.and.arrow.up",
                                    url: "https://time.neima.me/app/settings")
                            divider
                            linkRow("Privacy policy", "hand.raised",
                                    url: "https://time.neima.me/privacy")
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
        .task { await loadAppleLink() }
        .task { await loadGoogleLink() }
    }

    private var appleAccountContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.kIris)
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 11,
                            style: .continuous
                        )
                        .fill(Color.kIrisGhost)
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text("Sign in with Apple")
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(Color.kInk)
                    Text(
                        "Connect Apple only after signing in. Kairo keeps your current planner and never merges accounts silently."
                    )
                    .font(.kBody(12.5))
                    .foregroundStyle(Color.kInkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }

            if appleLink.state == .linked {
                Label(
                    "Apple is connected",
                    systemImage: "checkmark.circle.fill"
                )
                .font(.kBody(13.5, weight: .semibold))
                .foregroundStyle(Color.kSuccess)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(
                        cornerRadius: 13,
                        style: .continuous
                    )
                    .fill(Color.kSuccessSoft)
                )
                .accessibilityIdentifier("settings.apple.linked")
            } else {
                appleLinkControl
            }

            if let message =
                appleLink.errorMessage ?? applePreparationError
            {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Color.kDanger)
                    Text(message)
                        .font(.kBody(12.5))
                        .foregroundStyle(Color.kInkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }

            if appleLink.canRetry || applePreparationError != nil {
                Button("Try Apple connection again") {
                    Task {
                        appleLink.retry()
                        await prepareAppleLink()
                    }
                }
                .font(.kBody(13.5, weight: .semibold))
                .foregroundStyle(Color.kIris)
                .frame(minHeight: 44)
            }
        }
        .padding(16)
    }

    private var googleAccountContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "person.crop.circle.badge.plus")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.kIris)
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 11,
                            style: .continuous
                        )
                        .fill(Color.kIrisGhost)
                    )
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Google")
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(Color.kInk)
                    Text(
                        "Kairo keeps this planner and never merges accounts silently."
                    )
                    .font(.kBody(12.5))
                    .foregroundStyle(Color.kInkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }

            switch googleLink.state {
            case .linked:
                Label(
                    "Google is connected",
                    systemImage: "checkmark.circle.fill"
                )
                .font(.kBody(13.5, weight: .semibold))
                .foregroundStyle(Color.kSuccess)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(
                        cornerRadius: 13,
                        style: .continuous
                    )
                    .fill(Color.kSuccessSoft)
                )
                .accessibilityIdentifier("settings.google.linked")
            case .linking:
                HStack(spacing: 9) {
                    ProgressView().tint(.kIris)
                    Text("Connecting Google securely…")
                        .font(.kBody(13.5, weight: .medium))
                        .foregroundStyle(Color.kInkSoft)
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
                .background(
                    RoundedRectangle(
                        cornerRadius: 14,
                        style: .continuous
                    )
                    .fill(Color.kSurfaceSunken)
                )
                .accessibilityElement(children: .combine)
            default:
                GoogleSignInButton(
                    scheme: colorScheme == .dark ? .dark : .light,
                    style: .wide,
                    state: .normal
                ) {
                    Task { await connectGoogle() }
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
                .contentShape(Rectangle())
                .accessibilityLabel("Connect Google account")
                .accessibilityHint(
                    "Adds Google as a sign-in method without changing or merging this planner."
                )
                .accessibilityIdentifier("settings.google.link")
                .id(colorScheme)
            }

            if let message = googleLink.errorMessage {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Color.kDanger)
                    Text(message)
                        .font(.kBody(12.5))
                        .foregroundStyle(Color.kInkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }

            if googleLink.canRetry {
                Button("Try Google connection again") {
                    googleLink.retry()
                }
                .font(.kBody(13.5, weight: .semibold))
                .foregroundStyle(Color.kIris)
                .frame(minHeight: 44)
            }
        }
        .padding(16)
    }

    @ViewBuilder
    private var appleLinkControl: some View {
        if let appleLinkChallenge {
            AppleSignInControl(
                purpose: .link,
                challenge: appleLinkChallenge,
                disabled: appleLink.state == .linking,
                completion: finishAppleLink
            )
        } else if preparingAppleLink {
            HStack(spacing: 9) {
                ProgressView().tint(.kIris)
                Text("Preparing a secure Apple connection…")
                    .font(.kBody(13.5, weight: .medium))
                    .foregroundStyle(Color.kInkSoft)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.kSurfaceSunken)
            )
            .accessibilityElement(children: .combine)
        }
    }

    private var divider: some View {
        Rectangle().fill(Color.kBorder).frame(height: 1).padding(.vertical, 12)
    }

    /// One Access row. VoiceOver reads the label plus the hint.
    private func a11yToggle(
        _ title: String,
        hint: String,
        isOn: Bool,
        onChange: @escaping (Bool) -> Void
    ) -> some View {
        Toggle(isOn: Binding(get: { isOn }, set: { onChange($0) })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.kBody(15, weight: .medium))
                    .foregroundStyle(Color.kInk)
                Text(hint)
                    .font(.kBody(12.5))
                    .foregroundStyle(Color.kInkSoft)
            }
        }
        .tint(.kIris)
        .accessibilityLabel(title)
        .accessibilityHint(hint)
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
        // Adopt the account's shared prefs too, so opening Settings shows what
        // the web (or another device) last set — not this phone's stale copy.
        await app.adoptSharedPrefs()
        await MainActor.run {
            hourCycle = s.hourCycle ?? "h12"
            KairoPrefs.hourCycle = hourCycle
            weekStart = s.weekStart ?? 0
            settingsRevision = s.revision
            quietHours = KairoPrefs.quietHoursEnabled
        }
    }

    @MainActor
    private func loadAppleLink() async {
#if DEBUG
        if installAppleLinkFixture() {
            return
        }
#endif
        await appleLink.loadAvailability {
            try await KairoAPI.shared.authCapabilities()
        }
        if appleLink.showsControl {
            await prepareAppleLink()
        }
    }

    @MainActor
    private func loadGoogleLink() async {
#if DEBUG
        if installGoogleLinkFixture() {
            return
        }
#endif
        await googleLink.loadAvailability {
            try await KairoAPI.shared.authCapabilities()
        }
    }

    @MainActor
    private func connectGoogle() async {
        let priorScope = app.sessionScope
        let linkedScope = await googleLink.link(
            currentScope: priorScope
        ) {
            let credential = try await GoogleSignInCoordinator().credential()
            try await KairoAPI.shared.googleLink(credential: credential)
        }

        if let linkedScope {
            let currentScope = await KairoAPI.shared.sessionScope()
            guard
                linkedScope == priorScope,
                currentScope == priorScope
            else {
                await app.handleSessionInvalidation()
                return
            }
            UINotificationFeedbackGenerator()
                .notificationOccurred(.success)
        } else if googleLink.state == .sessionRequired {
            await app.handleSessionInvalidation()
        }
    }

    @MainActor
    private func prepareAppleLink() async {
        guard !preparingAppleLink else {
            return
        }
        preparingAppleLink = true
        applePreparationError = nil
        appleLinkChallenge = nil
        do {
            appleLinkChallenge =
                try await KairoAPI.shared.appleChallenge(intent: .link)
        } catch is CancellationError {
            applePreparationError = nil
        } catch let error as APIError {
            applePreparationError = error.errorDescription
        } catch {
            applePreparationError =
                "Apple couldn’t be prepared. Please try again."
        }
        preparingAppleLink = false
    }

    @MainActor
    private func finishAppleLink(
        _ result: Result<AppleIdentityCredential, Error>
    ) async {
        guard let challenge = appleLinkChallenge else {
            return
        }
        let priorScope = app.sessionScope
        let linkedScope = await appleLink.link(
            currentScope: priorScope
        ) {
            let credential = try result.get()
            _ = try await KairoAPI.shared.exchangeAppleCredential(
                intent: .link,
                challenge: challenge,
                idToken: credential.idToken
            )
        }

        if let linkedScope {
            let currentScope = await KairoAPI.shared.sessionScope()
            guard
                linkedScope == priorScope,
                currentScope == priorScope
            else {
                await app.handleSessionInvalidation()
                return
            }
            UINotificationFeedbackGenerator()
                .notificationOccurred(.success)
        } else if appleLink.state == .expired {
            appleLinkChallenge = nil
        } else if appleLink.state == .sessionRequired {
            await app.handleSessionInvalidation()
        }
    }

#if DEBUG
    @MainActor
    private func installAppleLinkFixture() -> Bool {
        let arguments = ProcessInfo.processInfo.arguments
        guard
            let index = arguments.firstIndex(
                of: "-kairoAppleLinkFixture"
            ),
            arguments.indices.contains(index + 1)
        else {
            return false
        }
        switch arguments[index + 1] {
        case "unavailable":
            appleLink.installFixture(state: .unavailable)
        case "linked":
            appleLink.installFixture(state: .linked)
        case "expired":
            appleLink.installFixture(state: .expired)
        default:
            appleLink.installFixture(state: .ready)
            appleLinkChallenge = .init(
                state: "synthetic-link-state",
                nonce: "synthetic-link-nonce",
                expiresAt: Date().addingTimeInterval(3_600)
            )
        }
        return true
    }

    @MainActor
    private func installGoogleLinkFixture() -> Bool {
        let arguments = ProcessInfo.processInfo.arguments
        guard
            let index = arguments.firstIndex(
                of: "-kairoGoogleLinkFixture"
            ),
            arguments.indices.contains(index + 1)
        else {
            return false
        }
        switch arguments[index + 1] {
        case "unavailable":
            googleLink.installFixture(state: .unavailable)
        case "linking":
            googleLink.installFixture(state: .linking)
        case "linked":
            googleLink.installFixture(state: .linked)
        case "error":
            googleLink.installFixture(
                state: .failed(
                    "Google authentication couldn't be completed. Try again."
                )
            )
        default:
            googleLink.installFixture(state: .ready)
        }
        return true
    }
#endif

    private func saveSettings(_ update: SettingsUpdate) async {
        guard let rev = settingsRevision else { return }
        if let updated = try? await KairoAPI.shared.updateSettings(
            update: update,
            revision: rev
        ) {
            await MainActor.run { settingsRevision = updated.revision }
        }
    }

    private func hourText(_ h: Int) -> String {
        if h == 0 { return "midnight" }
        if h == 12 { return "noon" }
        let period = h < 12 ? "am" : "pm"
        let twelve = h % 12 == 0 ? 12 : h % 12
        return "\(twelve)\(period)"
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
            Task { await NotificationManager.cancelActivityReminders() }
        }
    }

    private var healthSyncMessage: String {
        if healthSyncBusy { return "Connecting to Apple Health…" }
        switch healthSyncStatus {
        case .enabled:
            return "Connected · future completed sessions will be saved."
        case .unavailable:
            return "Apple Health isn't available on this device."
        case .denied:
            return "Permission wasn't granted. You can change it in the Health app."
        case .failed:
            return "Apple Health couldn't connect. Nothing changed — try again."
        case .disabled, .none:
            return healthSyncOn
                ? "Connected · future completed sessions will be saved."
                : "Off by default. You choose if Kairo writes anything."
        }
    }

    private func setHealthSync(_ on: Bool) {
        UISelectionFeedbackGenerator().selectionChanged()
        guard on else {
            healthSyncOn = false
            healthSyncStatus = .disabled
            Task { _ = await HealthKitManager.shared.setEnabled(false) }
            return
        }

        healthSyncBusy = true
        healthSyncStatus = nil
        Task {
            let result = await HealthKitManager.shared.setEnabled(true)
            await MainActor.run {
                healthSyncBusy = false
                healthSyncStatus = result
                healthSyncOn = result == .enabled
                if result == .enabled {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } else {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            }
        }
    }

    private var sleepWindDownMessage: String {
        if sleepWindDownBusy { return "Checking your private sleep pattern…" }
        switch sleepWindDownStatus {
        case let .enabled(schedule):
            return "Wind-down around \(clockText(schedule.windDownMinute)) · 45 min before your usual sleep time."
        case let .notificationsOff(schedule):
            return "Pattern ready for \(clockText(schedule.windDownMinute)). Turn on notifications in iOS Settings to get the nudge."
        case let .quietHours(schedule):
            return "Pattern ready for \(clockText(schedule.windDownMinute)). Quiet hours are keeping this time silent."
        case .noPattern:
            return "No recent sleep pattern is available. Health access may be limited, or Kairo may need four nights."
        case .unavailable:
            return "Apple Health isn't available on this device."
        case .failed:
            return "Kairo couldn't refresh your sleep pattern. Nothing was uploaded — try again."
        case .disabled, .none:
            return sleepWindDownOn
                ? "Connected · Kairo will refresh the pattern on this iPhone."
                : "Off by default. You choose if Kairo reads anything."
        }
    }

    private func setSleepWindDown(_ on: Bool) {
        UISelectionFeedbackGenerator().selectionChanged()
        guard on else {
            sleepWindDownOn = false
            sleepWindDownStatus = .disabled
            Task {
                _ = await HealthKitManager.shared.setSleepWindDownEnabled(false)
            }
            return
        }

        sleepWindDownBusy = true
        sleepWindDownStatus = nil
        Task {
            let result = await HealthKitManager.shared.setSleepWindDownEnabled(true)
            await MainActor.run {
                sleepWindDownBusy = false
                sleepWindDownStatus = result
                sleepWindDownOn = KairoPrefs.sleepWindDownEnabled
                UINotificationFeedbackGenerator().notificationOccurred(
                    sleepWindDownOn ? .success : .warning
                )
            }
        }
    }

    private func clockText(_ minute: Int) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        guard let date = calendar.date(from: DateComponents(
            year: 2001,
            month: 1,
            day: 1,
            hour: minute / 60,
            minute: minute % 60
        )) else {
            return "—"
        }

        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = KairoPrefs.uses12Hour ? "h:mm a" : "HH:mm"
        return formatter.string(from: date)
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
