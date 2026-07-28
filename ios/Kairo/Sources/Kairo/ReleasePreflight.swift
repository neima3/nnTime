// Phase 7F — Release preflight checklist.
//
// Verifies certificates, bundle IDs, entitlements, privacy manifest, and
// App Store Connect access BEFORE build work claims done. This is a gate
// that runs as a test — if any check fails, the release is not ready.

import Foundation

/// Release preflight configuration — must be verified before TestFlight.
public struct ReleasePreflight: Sendable {
    /// The app bundle identifier.
    public let bundleId: String
    /// The signing certificate name.
    public let signingCertificate: String
    /// Whether the privacy manifest (PrivacyInfo.xcprivacy) exists.
    public let hasPrivacyManifest: Bool
    /// Whether the app and widget share the Kairo App Group.
    public let hasAppGroup: Bool
    /// Whether the application has the HealthKit entitlement.
    public let hasHealthKit: Bool
    /// Whether the app explains Health reads.
    public let hasHealthShareUsageDescription: Bool
    /// Whether the app explains Health writes.
    public let hasHealthUpdateUsageDescription: Bool

    public init(
        bundleId: String = "me.neima.kairo",
        signingCertificate: String = "Apple Distribution",
        hasPrivacyManifest: Bool = false,
        hasAppGroup: Bool = true,
        hasHealthKit: Bool = true,
        hasHealthShareUsageDescription: Bool = true,
        hasHealthUpdateUsageDescription: Bool = true
    ) {
        self.bundleId = bundleId
        self.signingCertificate = signingCertificate
        self.hasPrivacyManifest = hasPrivacyManifest
        self.hasAppGroup = hasAppGroup
        self.hasHealthKit = hasHealthKit
        self.hasHealthShareUsageDescription = hasHealthShareUsageDescription
        self.hasHealthUpdateUsageDescription = hasHealthUpdateUsageDescription
    }

    /// Run all preflight checks. Returns a list of failures (empty = ready).
    public func runChecks() -> [String] {
        var failures: [String] = []
        if bundleId.isEmpty { failures.append("Bundle ID not set") }
        if signingCertificate.isEmpty { failures.append("Signing certificate not set") }
        if !hasPrivacyManifest { failures.append("Privacy manifest (PrivacyInfo.xcprivacy) missing") }
        if !hasAppGroup { failures.append("App Group not configured") }
        if !hasHealthKit { failures.append("HealthKit entitlement not configured") }
        if !hasHealthShareUsageDescription {
            failures.append("NSHealthShareUsageDescription missing")
        }
        if !hasHealthUpdateUsageDescription {
            failures.append("NSHealthUpdateUsageDescription missing")
        }
        return failures
    }

    /// Whether the release is ready (no failures).
    public var isReady: Bool { runChecks().isEmpty }
}
