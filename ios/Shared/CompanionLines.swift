import Foundation

// MARK: - Companion mode (T11 / Round 10) — the presence logic, mirrored.
//
// Must stay identical to src/lib/companion.ts on the web: same lines, same
// 4-minute rotation derived from elapsed time (deterministic — a re-render
// can never flicker the copy), same steady lines for paused and overtime.
// Pinned by KairoUnitTests/CompanionLinesTests against the web's test values.

enum CompanionLines {
    static let rotateMin = 4

    static let running = [
        "Working alongside you — no rush.",
        "Still here. One thing at a time.",
        "Quiet company while you work.",
        "You're not doing this alone.",
        "Here for the whole thing.",
    ]

    static let paused = "Paused together — take your moment."
    static let overtime = "Still with you — wrap up whenever it feels right."

    enum State { case running, paused, overtime }

    static func line(elapsedMin: Int, state: State) -> String {
        switch state {
        case .paused: return paused
        case .overtime: return overtime
        case .running:
            let step = max(0, elapsedMin / rotateMin)
            return running[step % running.count]
        }
    }
}
