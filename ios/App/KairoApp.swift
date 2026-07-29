import SwiftUI
import UIKit

@main
struct KairoApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var appState = AppState()

    init() {
        if ProcessInfo.processInfo.arguments.contains("-kairoResetOnboarding") {
            KairoPrefs.hasOnboarded = false
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .tint(.kIris)
                .preferredColorScheme(appState.colorScheme)
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active,
                          KairoPrefs.sleepWindDownEnabled else { return }
                    Task {
                        _ = await HealthKitManager.shared.refreshSleepWindDown()
                    }
                }
        }
    }
}

// MARK: - App-wide state

// Main-actor isolated on purpose: this class mutates UIKit (window trait
// overrides) and SwiftUI-observed state. Before this, `bootstrap()` was
// nonisolated-async, so `applyContrastOverride()` could touch
// `window.traitOverrides` off the main thread — a latent race since I1 that
// began crashing at launch (UIKit commit-timing assertion) the moment R11's
// HealthKit framework link shifted startup timing.
@Observable @MainActor
final class AppState {
    enum Auth { case unknown, signedOut, signedIn, connectionRequired }

    var auth: Auth = .unknown
    var sessionScope: String?
    var offlineReadOnly = false
    var timezone: TimeZone = .current
    var theme: KairoPrefs.Theme = KairoPrefs.theme
    var reducedStimulation: Bool = KairoPrefs.reducedStimulation

    // MARK: Accessibility modes (I1)
    //
    // Mirrors the web's Settings → Access. Seeded from the local cache so launch
    // renders correctly offline, then reconciled with the account in bootstrap().
    var highContrast: Bool = KairoPrefs.highContrast
    var dyslexiaFont: Bool = KairoPrefs.dyslexiaFont
    var largerText: Bool = KairoPrefs.largerText

    /// Bumped whenever a mode changes, so views that cache fonts re-render.
    var a11yGeneration: Int = 0

    /// Apply one mode: persist it, force UIKit to re-resolve the colour tokens
    /// (high contrast rides `accessibilityContrast`, so overriding the trait is
    /// what makes the in-app toggle behave like iOS "Increase Contrast"), and
    /// nudge SwiftUI to rebuild.
    func setA11y(
        highContrast hc: Bool? = nil,
        dyslexiaFont dys: Bool? = nil,
        largerText larger: Bool? = nil,
        reducedStimulation reduced: Bool? = nil
    ) {
        if let hc { highContrast = hc; KairoPrefs.highContrast = hc }
        if let dys { dyslexiaFont = dys; KairoPrefs.dyslexiaFont = dys }
        if let larger { largerText = larger; KairoPrefs.largerText = larger }
        if let reduced { reducedStimulation = reduced; KairoPrefs.reducedStimulation = reduced }
        applyContrastOverride()
        a11yGeneration += 1
        Task { await pushSharedPrefs() }
    }

    /// iOS 17+ trait override — switches contrast in-app without every view
    /// knowing the mode exists. Nil-ing it hands control back to the OS setting,
    /// so someone with system Increase Contrast on keeps it.
    func applyContrastOverride() {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        for scene in scenes {
            for window in scene.windows {
                if highContrast {
                    window.traitOverrides.accessibilityContrast = .high
                } else {
                    // Removing (not setting .unspecified) is what hands control
                    // back to the OS, so system Increase Contrast still wins.
                    window.traitOverrides.remove(UITraitAccessibilityContrast.self)
                }
            }
        }
    }

    /// PATCH the shared prefs so the web sees the same modes. Merges onto the
    /// server's current blob so keys this app doesn't model are preserved.
    func pushSharedPrefs() async {
        do {
            let settings = try await KairoAPI.shared.settings()
            var merged = settings.notificationPrefs ?? [:]
            merged["highContrast"] = .boolean(KairoPrefs.highContrast)
            merged["dyslexiaFont"] = .boolean(KairoPrefs.dyslexiaFont)
            merged["largerText"] = .boolean(KairoPrefs.largerText)
            merged["quietHours"] = .object([
                "enabled": .boolean(KairoPrefs.quietHoursEnabled),
                "start": .integer(KairoPrefs.quietStartHour),
                "end": .integer(KairoPrefs.quietEndHour),
            ])
            _ = try await KairoAPI.shared.updateSettings(
                update: .init(
                    reducedStimulation: reducedStimulation,
                    notificationPrefs: merged
                ),
                revision: settings.revision
            )
        } catch {
            // Offline or a revision conflict — the local cache still holds, and
            // the next successful settings read reconciles.
        }
    }

