import XCTest
@testable import Kairo

final class PreferencesPurgeTests: XCTestCase {
    func testAccountStateClearPreservesDeviceConsentAndOnboarding() {
        let original = OriginalPreferences()
        defer { original.restore() }

        KairoPrefs.theme = .dark
        KairoPrefs.reducedStimulation = true
        KairoPrefs.highContrast = true
        KairoPrefs.dyslexiaFont = true
        KairoPrefs.largerText = true
        KairoPrefs.hourCycle = "h24"
        KairoPrefs.quietHoursEnabled = true
        KairoPrefs.quietStartHour = 19
        KairoPrefs.quietEndHour = 8
        KairoPrefs.hasOnboarded = true
        KairoPrefs.healthSyncEnabled = true
        KairoPrefs.sleepWindDownEnabled = true
        KairoPrefs.companion = true

        KairoPrefs.clearAccountState()

        XCTAssertEqual(KairoPrefs.theme, .system)
        XCTAssertFalse(KairoPrefs.reducedStimulation)
        XCTAssertFalse(KairoPrefs.highContrast)
        XCTAssertFalse(KairoPrefs.dyslexiaFont)
        XCTAssertFalse(KairoPrefs.largerText)
        XCTAssertEqual(KairoPrefs.hourCycle, "h12")
        XCTAssertFalse(KairoPrefs.quietHoursEnabled)
        XCTAssertEqual(KairoPrefs.quietStartHour, 22)
        XCTAssertEqual(KairoPrefs.quietEndHour, 7)
        XCTAssertTrue(KairoPrefs.hasOnboarded)
        XCTAssertTrue(KairoPrefs.healthSyncEnabled)
        XCTAssertTrue(KairoPrefs.sleepWindDownEnabled)
        XCTAssertTrue(KairoPrefs.companion)
    }
}

private struct OriginalPreferences {
    let theme = KairoPrefs.theme
    let reducedStimulation = KairoPrefs.reducedStimulation
    let highContrast = KairoPrefs.highContrast
    let dyslexiaFont = KairoPrefs.dyslexiaFont
    let largerText = KairoPrefs.largerText
    let hourCycle = KairoPrefs.hourCycle
    let quietHoursEnabled = KairoPrefs.quietHoursEnabled
    let quietStartHour = KairoPrefs.quietStartHour
    let quietEndHour = KairoPrefs.quietEndHour
    let hasOnboarded = KairoPrefs.hasOnboarded
    let healthSyncEnabled = KairoPrefs.healthSyncEnabled
    let sleepWindDownEnabled = KairoPrefs.sleepWindDownEnabled
    let companion = KairoPrefs.companion

    func restore() {
        KairoPrefs.theme = theme
        KairoPrefs.reducedStimulation = reducedStimulation
        KairoPrefs.highContrast = highContrast
        KairoPrefs.dyslexiaFont = dyslexiaFont
        KairoPrefs.largerText = largerText
        KairoPrefs.hourCycle = hourCycle
        KairoPrefs.quietHoursEnabled = quietHoursEnabled
        KairoPrefs.quietStartHour = quietStartHour
        KairoPrefs.quietEndHour = quietEndHour
        KairoPrefs.hasOnboarded = hasOnboarded
        KairoPrefs.healthSyncEnabled = healthSyncEnabled
        KairoPrefs.sleepWindDownEnabled = sleepWindDownEnabled
        KairoPrefs.companion = companion
    }
}
