import SwiftUI

@main
struct KairoApp: App {
    @State private var appState = AppState()

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

    var colorScheme: ColorScheme? {
        switch theme {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
    /// categoryId → semantic key, fetched once per session.
    var categoryMap: [String: KairoCategory] = [:]

    func bootstrap() async {
        do {
            let settings = try await KairoAPI.shared.settings()
            timezone = TimeZone(identifier: settings.timezone) ?? .current
            await loadCategories()
            auth = .signedIn
        } catch {
            auth = .signedOut
        }
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
            for c in page.items {
                if let cat = KairoCategory(rawValue: c.key) { map[c.id] = cat }
            }
            categoryMap = map
        } catch {
            categoryMap = [:]
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