    var colorScheme: ColorScheme? {
        switch theme {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
    /// categoryId → semantic key, fetched once per session.
    var categoryMap: [String: KairoCategory] = [:]
    /// semantic key → categoryId, for creating activities with the right color.
    var categoryIdByKey: [String: String] = [:]
    private var authGeneration = 0

    func bootstrap() async {
        authGeneration += 1
        let generation = authGeneration
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains(
            "-kairoSignedOutFixture"
        ) {
            let arguments = ProcessInfo.processInfo.arguments
            if let index = arguments.firstIndex(
                of: "-kairoThemeFixture"
            ), arguments.indices.contains(index + 1),
               let fixtureTheme = KairoPrefs.Theme(
                   rawValue: arguments[index + 1]
               )
            {
                theme = fixtureTheme
            }
            auth = .signedOut
            return
        }
        if ProcessInfo.processInfo.arguments.contains(
            "-kairoOfflineFixture"
        ) {
            installOfflineFixture()
            return
        }
#endif
        // The local cache may predate a change made on the web, so apply what we
        // have first (no flash of the wrong surfaces), then reconcile.
        applyContrastOverride()
        var restoredScope: String?
        do {
            restoredScope = try await KairoAPI.shared.restoreSession()
        } catch {
            restoredScope = nil
        }
        guard generation == authGeneration else { return }
        let cached = matchingCache(scope: restoredScope)
        do {
            let settings = try await KairoAPI.shared.settings()
            guard generation == authGeneration else { return }
            if restoredScope == nil {
                restoredScope =
                    try? await KairoAPI.shared
                        .persistCurrentSession().scope
            }
            guard generation == authGeneration else { return }
            timezone = TimeZone(identifier: settings.timezone) ?? .current
            adopt(settings)
            await loadCategories()
            guard generation == authGeneration else { return }
            sessionScope = restoredScope
            offlineReadOnly = false
            auth = .signedIn
        } catch {
            guard generation == authGeneration else { return }
            await apply(
                AppSessionPolicy.decide(
                    scope: restoredScope,
                    hasMatchingCache: cached != nil,
                    failure: AppSessionFailure.classify(error)
                ),
                cached: cached
            )
        }
    }

#if DEBUG
    private func installOfflineFixture() {
        let scope = "synthetic-offline-account"
        let date = KTime.dateString(Date(), zone: timezone)
        DayCache.write(
            scope: scope,
            date: date,
            zone: timezone.identifier,
            blocks: [
                CachedBlock(
                    title: "Protected focus block",
                    emoji: "🧠",
                    startMin: 9 * 60,
                    durationMin: 45,
                    done: false,
                    category: "lilac",
                    activityId: "synthetic-activity",
                    revision: 1
                ),
                CachedBlock(
                    title: "Gentle reset",
                    emoji: "🌿",
                    startMin: 10 * 60,
                    durationMin: 20,
                    done: true,
                    category: "sage",
                    activityId: "synthetic-reset",
                    revision: 1
                ),
            ]
        )
        sessionScope = scope
        offlineReadOnly = true
        auth = .signedIn
    }
#endif

    private func matchingCache(
        scope: String?
    ) -> DayCache.Snapshot? {
        guard
            let scope,
            let snapshot = DayCache.readLatest(),
            snapshot.scope == scope,
            let zone = TimeZone(identifier: snapshot.zone),
            snapshot.date == KTime.dateString(Date(), zone: zone)
        else {
            return nil
        }
        return snapshot
    }

    private func apply(
        _ decision: AppSessionDecision,
        cached: DayCache.Snapshot?
    ) async {
        switch decision {
        case let .signedInOnline(scope):
            sessionScope = scope
            offlineReadOnly = false
            auth = .signedIn
        case let .signedInOffline(scope):
            sessionScope = scope
            offlineReadOnly = true
            if let cached,
               let zone = TimeZone(identifier: cached.zone)
            {
                timezone = zone
            }
            auth = .signedIn
        case .signedOut:
            await purgeLocalState()
            auth = .signedOut
        case let .connectionRequired(scope):
            sessionScope = scope
            offlineReadOnly = false
            auth = .connectionRequired
        case .unchanged:
            break
        }
    }

    /// Pull the account's shared prefs (accessibility modes + quiet hours) and
    /// adopt them — this is what makes a change made on the web show up here.
    func adoptSharedPrefs() async {
        guard let settings = try? await KairoAPI.shared.settings() else {
            return
        }
        adopt(settings)
    }

    private func adopt(_ settings: UserSettings) {
        let prefs = settings.notificationPrefs ?? [:]
        KairoPrefs.adopt(
            notificationPrefs: prefs.foundationObject,
            reducedStimulation:
                settings.reducedStimulation ?? reducedStimulation,
            hourCycle: settings.hourCycle
        )
        highContrast = KairoPrefs.highContrast
        dyslexiaFont = KairoPrefs.dyslexiaFont
        largerText = KairoPrefs.largerText
        reducedStimulation = KairoPrefs.reducedStimulation
        applyContrastOverride()
        a11yGeneration += 1
    }

    func loadCategories() async {
        do {
            let categories = try await KairoAPI.shared.categories()
            var map: [String: KairoCategory] = [:]
            var byKey: [String: String] = [:]
            for category in categories {
                if let value = KairoCategory(rawValue: category.key) {
                    map[category.id] = value
                }
                byKey[category.key] = category.id
            }
            categoryMap = map
            categoryIdByKey = byKey
        } catch {
            categoryMap = [:]
            categoryIdByKey = [:]
        }
    }

    func category(for id: String?) -> KairoCategory {
        guard let id, let cat = categoryMap[id] else { return .sky }
        return cat
    }

    func signOut() async {
        authGeneration += 1
        await KairoAPI.shared.signOut()
        await purgeLocalState()
        auth = .signedOut
    }

    func handleSessionInvalidation() async {
        authGeneration += 1
        await KairoAPI.shared.invalidateSession()
        await purgeLocalState()
        auth = .signedOut
    }

    func prepareForAccountSwitch(newScope: String) async {
        authGeneration += 1
        await purgeLocalState()
        sessionScope = newScope
    }

    func beginAuthCallback() {
        authGeneration += 1
    }

    func finishAuthCallbackFailure() {
        guard case .signedIn = auth else {
            auth = .signedOut
            return
        }
    }

    private func purgeLocalState() async {
        DayCache.clear()
        URLCache.shared.removeAllCachedResponses()
        await NotificationManager.cancelActivityReminders()
        KairoPrefs.clearAccountState()
        sessionScope = nil
        offlineReadOnly = false
        timezone = .current
        theme = KairoPrefs.theme
        reducedStimulation = KairoPrefs.reducedStimulation
        highContrast = KairoPrefs.highContrast
        dyslexiaFont = KairoPrefs.dyslexiaFont
        largerText = KairoPrefs.largerText
        categoryMap = [:]
        categoryIdByKey = [:]
        applyContrastOverride()
        a11yGeneration += 1
    }
}

// MARK: - Root: auth gate → tabs

struct RootView: View {
    @Environment(AppState.self) private var app
    @State private var authCoordinator = NativeAuthCoordinator()

    var body: some View {
        Group {
            if authCoordinator.phase == .verifying {
                AuthVerificationView()
            } else {
                switch app.auth {
                case .unknown:
                    ZStack {
                        Color.kCanvas.ignoresSafeArea()
                        VStack(spacing: 14) {
                            KairoMark(size: 56)
                            ProgressView().tint(.kIris)
                        }
                    }
                case .signedOut:
                    SignInView(
                        externalError: authCoordinator.failureMessage
                    )
                case .signedIn:
                    MainTabs()
                case .connectionRequired:
                    ConnectionRequiredView()
                }
            }
        }
        .task {
#if DEBUG
            if let fixture = Self.authCallbackFixture {
                await routeAuthCallback(fixture.url, fixture: fixture.kind)
                return
            }
#endif
            await app.bootstrap()
        }
        .onOpenURL { url in
            Task { await routeAuthCallback(url) }
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            guard let url = activity.webpageURL else {
                return
            }
            Task { await routeAuthCallback(url) }
        }
        .onReceive(
            NotificationCenter.default.publisher(
                for: .kairoSessionInvalidated
            )
        ) { _ in
            Task { await app.handleSessionInvalidation() }
        }
        .alert(
            "We couldn’t finish signing you in",
            isPresented: Binding(
                get: {
                    authCoordinator.failureMessage != nil
                        && app.isSignedIn
                },
                set: { presented in
                    if !presented {
                        authCoordinator.dismissFailure()
                    }
                }
            )
        ) {
            Button("OK") {
                authCoordinator.dismissFailure()
            }
        } message: {
            Text(
                authCoordinator.failureMessage
                    ?? "Request a new link and try again."
            )
        }
    }

    @MainActor
    private func routeAuthCallback(
        _ url: URL,
        fixture: AuthCallbackFixtureKind? = nil
    ) async {
        guard AuthCallback.parse(url) != nil else {
            return
        }
        app.beginAuthCallback()
        let outcome = await authCoordinator.handle(
            url,
            currentScope: app.sessionScope,
            redeem: { token in
#if DEBUG
                if let fixture {
                    try await Task.sleep(nanoseconds: 2_500_000_000)
                    switch fixture {
                    case .success:
                        return .init(
                            scope: "synthetic-callback-account",
                            replacedScope: nil
                        )
                    case .failure:
                        throw APIError.authHTTP(
                            400,
                            "This sign-in link has expired. Request a new link and try again."
                        )
                    }
                }
#endif
                return try await KairoAPI.shared.redeemMagicLink(
                    token: token
                )
            },
            prepareForAccountSwitch: { scope in
                await app.prepareForAccountSwitch(newScope: scope)
            },
            bootstrap: {
                await app.bootstrap()
            }
        )
        if outcome == .failed {
            app.finishAuthCallbackFailure()
        }
    }

#if DEBUG
    private enum AuthCallbackFixtureKind: String {
        case success
        case failure
    }

    private struct AuthCallbackFixture {
        let kind: AuthCallbackFixtureKind
        let url: URL
    }

    private static var authCallbackFixture: AuthCallbackFixture? {
        let arguments = ProcessInfo.processInfo.arguments
        guard
            let index = arguments.firstIndex(
                of: "-kairoAuthCallbackFixture"
            ),
            arguments.indices.contains(index + 1),
            let kind = AuthCallbackFixtureKind(
                rawValue: arguments[index + 1]
            )
        else {
            return nil
        }
        return .init(
            kind: kind,
            url: URL(string: "kairo://auth?token=synthetic-fixture")!
        )
    }
#else
    private typealias AuthCallbackFixtureKind = Never
#endif
}

private extension AppState {
    var isSignedIn: Bool {
        if case .signedIn = auth {
            return true
        }
        return false
    }
}

private struct AuthVerificationView: View {
    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack(spacing: 18) {
                KairoMark(size: 56)
                ProgressView()
                    .tint(.kIris)
                    .controlSize(.large)
                VStack(spacing: 6) {
                    Text("Finishing your sign-in")
                        .font(.kDisplay(24, relativeTo: .title))
                        .foregroundStyle(Color.kInk)
                    Text("Securing your planner on this device…")
                        .font(.kBody(14.5))
                        .foregroundStyle(Color.kInkSoft)
                }
            }
            .padding(28)
            .frame(maxWidth: 420)
            .kCard(radius: 28)
            .padding(20)
        }
        .accessibilityIdentifier("auth.callback.verifying")
    }
}

