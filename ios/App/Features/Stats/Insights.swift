import Foundation

// MARK: - Insights derivations (mirrors web src/lib/insights.ts)
// Pure logic for the Reward Garden, Weekly Reflection, and Peak-focus window.
// Kept byte-for-byte behavior-compatible with the web so both platforms tell
// the same story from the same stats.

enum Insights {

    // MARK: Reward Garden — cumulative growth that never resets.

    struct GardenStage {
        let emoji: String
        let name: String
        let at: Int
    }

    static let gardenStages: [GardenStage] = [
        .init(emoji: "🌱", name: "a seed", at: 0),
        .init(emoji: "🌿", name: "a sprout", at: 3),
        .init(emoji: "🪴", name: "growing", at: 8),
        .init(emoji: "🌷", name: "in bloom", at: 16),
        .init(emoji: "🌳", name: "flourishing", at: 32),
    ]

    static let gardenPerBloom = 3
    static let gardenMaxBlooms = 24

    struct GardenState {
        let points: Int
        let stage: GardenStage
        let next: GardenStage?
        let toNext: Int
        let bloomCount: Int
    }

    static func gardenState(totalCompleted: Int, totalFocusMin: Int) -> GardenState {
        let completed = max(0, totalCompleted)
        let focusBlocks = max(0, totalFocusMin / 25)
        let points = completed + focusBlocks

        var idx = 0
        for i in stride(from: gardenStages.count - 1, through: 0, by: -1) where points >= gardenStages[i].at {
            idx = i
            break
        }
        let stage = gardenStages[idx]
        let next = idx + 1 < gardenStages.count ? gardenStages[idx + 1] : nil
        let toNext = next.map { $0.at - points } ?? 0
        let bloomCount = min(gardenMaxBlooms, completed / gardenPerBloom)
        return GardenState(points: points, stage: stage, next: next, toNext: toNext, bloomCount: bloomCount)
    }

    // MARK: Weekly Reflection — gentle patterns, only with enough signal.

    static let weekdays = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"]

    static func hourLabel(_ h: Int) -> String {
        if h == 0 { return "midnight" }
        if h == 12 { return "noon" }
        let period = h < 12 ? "am" : "pm"
        let twelve = h % 12 == 0 ? 12 : h % 12
        return "\(twelve)\(period)"
    }

    /// byDate keyed "YYYY-MM-DD" → completed count. Returns 0–4 warm notes.
    static func reflectionNotes(
        byDate: [String: Int],
        totalCompleted: Int,
        totalFocusMin: Int,
        peakHour: Int?
    ) -> [String] {
        guard totalCompleted >= 3 else { return [] }
        var notes: [String] = []

        var byWeekday = [Int](repeating: 0, count: 7)
        var activeDays = 0
        let cal = Calendar(identifier: .gregorian)
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "UTC")
        for (key, completed) in byDate where completed > 0 {
            activeDays += 1
            if let d = df.date(from: key) {
                let dow = cal.component(.weekday, from: d) - 1 // 0=Sun
                byWeekday[dow] += completed
            }
        }
        if let bestDow = byWeekday.indices.max(by: { byWeekday[$0] < byWeekday[$1] }),
           byWeekday[bestDow] >= 2 {
            notes.append("\(weekdays[bestDow]) tend to be yours — that's where the most got finished.")
        }

        if totalFocusMin >= 25 {
            let h = (Double(totalFocusMin) / 6).rounded() / 10
            let amount = h < 1 ? "\(totalFocusMin) focused minutes" : "\(trimmed(h)) focused hours"
            notes.append("You gave about \(amount) — time you chose to spend on what mattered.")
        }

        if let peak = peakHour {
            notes.append("Your attention lands most around \(hourLabel(peak)). Worth guarding for the hard things.")
        }

        if activeDays >= 4 {
            notes.append("You showed up on \(activeDays) different days. Consistency, the forgiving kind.")
        }

        return notes
    }

    private static func trimmed(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }

    // MARK: Peak-focus window.

    static let peakMinSessions = 4

    static func focusSessionCount(_ hours: [Int]?) -> Int {
        (hours ?? []).reduce(0, +)
    }

    static func isInPeakWindow(nowHour: Int, peakHour: Int) -> Bool {
        abs(nowHour - peakHour) <= 1
    }
}
