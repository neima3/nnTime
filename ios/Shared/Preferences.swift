import Foundation

// MARK: - Lightweight app-group preferences (theme, reduced stimulation,
// onboarding-seen). Falls back to standard defaults on the simulator where
// the group container isn't provisioned.

enum KairoPrefs {
    private static var store: UserDefaults {
        UserDefaults(suiteName: "group.me.neima.kairo") ?? .standard
    }

    enum Theme: String, CaseIterable, Identifiable {
        case system, light, dark
        var id: String { rawValue }
        var label: String {
            switch self {
            case .system: "System"
            case .light: "Light"
            case .dark: "Dark"
            }
        }
    }

    static var theme: Theme {
        get { Theme(rawValue: store.string(forKey: "kairo-theme") ?? "system") ?? .system }
        set { store.set(newValue.rawValue, forKey: "kairo-theme") }
    }

    static var reducedStimulation: Bool {
        get { store.bool(forKey: "kairo-reduced-stim") }
        set { store.set(newValue, forKey: "kairo-reduced-stim") }
    }

    static var hasOnboarded: Bool {
        get { store.bool(forKey: "kairo-onboarded") }
        set { store.set(newValue, forKey: "kairo-onboarded") }
    }
}
