import Foundation
#if canImport(ActivityKit)
import ActivityKit

// MARK: - Focus timer Live Activity contract (app requests, widget renders)

struct FocusAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Wall-clock end of the session (drives the self-ticking timer text).
        var endDate: Date
        var paused: Bool
        /// Remaining seconds frozen at pause time (shown while paused).
        var pausedRemainingSec: Int
        /// Past the target and still going — digits switch to the now color.
        var overtime: Bool
    }

    var title: String
    var emoji: String
    var targetMin: Int
    var sessionId: String
}
#endif
