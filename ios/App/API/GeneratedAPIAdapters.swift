import Foundation
import KairoAPIClient
import OpenAPIRuntime

enum GeneratedAPIAdapterError: Error, Equatable {
    case malformedValue(path: String)
    case http(
        operation: String,
        statusCode: Int,
        error: ServerErrorData
    )
    case unauthorized(
        operation: String,
        statusCode: Int,
        error: ServerErrorData
    )
    case notFound(
        operation: String,
        statusCode: Int,
        error: ServerErrorData
    )
    case conflict(
        operation: String,
        statusCode: Int,
        error: ServerErrorData
    )
    case undocumented(operation: String, statusCode: Int)
}

enum GeneratedAPIAdapters {
    static func authCapabilities(
        _ output: Operations.getAuthCapabilities.Output
    ) throws -> NativeAuthCapabilities {
        switch output {
        case let .ok(response):
            let value = try response.body.json
            return .init(
                magicLink: value.magicLink,
                apple: value.apple
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getAuthCapabilities.id,
                statusCode: statusCode
            )
        }
    }

    static func appleChallenge(
        _ output: Operations.createAppleAuthChallenge.Output
    ) throws -> NativeAppleChallenge {
        switch output {
        case let .created(response):
            let value = try response.body.json
            return .init(
                state: value.state,
                nonce: value.nonce,
                expiresAt: value.expiresAt
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.createAppleAuthChallenge.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.createAppleAuthChallenge.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .tooManyRequests(response):
            throw try documentedError(
                operation: Operations.createAppleAuthChallenge.id,
                statusCode: 429,
                envelope: response.body.json
            )
        case let .serviceUnavailable(response):
            throw try documentedError(
                operation: Operations.createAppleAuthChallenge.id,
                statusCode: 503,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.createAppleAuthChallenge.id,
                statusCode: statusCode
            )
        }
    }

    static func appleExchange(
        _ output: Operations.exchangeAppleCredential.Output
    ) throws {
        switch output {
        case .ok:
            return
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.exchangeAppleCredential.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.exchangeAppleCredential.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.exchangeAppleCredential.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .serviceUnavailable(response):
            throw try documentedError(
                operation: Operations.exchangeAppleCredential.id,
                statusCode: 503,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.exchangeAppleCredential.id,
                statusCode: statusCode
            )
        }
    }

    static func day(
        _ output: Operations.getDay.Output
    ) throws -> DayResponse {
        switch output {
        case let .ok(response):
            return try day(response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getDay.id,
                statusCode: statusCode
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.getDay.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getDay.id,
                statusCode: 401,
                envelope: response.body.json
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
            return try settings(response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getUserSettings.id,
                statusCode: statusCode
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getUserSettings.id,
                statusCode: 401,
                envelope: response.body.json
            )
        }
    }

    static func updatedSettings(
        _ output: Operations.updateUserSettings.Output
    ) throws -> UserSettings {
        switch output {
        case let .ok(response):
            return try settings(response.body.json)
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.updateUserSettings.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.updateUserSettings.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.updateUserSettings.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.updateUserSettings.id,
                statusCode: statusCode
            )
        }
    }

    static func settings(
        _ value: Components.Schemas.UserSettings
    ) throws -> UserSettings {
        try UserSettings(
            timezone: value.timezone,
            theme: value.theme.rawValue,
            reducedStimulation: value.reducedStimulation,
            hourCycle: value.hourCycle.rawValue,
            weekStart: Int(value.weekStart),
            notificationPrefs: jsonObject(
                value.notificationPrefs.additionalProperties.value,
                path: "UserSettings.notificationPrefs"
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
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.createActivitySeries.id,
                statusCode: statusCode
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.createActivitySeries.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.createActivitySeries.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.createActivitySeries.id,
                statusCode: 409,
                envelope: response.body.json
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

    static func activitySeries(
        _ output: Operations.getActivitySeries.Output
    ) throws -> Activity {
        switch output {
        case let .ok(response):
            return try activity(response.body.json)
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getActivitySeries.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .notFound(response):
            throw try documentedError(
                operation: Operations.getActivitySeries.id,
                statusCode: 404,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getActivitySeries.id,
                statusCode: statusCode
            )
        }
    }

    static func changes(
        _ output: Operations.getChanges.Output
    ) throws -> ChangesPage {
        switch output {
        case let .ok(response):
            let value = try response.body.json
            return .init(
                entries: value.items.map {
                    .init(
                        id: $0.id,
                        entityType: $0.entityType,
                        entityID: $0.entityId,
                        operation: $0.op.rawValue,
                        revision: Int($0.revision),
                        occurredAt: $0.occurredAt
                    )
                },
                nextCursor: value.nextCursor
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getChanges.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getChanges.id,
                statusCode: statusCode
            )
        }
    }

    static func updatedActivity(
        _ output: Operations.updateActivitySeries.Output
    ) throws -> Activity {
        switch output {
        case let .ok(response):
            return try activity(response.body.json)
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.updateActivitySeries.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.updateActivitySeries.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .notFound(response):
            throw try documentedError(
                operation: Operations.updateActivitySeries.id,
                statusCode: 404,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.updateActivitySeries.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.updateActivitySeries.id,
                statusCode: statusCode
            )
        }
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
            checklistTemplate: try value.checklistTemplate.enumerated().map {
                index, item in
                try checklistItem(
                    item.additionalProperties.value,
                    path: "DayActivity.checklistTemplate[\(index)]"
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
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.createTask.id,
                statusCode: statusCode
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.createTask.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.createTask.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.createTask.id,
                statusCode: 409,
                envelope: response.body.json
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

    static func tasks(
        _ output: Operations.listTasks.Output
    ) throws -> [TaskItem] {
        switch output {
        case let .ok(response):
            return try response.body.json.items.map(task)
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.listTasks.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.listTasks.id,
                statusCode: statusCode
            )
        }
    }

    static func categories(
        _ output: Operations.listCategories.Output
    ) throws -> [PlannerCategory] {
        switch output {
        case let .ok(response):
            return try response.body.json.items.map {
                .init(
                    id: $0.id,
                    key: $0.key,
                    label: $0.label,
                    sortOrder: Int($0.sortOrder),
                    revision: Int($0.revision)
                )
            }
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.listCategories.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.listCategories.id,
                statusCode: statusCode
            )
        }
    }

    static func search(
        _ output: Operations.search.Output
    ) throws -> SearchResponse {
        switch output {
        case let .ok(response):
            return search(try response.body.json)
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.search.id,
                statusCode: statusCode
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.search.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.search.id,
                statusCode: 401,
                envelope: response.body.json
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
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getStats.id,
                statusCode: statusCode
            )
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.getStats.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getStats.id,
                statusCode: 401,
                envelope: response.body.json
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
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.listRoutines.id,
                statusCode: statusCode
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.listRoutines.id,
                statusCode: 401,
                envelope: response.body.json
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
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.getActiveFocusSession.id,
                statusCode: statusCode
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.getActiveFocusSession.id,
                statusCode: 401,
                envelope: response.body.json
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
                    startedAt: $0.startedAt,
                    revision: Int($0.revision)
                )
            },
            remainingSec: value.remainingSec
        )
    }

    static func startedFocus(
        _ output: Operations.startFocusSession.Output
    ) throws -> FocusSnapshot {
        switch output {
        case let .created(response):
            return focus(try response.body.json)
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.startFocusSession.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.startFocusSession.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.startFocusSession.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.startFocusSession.id,
                statusCode: statusCode
            )
        }
    }

    static func updatedFocus(
        _ output: Operations.updateFocusSession.Output
    ) throws -> FocusSnapshot {
        switch output {
        case let .ok(response):
            return focus(try response.body.json)
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.updateFocusSession.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.updateFocusSession.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .notFound(response):
            throw try documentedError(
                operation: Operations.updateFocusSession.id,
                statusCode: 404,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.updateFocusSession.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.updateFocusSession.id,
                statusCode: statusCode
            )
        }
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
            hourCycle: value.hourCycle.map(hourCycle),
            theme: value.theme.map(theme),
            reducedStimulation: value.reducedStimulation,
            notificationPrefs: notificationPrefs
        )
    }

