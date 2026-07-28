import XCTest
@testable import Kairo

/// Pins the iOS companion to the web's contract (src/lib/companion.ts +
/// companion.test.ts): same lines, same 4-minute rotation, same steady
/// paused/overtime lines. If the web copy changes, this fails on purpose.
final class CompanionLinesTests: XCTestCase {
    func testFirstLineMatchesWeb() {
        XCTAssertEqual(
            CompanionLines.line(elapsedMin: 0, state: .running),
            "Working alongside you — no rush."
        )
    }

    func testRotationWindowMatchesWeb() {
        let first = CompanionLines.line(elapsedMin: 0, state: .running)
        XCTAssertEqual(CompanionLines.line(elapsedMin: 3, state: .running), first)
        XCTAssertNotEqual(CompanionLines.line(elapsedMin: 4, state: .running), first)
    }

    func testCyclesOnLongSessions() {
        XCTAssertFalse(CompanionLines.line(elapsedMin: 100, state: .running).isEmpty)
    }

    func testPausedAndOvertimeAreSteady() {
        XCTAssertEqual(
            CompanionLines.line(elapsedMin: 3, state: .paused),
            CompanionLines.line(elapsedMin: 40, state: .paused)
        )
        XCTAssertEqual(
            CompanionLines.line(elapsedMin: 3, state: .overtime),
            "Still with you — wrap up whenever it feels right."
        )
    }

    func testNeverShames() {
        for m in 0..<40 {
            for state in [CompanionLines.State.running, .paused, .overtime] {
                let line = CompanionLines.line(elapsedMin: m, state: state).lowercased()
                for word in ["hurry", "should", "behind", "faster"] {
                    XCTAssertFalse(line.contains(word), "shaming word '\(word)' in: \(line)")
                }
            }
        }
    }
}