private struct ConnectionRequiredView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(Color.kIris)
                    .frame(width: 58, height: 58)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 18,
                            style: .continuous
                        )
                        .fill(Color.kIrisSoft)
                    )
                VStack(spacing: 7) {
                    Text("Kairo needs a connection")
                        .font(.kDisplay(24, relativeTo: .title))
                        .foregroundStyle(Color.kInk)
                    Text(
                        "We couldn't safely restore this planner yet. Reconnect and try again—your account has not been signed out."
                    )
                    .font(.kBody(14.5))
                    .foregroundStyle(Color.kInkSoft)
                    .multilineTextAlignment(.center)
                }
                Button {
                    Task { await app.bootstrap() }
                } label: {
                    Text("Try again")
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(Color.kInkInverse)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 13)
                        .background(Capsule().fill(Color.kIris))
                }
                Button("Use another account") {
                    Task { await app.signOut() }
                }
                .font(.kBody(14, weight: .semibold))
                .foregroundStyle(Color.kInkSoft)
            }
            .padding(28)
            .frame(maxWidth: 420)
            .kCard(radius: 28)
            .padding(20)
        }
    }
}

extension Notification.Name {
    /// Posted from a block's context menu: switch to Focus prefilled.
    static let kairoStartFocus = Notification.Name("kairoStartFocus")
    /// Posted after a bulk change (onboarding) so Today reloads.
    static let kairoDayChanged = Notification.Name("kairoDayChanged")
}

