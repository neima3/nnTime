// Phase 7F tests — release preflight checklist.
import Testing
import Foundation
@testable import Kairo

@Suite struct PreflightTests {
    @Test func preflightDetectsMissingPrivacyManifest() {
        let preflight = ReleasePreflight(hasPrivacyManifest: false)
        let failures = preflight.runChecks()
        #expect(failures.contains("Privacy manifest (PrivacyInfo.xcprivacy) missing"))
        #expect(!preflight.isReady)
    }

    @Test func preflightPassesWithAllChecks() {
        let preflight = ReleasePreflight(
            bundleId: "me.neima.kairo",
            hasPrivacyManifest: true
        )
        #expect(preflight.runChecks().isEmpty)
        #expect(preflight.isReady)
        #expect(preflight.bundleId == "me.neima.kairo")
    }

    @Test func preflightDetectsMissingBundleId() {
        let preflight = ReleasePreflight(bundleId: "")
        let failures = preflight.runChecks()
        #expect(failures.contains("Bundle ID not set"))
    }

    @Test func preflightDetectsMissingRequiredAppCapabilities() {
        let preflight = ReleasePreflight(
            hasPrivacyManifest: true,
            hasAppGroup: false,
            hasHealthKit: false,
            hasHealthShareUsageDescription: false,
            hasHealthUpdateUsageDescription: false
        )
        let failures = preflight.runChecks()
        #expect(failures == [
            "App Group not configured",
            "HealthKit entitlement not configured",
            "NSHealthShareUsageDescription missing",
            "NSHealthUpdateUsageDescription missing",
        ])
    }
}
