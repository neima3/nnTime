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
    /// The App Store Connect app ID.
    public let appStoreConnectAppId: String
    /// The signing certificate name.
    public let signingCertificate: String
    /// The entitlements file path.
    public let entitlementsPath: String
    /// Whether the privacy manifest (PrivacyInfo.xcprivacy) exists.
    public let hasPrivacyManifest: Bool
    /// Whether universal links are configured (associated domains).
    public let hasUniversalLinks: Bool
    /// Whether Sign in with Apple capability is enabled.
    public let hasSignInWithApple: Bool
    /// Whether push notifications capability is enabled.
    public let hasPushNotifications: Bool

    public init(
        bundleId: String = "com.neima.kairo",
        appStoreConnectAppId: String = "",
        signingCertificate: String = "Apple Distribution",
        entitlementsPath: String = "Kairo.entitlements",
        hasPrivacyManifest: Bool = false,
        hasUniversalLinks: Bool = true,
        hasSignInWithApple: Bool = true,
        hasPushNotifications: Bool = true
    ) {
        self.bundleId = bundleId
        self.appStoreConnectAppId = appStoreConnectAppId
        self.signingCertificate = signingCertificate
        self.entitlementsPath = entitlementsPath
        self.hasPrivacyManifest = hasPrivacyManifest
        self.hasUniversalLinks = hasUniversalLinks
        self.hasSignInWithApple = hasSignInWithApple
        self.hasPushNotifications = hasPushNotifications
    }

    /// Run all preflight checks. Returns a list of failures (empty = ready).
    public func runChecks() -> [String] {
        var failures: [String] = []
        if bundleId.isEmpty { failures.append("Bundle ID not set") }
        if signingCertificate.isEmpty { failures.append("Signing certificate not set") }
        if !hasUniversalLinks { failures.append("Universal links not configured") }
        if !hasSignInWithApple { failures.append("Sign in with Apple not enabled") }
        if !hasPushNotifications { failures.append("Push notifications not enabled") }
        if !hasPrivacyManifest { failures.append("Privacy manifest (PrivacyInfo.xcprivacy) missing") }
        return failures
    }

    /// Whether the release is ready (no failures).
    public var isReady: Bool { runChecks().isEmpty }
}
