import Foundation
import HealthKit

protocol HealthKitClient: AnyObject {
    var isAvailable: Bool { get }

    func requestMindfulAuthorization() async throws -> Bool

    func saveMindfulSession(
        sessionId: String,
        minutes: Int,
        endedAt: Date
    ) async throws
}

enum HealthKitEnableResult: Equatable {
    case enabled
    case disabled
    case unavailable
    case denied
    case failed
}

final class HealthKitManager {
    static let shared = HealthKitManager(
        client: AppleHealthKitClient(),
        isEnabled: { KairoPrefs.healthSyncEnabled },
        setEnabled: { KairoPrefs.healthSyncEnabled = $0 }
    )

    private let client: HealthKitClient
    private let isEnabled: () -> Bool
    private let setEnabledPreference: (Bool) -> Void

    init(
        client: HealthKitClient,
        isEnabled: @escaping () -> Bool,
        setEnabled: @escaping (Bool) -> Void
    ) {
        self.client = client
        self.isEnabled = isEnabled
        self.setEnabledPreference = setEnabled
    }

    var isAvailable: Bool {
        client.isAvailable
    }

    func setEnabled(_ enabled: Bool) async -> HealthKitEnableResult {
        guard enabled else {
            setEnabledPreference(false)
            return .disabled
        }

        guard client.isAvailable else {
            setEnabledPreference(false)
            return .unavailable
        }

        do {
            guard try await client.requestMindfulAuthorization() else {
                setEnabledPreference(false)
                return .denied
            }
            setEnabledPreference(true)
            return .enabled
        } catch {
            setEnabledPreference(false)
            return .failed
        }
    }

    func recordCompletedFocus(
        sessionId: String,
        minutes: Int,
        endedAt: Date
    ) async -> Bool {
        guard isEnabled(), client.isAvailable, minutes > 0 else { return false }

        do {
            try await client.saveMindfulSession(
                sessionId: sessionId,
                minutes: minutes,
                endedAt: endedAt
            )
            return true
        } catch {
            return false
        }
    }
}

private final class AppleHealthKitClient: HealthKitClient {
    private let store = HKHealthStore()
    private let mindfulType = HKCategoryType(.mindfulSession)

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestMindfulAuthorization() async throws -> Bool {
        guard isAvailable else { return false }
        try await store.requestAuthorization(toShare: [mindfulType], read: [])
        return store.authorizationStatus(for: mindfulType) == .sharingAuthorized
    }

    func saveMindfulSession(
        sessionId: String,
        minutes: Int,
        endedAt: Date
    ) async throws {
        let sample = HKCategorySample(
            type: mindfulType,
            value: HKCategoryValue.notApplicable.rawValue,
            start: endedAt.addingTimeInterval(-Double(minutes * 60)),
            end: endedAt,
            metadata: [
                HKMetadataKeySyncIdentifier: "kairo-focus-\(sessionId)",
                HKMetadataKeySyncVersion: 1,
            ]
        )
        try await store.save(sample)
    }
}
