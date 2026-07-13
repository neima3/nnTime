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
            bundleId: "com.neima.kairo",
            hasPrivacyManifest: true,
            hasUniversalLinks: true,
            hasSignInWithApple: true,
            hasPushNotifications: true
        )
        #expect(preflight.runChecks().isEmpty)
        #expect(preflight.isReady)
    }

    @Test func preflightDetectsMissingBundleId() {
        let preflight = ReleasePreflight(bundleId: "")
        let failures = preflight.runChecks()
        #expect(failures.contains("Bundle ID not set"))
    }

    @Test func preflightDetectsMissingCapabilities() {
        let preflight = ReleasePreflight(
            hasUniversalLinks: false,
            hasSignInWithApple: false,
            hasPushNotifications: false
        )
        let failures = preflight.runChecks()
        #expect(failures.count == 4) // 3 capabilities + privacy manifest
    }
}