struct MainTabs: View {
    @Environment(AppState.self) private var app
    @State private var selection = 0
    @State private var showOnboarding = !KairoPrefs.hasOnboarded
        && !ProcessInfo.processInfo.arguments.contains("-kairoSkipOnboarding")
    @State private var net = NetworkMonitor()

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selection) {
                TodayView()
                    .tabItem { Label("Today", systemImage: "calendar.day.timeline.left") }
                    .tag(0)
                InboxView()
                    .tabItem { Label("Inbox", systemImage: "tray") }
                    .tag(1)
                WeekView()
                    .tabItem { Label("Week", systemImage: "calendar") }
                    .tag(2)
                FocusView()
                    .tabItem { Label("Focus", systemImage: "timer") }
                    .tag(3)
                MoreView()
                    .tabItem { Label("More", systemImage: "square.grid.2x2") }
                    .tag(4)
            }
            .onReceive(NotificationCenter.default.publisher(for: .kairoStartFocus)) { _ in
                selection = 3
            }
            .onReceive(NotificationCenter.default.publisher(for: .kairoDayChanged)) { _ in
                selection = 0
            }
            .onOpenURL { url in
                switch url.host {
                case "focus": selection = 3
                case "inbox": selection = 1
                default: selection = 0
                }
            }
            .sheet(isPresented: $showOnboarding) {
                OnboardingSheet {
                    selection = 0
                    NotificationCenter.default.post(name: .kairoDayChanged, object: nil)
                }
                .presentationDetents([.large])
            }

            if !net.isOnline {
                HStack(spacing: 7) {
                    Image(systemName: "wifi.slash").font(.system(size: 12, weight: .semibold))
                    Text(
                        app.offlineReadOnly
                            ? "Offline — showing a saved, read-only day."
                            : "Offline — reconnect to refresh your day."
                    )
                        .font(.kBody(12, weight: .semibold))
                        .lineLimit(2)
                }
                .foregroundStyle(Color.kCatButterInk)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Color.kCatButter)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: net.isOnline)
    }
}

/// The ◔ brand mark as a drawn glyph (crisp at any size).
struct KairoMark: View {
    var size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(Color.kIris)
            Text("◔")
                .font(.system(size: size * 0.5))
                .foregroundStyle(Color.kInkInverse)
        }
        .frame(width: size, height: size)
        .kCardShadow()
    }
}
