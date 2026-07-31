import XCTest
@testable import Kairo

/// Pins the low-battery day port to the web contract
/// (src/components/LowBattery.tsx + PickForMe.tsx).
final class LowBatteryDayTests: XCTestCase {

    func testPerDateToggleIsIsolatedAndRemovable() {
        let a = "2099-01-01-\(UUID().uuidString)"
        let b = "2099-01-02-\(UUID().uuidString)"
        defer {
            LowBatteryDay.set(a, on: false)
            LowBatteryDay.set(b, on: false)
        }
        XCTAssertFalse(LowBatteryDay.isOn(a))
        LowBatteryDay.set(a, on: true)
        XCTAssertTrue(LowBatteryDay.isOn(a))
        XCTAssertFalse(LowBatteryDay.isOn(b), "dates are independent")
        LowBatteryDay.set(a, on: false)
        XCTAssertFalse(LowBatteryDay.isOn(a))
    }

    func testHeavyMatchesTheWebTimelineRule() {
        XCTAssertTrue(LowBatteryDay.isHeavy(energy: .high, done: false, lowBattery: true))
        XCTAssertFalse(LowBatteryDay.isHeavy(energy: .high, done: true, lowBattery: true), "done blocks never dim")
        XCTAssertFalse(LowBatteryDay.isHeavy(energy: .medium, done: false, lowBattery: true))
        XCTAssertFalse(LowBatteryDay.isHeavy(energy: nil, done: false, lowBattery: true))
        XCTAssertFalse(LowBatteryDay.isHeavy(energy: .high, done: false, lowBattery: false))
    }

    func testPickRankDemotesHeavyAndPrefersLightOnlyWhenOn() {
        // Off: pure kind ordering, spread by 10.
        XCTAssertEqual(LowBatteryDay.pickRank(baseRank: 0, energy: .high, lowBattery: false), 0)
        XCTAssertEqual(LowBatteryDay.pickRank(baseRank: 1, energy: .low, lowBattery: false), 10)
        // On: high demoted within its kind but never past the next kind.
        XCTAssertEqual(LowBatteryDay.pickRank(baseRank: 0, energy: .high, lowBattery: true), 3)
        XCTAssertEqual(LowBatteryDay.pickRank(baseRank: 0, energy: .low, lowBattery: true), -1)
        XCTAssertEqual(LowBatteryDay.pickRank(baseRank: 0, energy: .medium, lowBattery: true), 0)
        XCTAssertLessThan(
            LowBatteryDay.pickRank(baseRank: 0, energy: .high, lowBattery: true),
            LowBatteryDay.pickRank(baseRank: 1, energy: .low, lowBattery: true),
            "a heavy now-pick still beats a light later-pick"
        )
    }
}