    static func activityUpdate(
        _ value: ActivityUpdate
    ) throws -> Components.Schemas.ActivitySeriesUpdateRequest {
        .init(
            editScope: value.editScope.map(editScope),
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
            priority: value.priority.map(priority),
            tags: patch(value.tags),
            notes: patch(value.notes),
            source: value.source.map(source),
            sourceRef: patch(value.sourceRef),
            status: value.status.map(status),
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
            return .case1(.init(
                action: .transition,
                state: focusState(state)
            ))
        case let .extend(minutes):
            return .case2(.init(
                action: .extend,
                addMinutes: focusExtension(minutes)
            ))
        }
    }

    private static func checklist(
        _ values: [Components.Schemas.ActivitySeries
            .checklistTemplatePayloadPayload]
    ) throws -> [Activity.ChecklistItem] {
        try values.enumerated().map { index, item in
            try checklistItem(
                item.additionalProperties.value,
                path: "ActivitySeries.checklistTemplate[\(index)]"
            )
        }
    }

    private static func checklistItem(
        _ object: [String: (any Sendable)?],
        path: String
    ) throws -> Activity.ChecklistItem {
        guard let label = object["label"] as? String else {
            throw GeneratedAPIAdapterError.malformedValue(
                path: "\(path).label"
            )
        }
        guard object.keys.contains("done") else {
            return .init(label: label, done: nil)
        }
        guard
            let rawDone = object["done"] ?? nil,
            let done = rawDone as? Bool
        else {
            throw GeneratedAPIAdapterError.malformedValue(
                path: "\(path).done"
            )
        }
        return .init(label: label, done: done)
    }

