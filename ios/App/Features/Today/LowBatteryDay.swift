import Foundation

/// Per-day, device-local "today I don't have it" switch — mirrors the web's
/// low-battery day (src/components/LowBattery.tsx). When on, high-energy
/// blocks dim with a "heavy" tag (still visible — honesty over hiding) and
/// Pick-for-me prefers lighter options. Never synced, never a server call.
enum LowBatteryDay {
    private static var store: UserDefaults {
        UserDefaults(suiteName: "group.me.neima.kairo") ?? .standard
    }

    private static func key(_ date: String) -> String { "kairo-lowbatt-\(date)" }

    static func isOn(_ date: String) -> Bool {
        store.bool(forKey: key(date))
    }

    static func set(_ date: String, on: Bool) {
        if on { store.set(true, forKey: key(date)) } else { store.removeObject(forKey: key(date)) }
        // App-group suites flush lazily; force it so an immediate app kill
        // (including the UI tour's relaunch) cannot drop the toggle.
        store.synchronize()
    }

    /// Whether a block reads as "heavy" today — same rule as the web timeline.
    static func isHeavy(energy: ActivityEnergy?, done: Bool, lowBattery: Bool) -> Bool {
        lowBattery && energy == .high && !done
    }

    /// Pick-for-me ordering: base kind rank spread out, with high-energy
    /// picks demoted and low-energy picks slightly preferred on low-battery
    /// days — the same preference the web picker applies through weights.
    static func pickRank(baseRank: Int, energy: ActivityEnergy?, lowBattery: Bool) -> Int {
        var rank = baseRank * 10
        guard lowBattery else { return rank }
        if energy == .high { rank += 3 } else if energy == .low { rank -= 1 }
        return rank
    }
}
