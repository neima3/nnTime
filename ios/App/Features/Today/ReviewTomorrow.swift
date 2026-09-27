import Foundation

/// Moving a missed block to tomorrow must not stack it on top of a copy that
/// is already there. A daily routine has its own occurrence tomorrow; a weekly
/// one usually doesn't. Ask the day itself rather than guessing from the rule.
/// Mirrors `src/lib/next-day-copies.ts` + ReviewClient `act("tomorrow")`.
enum ReviewTomorrow {
    enum Outcome: Equatable {
        /// This occurrence now starts tomorrow at the same local time.
        case moved
        /// Tomorrow already had this series, so today's was let go instead.
        case alreadyTomorrow
    }

    /// YYYY-MM-DD one calendar day after `date` (pure date arithmetic, no DST).
    static func nextDate(_ date: String) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let day = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
              let next = cal.date(byAdding: .day, value: 1, to: day)
        else { return date }
        let c = cal.dateComponents([.year, .month, .day], from: next)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Series ids that already have an occurrence on `date`. `nil` when the
    /// day couldn't be read — callers fall back to moving, the old behaviour.
    static func seriesIds(on date: String, api: KairoAPI) async -> Set<String>? {
        guard let day = try? await api.day(date) else { return nil }
        return Set(day.activities.map(\.id))
    }

    static func shouldLetGo(_ item: DayBlock, seriesOnTomorrow: Set<String>?) -> Bool {
        item.recurring && (seriesOnTomorrow?.contains(item.id) ?? false)
    }

    static func perform(
        _ item: DayBlock,
        date: String,
        zone: TimeZone,
        api: KairoAPI
    ) async throws -> (activity: Activity, outcome: Outcome) {
        let tomorrow = nextDate(date)
        let onTomorrow = item.recurring ? await seriesIds(on: tomorrow, api: api) : nil
        if shouldLetGo(item, seriesOnTomorrow: onTomorrow) {
            let updated = try await api.setStatus(
                activityId: item.id,
                revision: item.revision,
                occurrenceKey: item.occurrenceKey,
                status: .skipped,
                completedAt: nil
            )
            return (updated, .alreadyTomorrow)
        }
        let updated = try await api.moveActivity(
            activityId: item.id,
            revision: item.revision,
            occurrenceKey: item.occurrenceKey,
            startAt: KTime.instant(date: tomorrow, minutes: item.startMin, zone: zone)
        )
        return (updated, .moved)
    }
}
