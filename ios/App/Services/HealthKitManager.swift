import Foundation
import HealthKit

protocol HealthKitClient: AnyObject {
    var isAvailable: Bool { get }

    func requestMindfulAuthorization() async throws -> Bool
    func requestSleepAuthorization() async throws
    func fetchSleepSamples(start: Date, end: Date) async throws -> [SleepSample]

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

enum SleepWindDownScheduleResult: Equatable {
    case scheduled
    case notificationsOff
    case quietHours
    case failed
}

enum SleepWindDownEnableResult: Equatable {
    case enabled(SleepSchedule)
    case disabled
    case unavailable
    case noPattern
    case notificationsOff(SleepSchedule)
    case quietHours(SleepSchedule)
    case failed
}

final class HealthKitManager {
    static let shared = HealthKitManager(
        client: AppleHealthKitClient(),
        isEnabled: { KairoPrefs.healthSyncEnabled },
        setEnabled: { KairoPrefs.healthSyncEnabled = $0 },
        isSleepWindDownEnabled: { KairoPrefs.sleepWindDownEnabled },
        setSleepWindDownEnabled: { KairoPrefs.sleepWindDownEnabled = $0 },
        scheduleSleepWindDown: { _, _, _ in .notificationsOff },
        cancelSleepWindDown: {}
    )

    private let client: HealthKitClient
    private let isEnabled: () -> Bool
    private let setEnabledPreference: (Bool) -> Void
    private let isSleepWindDownEnabled: () -> Bool
    private let setSleepWindDownPreference: (Bool) -> Void
    private let scheduleSleepWindDown: (
        SleepSchedule,
        Date,
        Calendar
    ) async -> SleepWindDownScheduleResult
    private let cancelSleepWindDown: () -> Void

    init(
        client: HealthKitClient,
        isEnabled: @escaping () -> Bool,
        setEnabled: @escaping (Bool) -> Void,
        isSleepWindDownEnabled: @escaping () -> Bool = { false },
        setSleepWindDownEnabled: @escaping (Bool) -> Void = { _ in },
        scheduleSleepWindDown: @escaping (
            SleepSchedule,
            Date,
            Calendar
        ) async -> SleepWindDownScheduleResult = { _, _, _ in .notificationsOff },
        cancelSleepWindDown: @escaping () -> Void = {}
    ) {
        self.client = client
        self.isEnabled = isEnabled
        self.setEnabledPreference = setEnabled
        self.isSleepWindDownEnabled = isSleepWindDownEnabled
        self.setSleepWindDownPreference = setSleepWindDownEnabled
        self.scheduleSleepWindDown = scheduleSleepWindDown
        self.cancelSleepWindDown = cancelSleepWindDown
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

    func setSleepWindDownEnabled(
        _ enabled: Bool,
        now: Date = Date(),
        calendar: Calendar = .current
    ) async -> SleepWindDownEnableResult {
        guard enabled else {
            setSleepWindDownPreference(false)
            cancelSleepWindDown()
            return .disabled
        }

        guard client.isAvailable else {
            setSleepWindDownPreference(false)
            cancelSleepWindDown()
            return .unavailable
        }

        do {
            try await client.requestSleepAuthorization()
            setSleepWindDownPreference(true)
            return await refreshSleepWindDown(now: now, calendar: calendar)
        } catch {
            setSleepWindDownPreference(false)
            cancelSleepWindDown()
            return .failed
        }
    }

    func refreshSleepWindDown(
        now: Date = Date(),
        calendar: Calendar = .current
    ) async -> SleepWindDownEnableResult {
        guard isSleepWindDownEnabled() else { return .disabled }
        guard client.isAvailable else {
            cancelSleepWindDown()
            return .unavailable
        }
        guard let start = calendar.date(
            byAdding: .day,
            value: -SleepScheduleInference.lookbackDays,
            to: now
        ) else {
            cancelSleepWindDown()
            return .failed
        }

        do {
            let samples = try await client.fetchSleepSamples(start: start, end: now)
            guard let schedule = SleepScheduleInference.infer(
                samples: samples,
                calendar: calendar
            ) else {
                cancelSleepWindDown()
                return .noPattern
            }

            switch await scheduleSleepWindDown(schedule, now, calendar) {
            case .scheduled:
                return .enabled(schedule)
            case .notificationsOff:
                return .notificationsOff(schedule)
            case .quietHours:
                return .quietHours(schedule)
            case .failed:
                return .failed
            }
        } catch {
            cancelSleepWindDown()
            return .failed
        }
    }
}

private final class AppleHealthKitClient: HealthKitClient {
    private let store = HKHealthStore()
    private let mindfulType = HKCategoryType(.mindfulSession)
    private let sleepType = HKCategoryType(.sleepAnalysis)

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestMindfulAuthorization() async throws -> Bool {
        guard isAvailable else { return false }
        try await store.requestAuthorization(toShare: [mindfulType], read: [])
        return store.authorizationStatus(for: mindfulType) == .sharingAuthorized
    }

    func requestSleepAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: [sleepType])
    }

    func fetchSleepSamples(start: Date, end: Date) async throws -> [SleepSample] {
        let predicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: [.strictStartDate]
        )
        let sort = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: true
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let values = (samples ?? []).compactMap { sample -> SleepSample? in
                    guard let category = sample as? HKCategorySample,
                          let stage = Self.sleepStage(for: category.value) else {
                        return nil
                    }
                    return SleepSample(
                        start: category.startDate,
                        end: category.endDate,
                        stage: stage
                    )
                }
                continuation.resume(returning: values)
            }
            store.execute(query)
        }
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

    private static func sleepStage(for value: Int) -> SleepStage? {
        switch HKCategoryValueSleepAnalysis(rawValue: value) {
        case .inBed:
            .inBed
        case .awake:
            .awake
        case .asleepUnspecified:
            .asleepUnspecified
        case .asleepCore:
            .asleepCore
        case .asleepDeep:
            .asleepDeep
        case .asleepREM:
            .asleepREM
        case .none:
            nil
        @unknown default:
            nil
        }
    }
}
