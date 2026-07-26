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

    // MARK: Accessibility modes (I1) — parity with the web's Settings → Access.
    //
    // These live in the account's `notificationPrefs` blob server-side (the same
    // keys the web reads), and are cached here so the app renders correctly on
    // launch before the settings request lands — and offline.

    /// Strengthened ink/borders. Also switched on by iOS "Increase Contrast".
    static var highContrast: Bool {
        get { store.bool(forKey: "kairo-high-contrast") }
        set { store.set(newValue, forKey: "kairo-high-contrast") }
    }

    /// Atkinson Hyperlegible in place of Bricolage/Onest.
    static var dyslexiaFont: Bool {
        get { store.bool(forKey: "kairo-dyslexia-font") }
        set { store.set(newValue, forKey: "kairo-dyslexia-font") }
    }

    /// One comfortable step up, on top of whatever Dynamic Type is set to.
    static var largerText: Bool {
        get { store.bool(forKey: "kairo-larger-text") }
        set { store.set(newValue, forKey: "kairo-larger-text") }
    }

    /// Matches `.larger-text body { zoom: 1.125 }` on the web.
    static let largerTextScale: CGFloat = 1.125

    /// "h12" or "h24" — the account's clock format, cached so times render
    /// correctly at launch and offline, before the settings request lands.
    /// Server-side this is a real column (not part of notificationPrefs).
    static var hourCycle: String {
        get { store.string(forKey: "kairo-hour-cycle") ?? "h12" }
        set { store.set(newValue, forKey: "kairo-hour-cycle") }
    }

    static var uses12Hour: Bool { hourCycle != "h24" }

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
    /// A zero-length window means "no quiet hours", never "quiet all day" —
    /// mirrors `inQuietHours` in src/lib/quiet-hours.ts.
    static func inQuietHours(_ hour: Int) -> Bool {
        guard quietHoursEnabled else { return false }
        let s = quietStartHour, e = quietEndHour
        if s == e { return false }
        return s < e ? (hour >= s && hour < e) : (hour >= s || hour < e)
    }
}

// MARK: - Syncing with the account (I1/I2)
//
// Quiet hours and the accessibility modes are one setting per user, not per
// device: `settings.notificationPrefs` holds them and both platforms read the
// same keys. Before this, iOS quiet hours were device-local, so turning them on
// in the web Settings did nothing to iOS reminders and vice versa.

extension KairoPrefs {
    /// Adopt the server's view of the shared prefs. Called after every settings
    /// read; the local copies stay as the offline/launch cache.
    static func adopt(
        notificationPrefs prefs: [String: Any],
        reducedStimulation: Bool,
        hourCycle: String? = nil
    ) {
        self.reducedStimulation = reducedStimulation
        if let hourCycle, hourCycle == "h12" || hourCycle == "h24" {
            self.hourCycle = hourCycle
        }
        highContrast = prefs["highContrast"] as? Bool ?? highContrast
        dyslexiaFont = prefs["dyslexiaFont"] as? Bool ?? dyslexiaFont
        largerText = prefs["largerText"] as? Bool ?? largerText

        if let quiet = prefs["quietHours"] as? [String: Any] {
            quietHoursEnabled = quiet["enabled"] as? Bool ?? quietHoursEnabled
            if let s = quiet["start"] as? Int, (0...23).contains(s) { quietStartHour = s }
            if let e = quiet["end"] as? Int, (0...23).contains(e) { quietEndHour = e }
        }
    }

    /// The blob to PATCH after a local change — merged onto whatever the server
    /// already has so keys this app doesn't know about (intentions, transition
    /// warnings) survive the write.
    static func sharedPrefsPatch(merging existing: [String: Any]) -> [String: Any] {
        var out = existing
        out["highContrast"] = highContrast
        out["dyslexiaFont"] = dyslexiaFont
        out["largerText"] = largerText
        out["quietHours"] = [
            "enabled": quietHoursEnabled,
            "start": quietStartHour,
            "end": quietEndHour,
        ]
        return out
    }
}
