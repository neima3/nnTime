import SwiftUI
import UIKit

@main
struct KairoApp: App {
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
        }
    }
}

// MARK: - App-wide state

@Observable
final class AppState {
    enum Auth { case unknown, signedOut, signedIn }

    var auth: Auth = .unknown
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
            let raw = try await KairoAPI.shared.settingsRaw()
            let existing = raw["notificationPrefs"] as? [String: Any] ?? [:]
            let revision = raw["revision"] as? Int ?? 1
            let merged = KairoPrefs.sharedPrefsPatch(merging: existing)
            _ = try await KairoAPI.shared.updateSettings(
                patch: ["notificationPrefs": merged, "reducedStimulation": reducedStimulation],
                revision: revision)
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

    func bootstrap() async {
        // The local cache may predate a change made on the web, so apply what we
        // have first (no flash of the wrong surfaces), then reconcile.
        applyContrastOverride()
        do {
            let settings = try await KairoAPI.shared.settings()
            timezone = TimeZone(identifier: settings.timezone) ?? .current
            await adoptSharedPrefs()
            await loadCategories()
            auth = .signedIn
        } catch {
            auth = .signedOut
        }
    }

    /// Pull the account's shared prefs (accessibility modes + quiet hours) and
    /// adopt them — this is what makes a change made on the web show up here.
    func adoptSharedPrefs() async {
        guard let raw = try? await KairoAPI.shared.settingsRaw() else { return }
        let prefs = raw["notificationPrefs"] as? [String: Any] ?? [:]
        let reduced = raw["reducedStimulation"] as? Bool ?? reducedStimulation
        KairoPrefs.adopt(
            notificationPrefs: prefs,
            reducedStimulation: reduced,
            hourCycle: raw["hourCycle"] as? String)
        highContrast = KairoPrefs.highContrast
        dyslexiaFont = KairoPrefs.dyslexiaFont
        largerText = KairoPrefs.largerText
        reducedStimulation = KairoPrefs.reducedStimulation
        applyContrastOverride()
        a11yGeneration += 1
    }

    func loadCategories() async {
        struct Category: Decodable { let id: String; let key: String }
        struct CategoryPage: Decodable { let items: [Category] }
        // Lightweight direct fetch; failures just mean default colors.
        do {
            var req = URLRequest(url: KairoAPI.shared.baseURL.appending(path: "/api/v1/categories"))
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let (data, _) = try await URLSession.shared.data(for: req)
            let page = try JSONDecoder().decode(CategoryPage.self, from: data)
            var map: [String: KairoCategory] = [:]
            var byKey: [String: String] = [:]
            for c in page.items {
                if let cat = KairoCategory(rawValue: c.key) { map[c.id] = cat }
                byKey[c.key] = c.id
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
        await KairoAPI.shared.signOut()
        auth = .signedOut
    }
}

// MARK: - Root: auth gate → tabs

struct RootView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        Group {
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
                SignInView()
            case .signedIn:
                MainTabs()
            }
        }
        .task { await app.bootstrap() }
    }
}

extension Notification.Name {
    /// Posted from a block's context menu: switch to Focus prefilled.
    static let kairoStartFocus = Notification.Name("kairoStartFocus")
    /// Posted after a bulk change (onboarding) so Today reloads.
    static let kairoDayChanged = Notification.Name("kairoDayChanged")
}

struct MainTabs: View {
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
                    Text("Offline — your day is cached; changes sync when you're back.")
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
