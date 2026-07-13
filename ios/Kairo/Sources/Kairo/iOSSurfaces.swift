// Phase 8 — iOS surfaces + launch.
//
// 8A: Interactive widgets (complete-from-widget), timeline + next-up widgets,
//     Live Activity + Dynamic Island for focus.
// 8B: Google sign-in (web+iOS), Apple Reminders import, Apple Health sync.
// 8C: Ongoing hardening (restore drill, E2E, monitoring, dependency audit).
// 8D: App Store privacy labels + review prep.

import Foundation

// MARK: - 8A: Widgets + Live Activity

/// Widget configuration for the timeline + next-up widgets.
public struct WidgetConfig: Sendable {
    public let kind: WidgetKind
    public let family: WidgetFamily

    public enum WidgetKind: String, Sendable {
        case timeline       // today's timeline overview
        case nextUp         // next activity
        case completeTask   // interactive: complete from widget
    }

    public enum WidgetFamily: String, Sendable {
        case systemSmall, systemMedium, systemLarge
        case accessoryRectangular, accessoryCircular, accessoryInline  // lock screen
    }

    public init(kind: WidgetKind, family: WidgetFamily) {
        self.kind = kind
        self.family = family
    }
}

/// Live Activity state for the focus timer (Dynamic Island).
public struct FocusLiveActivity: Sendable {
    public let activityTitle: String
    public let remainingMinutes: Int
    public let state: FocusActivityState

    public enum FocusActivityState: String, Sendable {
        case focusing, paused, completed
    }

    public init(activityTitle: String, remainingMinutes: Int, state: FocusActivityState) {
        self.activityTitle = activityTitle
        self.remainingMinutes = remainingMinutes
        self.state = state
    }
}

// MARK: - 8B: Google sign-in + Apple Health

/// Apple Health sync configuration (HealthKit).
public struct HealthKitConfig: Sendable {
    /// Write focus/mindful minutes to HealthKit.
    public let writeFocusMinutes: Bool
    /// Read sleep schedule to inform wind-down suggestions.
    public let readSleepSchedule: Bool
    /// Explicit user opt-in (required).
    public let userOptedIn: Bool

    public init(writeFocusMinutes: Bool = false, readSleepSchedule: Bool = false, userOptedIn: Bool = false) {
        self.writeFocusMinutes = writeFocusMinutes
        self.readSleepSchedule = readSleepSchedule
        self.userOptedIn = userOptedIn
    }

    /// Whether HealthKit sync is active (requires explicit opt-in).
    public var isActive: Bool { userOptedIn && (writeFocusMinutes || readSleepSchedule) }
}

/// Apple Reminders import decision (8B: ship or justified exclusion).
public struct RemindersImportConfig: Sendable {
    public let enabled: Bool
    public let reason: String

    /// Default: enabled (shipped).
    public static let enabled_ = RemindersImportConfig(enabled: true, reason: "Apple Reminders import via EventKit")
    /// Alternative: justified exclusion.
    public static let excluded = RemindersImportConfig(enabled: false, reason: "Excluded: EventKit requires user grant that overlaps with Kairo's inbox — deferred to avoid confusion")
}

// MARK: - 8D: App Store privacy labels

/// App Store privacy label configuration.
/// Documents what data Kairo collects and for what purpose.
public struct PrivacyLabel: Sendable {
    public let dataType: PrivacyDataType
    public let usedForTracking: Bool
    public let purposes: [PrivacyPurpose]

    public enum PrivacyDataType: String, Sendable {
        case contactInfo = "Contact Info"
        case identifiers = "Identifiers"
        case usageData = "Usage Data"
        case health = "Health"
    }

    public enum PrivacyPurpose: String, Sendable {
        case appFunctionality = "App Functionality"
        case analytics = "Analytics"
        case productPersonalization = "Product Personalization"
    }

    public init(dataType: PrivacyDataType, usedForTracking: Bool, purposes: [PrivacyPurpose]) {
        self.dataType = dataType
        self.usedForTracking = usedForTracking
        self.purposes = purposes
    }

    /// Kairo's privacy labels (SEC-10 / 8D).
    public static let kairoLabels: [PrivacyLabel] = [
        // Email (for auth) — contact info, app functionality, not tracking.
        PrivacyLabel(dataType: .contactInfo, usedForTracking: false, purposes: [.appFunctionality]),
        // User ID (for sync) — identifiers, app functionality, not tracking.
        PrivacyLabel(dataType: .identifiers, usedForTracking: false, purposes: [.appFunctionality]),
        // Focus minutes (if HealthKit opted in) — health, app functionality.
        PrivacyLabel(dataType: .health, usedForTracking: false, purposes: [.appFunctionality]),
    ]
}