    static func checklistObject(
        _ value: ChecklistUpdateItem
    ) throws -> OpenAPIObjectContainer {
        var object: [String: (any Sendable)?] = ["label": value.label]
        if let done = value.done {
            object["done"] = done
        }
        return try OpenAPIObjectContainer(unvalidatedValue: object)
    }

    static func empty(
        _ output: Operations.deleteActivitySeries.Output
    ) throws {
        switch output {
        case .noContent:
            return
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.deleteActivitySeries.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .notFound(response):
            throw try documentedError(
                operation: Operations.deleteActivitySeries.id,
                statusCode: 404,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.deleteActivitySeries.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.deleteActivitySeries.id,
                statusCode: statusCode
            )
        }
    }

    static func empty(_ output: Operations.deleteTask.Output) throws {
        switch output {
        case .noContent:
            return
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.deleteTask.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .notFound(response):
            throw try documentedError(
                operation: Operations.deleteTask.id,
                statusCode: 404,
                envelope: response.body.json
            )
        case let .conflict(response):
            throw try documentedError(
                operation: Operations.deleteTask.id,
                statusCode: 409,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.deleteTask.id,
                statusCode: statusCode
            )
        }
    }

    static func empty(
        _ output: Operations.createMoodCheckin.Output
    ) throws {
        switch output {
        case .created:
            return
        case let .badRequest(response):
            throw try documentedError(
                operation: Operations.createMoodCheckin.id,
                statusCode: 400,
                envelope: response.body.json
            )
        case let .unauthorized(response):
            throw try documentedError(
                operation: Operations.createMoodCheckin.id,
                statusCode: 401,
                envelope: response.body.json
            )
        case let .undocumented(statusCode, _):
            throw GeneratedAPIAdapterError.undocumented(
                operation: Operations.createMoodCheckin.id,
                statusCode: statusCode
            )
        }
    }

