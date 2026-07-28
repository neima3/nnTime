import Foundation
import KairoAPIClient
import OpenAPIRuntime

enum GeneratedAPIAdapterError: Error, Equatable {
    case malformedValue(path: String)
    case unexpectedOutput(operation: String, statusCode: Int)
}

enum GeneratedAPIAdapters {
    static func day(
        _ output: Operations.getDay.Output
    ) throws -> DayResponse {
        switch output {
        case let .ok(response):
            return try day(response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getDay.id,
                statusCode: statusCode
            )
        case .badRequest:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getDay.id,
                statusCode: 400
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getDay.id,
                statusCode: 401
            )
        }
    }

    static func day(
        _ value: Components.Schemas.DayResponse
    ) throws -> DayResponse {
        DayResponse(
            date: value.date,
            zone: value.zone,
            activities: try value.activities.map(activity),
            anytimeTasks: value.anytimeTasks.map(task),
            occurrenceStatusBySeries: value.occurrenceStatusBySeries
                .additionalProperties
                .mapValues(\.rawValue)
        )
    }

    static func settings(
        _ output: Operations.getUserSettings.Output
    ) throws -> UserSettings {
        switch output {
        case let .ok(response):
            return settings(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getUserSettings.id,
                statusCode: statusCode
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getUserSettings.id,
                statusCode: 401
            )
        }
    }

    static func settings(
        _ value: Components.Schemas.UserSettings
    ) -> UserSettings {
        UserSettings(
            timezone: value.timezone,
            theme: value.theme.rawValue,
            reducedStimulation: value.reducedStimulation,
            hourCycle: value.hourCycle.rawValue,
            weekStart: Int(value.weekStart),
            notificationPrefs: notificationPreferences(
                value.notificationPrefs.additionalProperties.value
            ),
            revision: Int(value.revision)
        )
    }

    static func activity(
        _ output: Operations.createActivitySeries.Output
    ) throws -> Activity {
        switch output {
        case let .created(response):
            return try activity(response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createActivitySeries.id,
                statusCode: statusCode
            )
        case .badRequest:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createActivitySeries.id,
                statusCode: 400
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createActivitySeries.id,
                statusCode: 401
            )
        case .conflict:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createActivitySeries.id,
                statusCode: 409
            )
        }
    }

    static func activity(
        _ value: Components.Schemas.ActivitySeries
    ) throws -> Activity {
        Activity(
            id: value.id,
            title: value.title,
            emoji: value.emoji,
            tz: value.tz,
            dtstartLocal: value.dtstartLocal,
            durationMin: Int(value.durationMin),
            rrule: value.rrule,
            categoryId: value.categoryId,
            checklistTemplate: try checklist(value.checklistTemplate),
            revision: Int(value.revision),
            occurrenceKey: nil,
            status: nil
        )
    }

    static func activity(
        _ value: Components.Schemas.DayActivity
    ) throws -> Activity {
        Activity(
            id: value.id,
            title: value.title,
            emoji: value.emoji,
            tz: value.tz,
            dtstartLocal: value.dtstartLocal,
            durationMin: Int(value.durationMin),
            rrule: value.rrule,
            categoryId: value.categoryId,
            checklistTemplate: try value.checklistTemplate.map {
                let object = $0.additionalProperties.value
                guard let label = object["label"] as? String else {
                    throw GeneratedAPIAdapterError.malformedValue(
                        path: "DayActivity.checklistTemplate.label"
                    )
                }
                return Activity.ChecklistItem(
                    label: label,
                    done: object["done"] as? Bool
                )
            },
            revision: Int(value.revision),
            occurrenceKey: value.occurrenceKey,
            status: value.status.rawValue
        )
    }

    static func task(
        _ output: Operations.createTask.Output
    ) throws -> TaskItem {
        switch output {
        case let .created(response):
            return task(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createTask.id,
                statusCode: statusCode
            )
        case .badRequest:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createTask.id,
                statusCode: 400
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createTask.id,
                statusCode: 401
            )
        case .conflict:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.createTask.id,
                statusCode: 409
            )
        }
    }

    static func task(_ value: Components.Schemas.Task) -> TaskItem {
        TaskItem(
            id: value.id,
            title: value.title,
            emoji: value.emoji,
            bucket: value.bucket.rawValue,
            priority: value.priority.rawValue,
            revision: Int(value.revision),
            createdAt: value.createdAt
        )
    }

    static func search(
        _ output: Operations.search.Output
    ) throws -> SearchResponse {
        switch output {
        case let .ok(response):
            return search(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.search.id,
                statusCode: statusCode
            )
        case .badRequest:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.search.id,
                statusCode: 400
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.search.id,
                statusCode: 401
            )
        }
    }

    static func search(
        _ value: Components.Schemas.SearchResponse
    ) -> SearchResponse {
        SearchResponse(
            query: value.query,
            today: value.today,
            zone: value.zone,
            items: value.items.map { item in
                .init(
                    id: item.id,
                    kind: item.kind.rawValue,
                    title: item.title,
                    emoji: item.emoji,
                    date: item.date,
                    startMin: item.startMin,
                    categoryId: item.categoryId,
                    matchedOn: item.matchedOn.rawValue,
                    repeats: item.repeats
                )
            }
        )
    }

    static func stats(
        _ output: Operations.getStats.Output
    ) throws -> StatsResponse {
        switch output {
        case let .ok(response):
            return stats(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getStats.id,
                statusCode: statusCode
            )
        case .badRequest:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getStats.id,
                statusCode: 400
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getStats.id,
                statusCode: 401
            )
        }
    }

    static func stats(
        _ value: Components.Schemas.StatsResponse
    ) -> StatsResponse {
        StatsResponse(
            byDate: value.byDate.additionalProperties.mapValues {
                .init(
                    completed: $0.completed,
                    focusMin: $0.focusMin,
                    mood: $0.mood?.rawValue
                )
            },
            streak: .init(
                current: value.streak.current,
                best: value.streak.best
            ),
            totalCompleted: value.totalCompleted,
            totalFocusMin: value.totalFocusMin,
            estimate: value.estimate.map {
                .init(
                    sessions: $0.sessions,
                    avgTargetMin: $0.avgTargetMin,
                    avgActualMin: $0.avgActualMin,
                    ratio: $0.ratio
                )
            },
            focusHours: value.focusHours.map {
                .init(hours: $0.hours, peakHour: $0.peakHour)
            },
            energyPattern: .init(
                byHour: value.energyPattern.byHour,
                sampled: value.energyPattern.sampled,
                window: value.energyPattern.window.map {
                    .init(start: $0.start, end: $0.end)
                }
            ),
            days: value.days
        )
    }

    static func routines(
        _ output: Operations.listRoutines.Output
    ) throws -> [Routine] {
        switch output {
        case let .ok(response):
            return routines(try response.body.json.items)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.listRoutines.id,
                statusCode: statusCode
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.listRoutines.id,
                statusCode: 401
            )
        }
    }

    static func routines(
        _ values: [Components.Schemas.RoutineListItem]
    ) -> [Routine] {
        values.map { value in
            Routine(
                id: value.id,
                title: value.title,
                emoji: value.emoji,
                notes: value.notes,
                steps: value.steps.map {
                    .init(
                        id: $0.id,
                        title: $0.title,
                        durationMin: $0.durationMin.map(Int.init),
                        sortOrder: Int($0.sortOrder)
                    )
                },
                schedules: value.schedules.map {
                    .init(
                        id: $0.id,
                        rrule: $0.rrule,
                        paused: $0.paused
                    )
                },
                stepCount: value.stepCount,
                totalMin: value.totalMin,
                revision: Int(value.revision)
            )
        }
    }

    static func focus(
        _ output: Operations.getActiveFocusSession.Output
    ) throws -> FocusSnapshot {
        switch output {
        case let .ok(response):
            return focus(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getActiveFocusSession.id,
                statusCode: statusCode
            )
        case .unauthorized:
            throw GeneratedAPIAdapterError.unexpectedOutput(
                operation: Operations.getActiveFocusSession.id,
                statusCode: 401
            )
        }
    }

    static func focus(
        _ value: Components.Schemas.FocusSnapshot
    ) -> FocusSnapshot {
        FocusSnapshot(
            session: value.session.map {
                .init(
                    id: $0.id,
                    state: $0.state.rawValue,
                    targetDurationMin: Int($0.targetDurationMin),
                    startedAt: $0.startedAt
                )
            },
            remainingSec: value.remainingSec
        )
    }

    static func settingsUpdate(
        _ value: SettingsUpdate
    ) throws -> Components.Schemas.UserSettingsUpdateRequest {
        let notificationPrefs = try value.notificationPrefs.map {
            Components.Schemas.UserSettingsUpdateRequest
                .notificationPrefsPayload(
                    additionalProperties: try OpenAPIObjectContainer(
                        unvalidatedValue: $0.mapValues(notificationValue)
                    )
                )
        }
        return .init(
            timezone: value.timezone,
            locale: value.locale,
            weekStart: value.weekStart.map { Int32($0.rawValue) },
            hourCycle: value.hourCycle.flatMap {
                Components.Schemas.HourCycle(rawValue: $0.rawValue)
            },
            theme: value.theme.flatMap {
                Components.Schemas.ThemeMode(rawValue: $0.rawValue)
            },
            reducedStimulation: value.reducedStimulation,
            notificationPrefs: notificationPrefs
        )
    }

    static func activityUpdate(
        _ value: ActivityUpdate
    ) throws -> Components.Schemas.ActivitySeriesUpdateRequest {
        .init(
            editScope: value.editScope.flatMap {
                Components.Schemas.EditScope(rawValue: $0.rawValue)
            },
            occurrenceKey: value.occurrenceKey,
            tz: value.tz,
            dtstartLocal: value.dtstartLocal,
            rrule: patch(value.rrule),
            exdate: patch(value.exdate),
            rdate: patch(value.rdate),
            title: value.title,
            emoji: patch(value.emoji),
            categoryId: patch(value.categoryId),
            durationMin: try value.durationMin.map(int32),
            checklistTemplate: try value.checklistTemplate?.map(
                checklistObject
            ),
            energy: patch(value.energy) {
                switch $0 {
                case .low: .low
                case .medium: .medium
                case .high: .high
                }
            },
            priority: value.priority.flatMap {
                Components.Schemas.Priority(rawValue: $0.rawValue)
            },
            tags: patch(value.tags),
            notes: patch(value.notes),
            source: value.source.flatMap {
                Components.Schemas.ActivitySource(rawValue: $0.rawValue)
            },
            sourceRef: patch(value.sourceRef),
            status: value.status.flatMap {
                Components.Schemas.OccurrenceStatus(rawValue: $0.rawValue)
            },
            startAt: value.startAt,
            completedAt: patch(value.completedAt),
            checklistOverride: patch(value.checklistOverride) {
                $0.map {
                    KairoChecklistOverrideItem(
                        label: $0.label,
                        done: $0.done
                    )
                }
            }
        )
    }

    static func focusCommand(
        _ value: FocusCommand
    ) throws -> Components.Schemas.FocusSessionPatchRequest {
        switch value {
        case let .transition(state):
            guard let state = Components.Schemas.FocusState(
                rawValue: state.rawValue
            ) else {
                throw GeneratedAPIAdapterError.malformedValue(
                    path: "FocusCommand.state"
                )
            }
            return .case1(.init(action: .transition, state: state))
        case let .extend(minutes):
            guard let minutes = Components.Schemas.FocusSessionPatchRequest
                .Case2Payload.addMinutesPayload(rawValue: minutes.rawValue)
            else {
                throw GeneratedAPIAdapterError.malformedValue(
                    path: "FocusCommand.minutes"
                )
            }
            return .case2(.init(action: .extend, addMinutes: minutes))
        }
    }

    private static func checklist(
        _ values: [Components.Schemas.ActivitySeries
            .checklistTemplatePayloadPayload]
    ) throws -> [Activity.ChecklistItem] {
        try values.map {
            let object = $0.additionalProperties.value
            guard let label = object["label"] as? String else {
                throw GeneratedAPIAdapterError.malformedValue(
                    path: "ActivitySeries.checklistTemplate.label"
                )
            }
            return .init(label: label, done: object["done"] as? Bool)
        }
    }

    private static func checklistObject(
        _ value: ChecklistUpdateItem
    ) throws -> OpenAPIObjectContainer {
        var object: [String: (any Sendable)?] = ["label": value.label]
        if let done = value.done {
            object["done"] = done
        }
        return try OpenAPIObjectContainer(unvalidatedValue: object)
    }

    private static func notificationPreferences(
        _ object: [String: (any Sendable)?]
    ) -> NotificationPreferences {
        object.mapValues(notificationPreference)
    }

    private static func notificationPreference(
        _ value: (any Sendable)?
    ) -> NotificationPreferenceValue {
        switch value {
        case nil, is NSNull: .null
        case let value as Bool: .boolean(value)
        case let value as Int: .integer(value)
        case let value as Double: .number(value)
        case let value as String: .string(value)
        case let value as [String: (any Sendable)?]:
            .object(notificationPreferences(value))
        case let value as [(any Sendable)?]:
            .array(value.map(notificationPreference))
        default:
            .null
        }
    }

    private static func notificationValue(
        _ value: NotificationPreferenceValue
    ) -> (any Sendable)? {
        switch value {
        case let .string(value): value
        case let .integer(value): value
        case let .number(value): value
        case let .boolean(value): value
        case let .object(value): value.mapValues(notificationValue)
        case let .array(value): value.map(notificationValue)
        case .null: nil
        }
    }

    private static func patch<Value: Codable & Hashable & Sendable>(
        _ value: UpdateField<Value>
    ) -> PatchField<Value>? {
        switch value {
        case .unchanged: nil
        case .null: .null
        case let .value(value): .value(value)
        }
    }

    private static func patch<
        Input: Equatable & Sendable,
        Output: Codable & Hashable & Sendable
    >(
        _ value: UpdateField<Input>,
        transform: (Input) -> Output
    ) -> PatchField<Output>? {
        switch value {
        case .unchanged:
            return nil
        case .null:
            return .null
        case let .value(value):
            return .value(transform(value))
        }
    }

    private static func int32(_ value: Int) throws -> Int32 {
        guard let result = Int32(exactly: value) else {
            throw GeneratedAPIAdapterError.malformedValue(path: "Int32")
        }
        return result
    }
}
