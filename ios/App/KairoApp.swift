import SwiftUI

@main
struct KairoApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .tint(.kIris)
        }
    }
}

// MARK: - App-wide state

@Observable
final class AppState {
    enum Auth { case unknown, signedOut, signedIn }

    var auth: Auth = .unknown
    var timezone: TimeZone = .current
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

struct MainTabs: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "calendar.day.timeline.left") }
            InboxView()
                .tabItem { Label("Inbox", systemImage: "tray") }
            FocusView()
                .tabItem { Label("Focus", systemImage: "timer") }
            MoreView()
                .tabItem { Label("More", systemImage: "square.grid.2x2") }
        }
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