    static func documentedError(
        operation: String,
        statusCode: Int,
        envelope: Components.Schemas.ErrorEnvelope
    ) throws -> GeneratedAPIAdapterError {
        let details = try envelope.error.details.map {
            JSONValue.object(
                try jsonObject(
                    $0.additionalProperties.value,
                    path: "ErrorEnvelope.error.details"
                )
            )
        }
        let error = ServerErrorData(
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable,
            details: details
        )
        switch statusCode {
        case 401:
            return .unauthorized(
                operation: operation,
                statusCode: statusCode,
                error: error
            )
        case 404:
            return .notFound(
                operation: operation,
                statusCode: statusCode,
                error: error
            )
        case 409:
            return .conflict(
                operation: operation,
                statusCode: statusCode,
                error: error
            )
        default:
            return .http(
                operation: operation,
                statusCode: statusCode,
                error: error
            )
        }
    }

    private static func jsonObject(
        _ object: [String: (any Sendable)?],
        path: String
    ) throws -> [String: JSONValue] {
        try object.reduce(into: [:]) { result, item in
            result[item.key] = try jsonValue(
                item.value,
                path: "\(path).\(item.key)"
            )
        }
    }

    private static func jsonValue(
        _ value: (any Sendable)?,
        path: String
    ) throws -> JSONValue {
        switch value {
        case nil, is NSNull: .null
        case let value as Bool: .boolean(value)
        case let value as Int: .integer(value)
        case let value as Double: .number(value)
        case let value as Float: .number(Double(value))
        case let value as String: .string(value)
        case let value as [String: (any Sendable)?]:
            .object(try jsonObject(value, path: path))
        case let value as [(any Sendable)?]:
            .array(try value.enumerated().map {
                try jsonValue($0.element, path: "\(path)[\($0.offset)]")
            })
        default:
            throw GeneratedAPIAdapterError.malformedValue(path: path)
        }
    }

    private static func notificationValue(
        _ value: JSONValue
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

    private static func hourCycle(
        _ value: HourCyclePreference
    ) -> Components.Schemas.HourCycle {
        switch value {
        case .h12: .h12
        case .h24: .h24
        }
    }

    private static func theme(
        _ value: ThemePreference
    ) -> Components.Schemas.ThemeMode {
        switch value {
        case .system: .system
        case .light: .light
        case .dark: .dark
        }
    }

    private static func editScope(
        _ value: ActivityEditScope
    ) -> Components.Schemas.EditScope {
        switch value {
        case .this: .this
        case .thisAndFuture: .this_and_future
        case .all: .all
        }
    }

    private static func priority(
        _ value: ActivityPriority
    ) -> Components.Schemas.Priority {
        switch value {
        case .none: .none
        case .low: .low
        case .high: .high
        }
    }

    private static func source(
        _ value: ActivitySource
    ) -> Components.Schemas.ActivitySource {
        switch value {
        case .manual: .manual
        case .routine: .routine
        case .calendar: .calendar
        }
    }

    private static func status(
        _ value: ActivityStatus
    ) -> Components.Schemas.OccurrenceStatus {
        switch value {
        case .pending: .pending
        case .completed: .completed
        case .skipped: .skipped
        case .cancelled: .cancelled
        }
    }

    private static func focusState(
        _ value: FocusTransitionState
    ) -> Components.Schemas.FocusState {
        switch value {
        case .running: .running
        case .paused: .paused
        case .completed: .completed
        case .skipped: .skipped
        case .cancelled: .cancelled
        }
    }

    private static func focusExtension(
        _ value: FocusExtensionMinutes
    ) -> Components.Schemas.FocusSessionPatchRequest
        .Case2Payload.addMinutesPayload
    {
        switch value {
        case .one: ._1
        case .five: ._5
        case .ten: ._10
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
