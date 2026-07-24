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

    /// Local reminders for upcoming activities (T2). Defaults on once the user
    /// grants permission; the toggle lives in Settings.
    static var remindersEnabled: Bool {
        get { store.bool(forKey: "kairo-reminders") }
        set { store.set(newValue, forKey: "kairo-reminders") }
    }

    /// Fire a gentle "time to shift" nudge this many minutes before a block
    /// starts, in addition to the on-time reminder (T4 transition cushion).
    static var transitionLeadMin: Int {
        get {
            let v = store.object(forKey: "kairo-transition-lead") as? Int
            return v ?? 5
        }
        set { store.set(newValue, forKey: "kairo-transition-lead") }
    }

    /// Quiet hours (G6) — suppress reminders that would fire inside this nightly
    /// window. Defaults 22:00–07:00, off until enabled.
    static var quietHoursEnabled: Bool {
        get { store.bool(forKey: "kairo-quiet-enabled") }
        set { store.set(newValue, forKey: "kairo-quiet-enabled") }
    }
    static var quietStartHour: Int {
        get { store.object(forKey: "kairo-quiet-start") as? Int ?? 22 }
        set { store.set(newValue, forKey: "kairo-quiet-start") }
    }
    static var quietEndHour: Int {
        get { store.object(forKey: "kairo-quiet-end") as? Int ?? 7 }
        set { store.set(newValue, forKey: "kairo-quiet-end") }
    }

    /// True if `hour` falls inside the quiet window (handles overnight wrap).
    static func inQuietHours(_ hour: Int) -> Bool {
        guard quietHoursEnabled else { return false }
        let s = quietStartHour, e = quietEndHour
        if s == e { return false }
        return s < e ? (hour >= s && hour < e) : (hour >= s || hour < e)
    }
}
