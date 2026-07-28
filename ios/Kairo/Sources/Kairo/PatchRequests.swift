import Foundation
import OpenAPIRuntime

public enum PatchField<Value: Codable & Hashable & Sendable>:
    Codable, Hashable, Sendable
{
    case null
    case value(Value)

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else {
            self = .value(try container.decode(Value.self))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case let .value(value):
            try container.encode(value)
        }
    }
}

private extension KeyedDecodingContainer {
    func decodePatchField<Value>(
        _ type: Value.Type,
        forKey key: Key
    ) throws -> PatchField<Value>?
    where Value: Codable & Hashable & Sendable {
        guard contains(key) else { return nil }
        if try decodeNil(forKey: key) { return .null }
        return .value(try decode(type, forKey: key))
    }
}

private extension KeyedEncodingContainer {
    mutating func encodePatchField<Value>(
        _ field: PatchField<Value>?,
        forKey key: Key
    ) throws where Value: Codable & Hashable & Sendable {
        guard let field else { return }
        try encode(field, forKey: key)
    }
}

public struct KairoChecklistOverrideItem: Codable, Hashable, Sendable {
    public var label: String
    public var done: Bool?

    public init(label: String, done: Bool? = nil) {
        self.label = label
        self.done = done
    }
}

public struct KairoActivitySeriesUpdateRequest:
    Codable, Hashable, Sendable
{
    public var editScope: Components.Schemas.EditScope?
    public var occurrenceKey: Date?
    public var tz: String?
    public var dtstartLocal: Date?
    public var rrule: PatchField<String>?
    public var exdate: PatchField<[String]>?
    public var rdate: PatchField<[Date]>?
    public var title: String?
    public var emoji: PatchField<String>?
    public var categoryId: PatchField<String>?
    public var durationMin: Int32?
    public var checklistTemplate: [OpenAPIObjectContainer]?
    public var energy: PatchField<Components.Schemas.EnergyLevel>?
    public var priority: Components.Schemas.Priority?
    public var tags: PatchField<[String]>?
    public var notes: PatchField<String>?
    public var source: Components.Schemas.ActivitySource?
    public var sourceRef: PatchField<String>?
    public var status: Components.Schemas.OccurrenceStatus?
    public var startAt: Date?
    public var completedAt: PatchField<Date>?
    public var checklistOverride: PatchField<[KairoChecklistOverrideItem]>?

    public init(
        editScope: Components.Schemas.EditScope? = nil,
        occurrenceKey: Date? = nil,
        tz: String? = nil,
        dtstartLocal: Date? = nil,
        rrule: PatchField<String>? = nil,
        exdate: PatchField<[String]>? = nil,
        rdate: PatchField<[Date]>? = nil,
        title: String? = nil,
        emoji: PatchField<String>? = nil,
        categoryId: PatchField<String>? = nil,
        durationMin: Int32? = nil,
        checklistTemplate: [OpenAPIObjectContainer]? = nil,
        energy: PatchField<Components.Schemas.EnergyLevel>? = nil,
        priority: Components.Schemas.Priority? = nil,
        tags: PatchField<[String]>? = nil,
        notes: PatchField<String>? = nil,
        source: Components.Schemas.ActivitySource? = nil,
        sourceRef: PatchField<String>? = nil,
        status: Components.Schemas.OccurrenceStatus? = nil,
        startAt: Date? = nil,
        completedAt: PatchField<Date>? = nil,
        checklistOverride: PatchField<[KairoChecklistOverrideItem]>? = nil
    ) {
        self.editScope = editScope
        self.occurrenceKey = occurrenceKey
        self.tz = tz
        self.dtstartLocal = dtstartLocal
        self.rrule = rrule
        self.exdate = exdate
        self.rdate = rdate
        self.title = title
        self.emoji = emoji
        self.categoryId = categoryId
        self.durationMin = durationMin
        self.checklistTemplate = checklistTemplate
        self.energy = energy
        self.priority = priority
        self.tags = tags
        self.notes = notes
        self.source = source
        self.sourceRef = sourceRef
        self.status = status
        self.startAt = startAt
        self.completedAt = completedAt
        self.checklistOverride = checklistOverride
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        editScope = try container.decodeIfPresent(
            Components.Schemas.EditScope.self,
            forKey: .editScope
        )
        occurrenceKey = try container.decodeIfPresent(
            Date.self,
            forKey: .occurrenceKey
        )
        tz = try container.decodeIfPresent(String.self, forKey: .tz)
        dtstartLocal = try container.decodeIfPresent(
            Date.self,
            forKey: .dtstartLocal
        )
        rrule = try container.decodePatchField(String.self, forKey: .rrule)
        exdate = try container.decodePatchField([String].self, forKey: .exdate)
        rdate = try container.decodePatchField([Date].self, forKey: .rdate)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        emoji = try container.decodePatchField(String.self, forKey: .emoji)
        categoryId = try container.decodePatchField(
            String.self,
            forKey: .categoryId
        )
        durationMin = try container.decodeIfPresent(
            Int32.self,
            forKey: .durationMin
        )
        checklistTemplate = try container.decodeIfPresent(
            [OpenAPIObjectContainer].self,
            forKey: .checklistTemplate
        )
        energy = try container.decodePatchField(
            Components.Schemas.EnergyLevel.self,
            forKey: .energy
        )
        priority = try container.decodeIfPresent(
            Components.Schemas.Priority.self,
            forKey: .priority
        )
        tags = try container.decodePatchField([String].self, forKey: .tags)
        notes = try container.decodePatchField(String.self, forKey: .notes)
        source = try container.decodeIfPresent(
            Components.Schemas.ActivitySource.self,
            forKey: .source
        )
        sourceRef = try container.decodePatchField(
            String.self,
            forKey: .sourceRef
        )
        status = try container.decodeIfPresent(
            Components.Schemas.OccurrenceStatus.self,
            forKey: .status
        )
        startAt = try container.decodeIfPresent(Date.self, forKey: .startAt)
        completedAt = try container.decodePatchField(
            Date.self,
            forKey: .completedAt
        )
        checklistOverride = try container.decodePatchField(
            [KairoChecklistOverrideItem].self,
            forKey: .checklistOverride
        )
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(editScope, forKey: .editScope)
        try container.encodeIfPresent(occurrenceKey, forKey: .occurrenceKey)
        try container.encodeIfPresent(tz, forKey: .tz)
        try container.encodeIfPresent(dtstartLocal, forKey: .dtstartLocal)
        try container.encodePatchField(rrule, forKey: .rrule)
        try container.encodePatchField(exdate, forKey: .exdate)
        try container.encodePatchField(rdate, forKey: .rdate)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodePatchField(emoji, forKey: .emoji)
        try container.encodePatchField(categoryId, forKey: .categoryId)
        try container.encodeIfPresent(durationMin, forKey: .durationMin)
        try container.encodeIfPresent(
            checklistTemplate,
            forKey: .checklistTemplate
        )
        try container.encodePatchField(energy, forKey: .energy)
        try container.encodeIfPresent(priority, forKey: .priority)
        try container.encodePatchField(tags, forKey: .tags)
        try container.encodePatchField(notes, forKey: .notes)
        try container.encodeIfPresent(source, forKey: .source)
        try container.encodePatchField(sourceRef, forKey: .sourceRef)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(startAt, forKey: .startAt)
        try container.encodePatchField(completedAt, forKey: .completedAt)
        try container.encodePatchField(
            checklistOverride,
            forKey: .checklistOverride
        )
    }

    private enum CodingKeys: String, CodingKey {
        case editScope
        case occurrenceKey
        case tz
        case dtstartLocal
        case rrule
        case exdate
        case rdate
        case title
        case emoji
        case categoryId
        case durationMin
        case checklistTemplate
        case energy
        case priority
        case tags
        case notes
        case source
        case sourceRef
        case status
        case startAt
        case completedAt
        case checklistOverride
    }
}

public struct KairoActivityOccurrencePatchRequest:
    Codable, Hashable, Sendable
{
    public var title: PatchField<String>?
    public var startAt: PatchField<Date>?
    public var durationMin: PatchField<Int32>?
    public var status: Components.Schemas.OccurrenceStatus?
    public var checklistOverride: PatchField<OpenAPIObjectContainer>?
    public var energy: PatchField<Components.Schemas.EnergyLevel>?
    public var completedAt: PatchField<Date>?

    public init(
        title: PatchField<String>? = nil,
        startAt: PatchField<Date>? = nil,
        durationMin: PatchField<Int32>? = nil,
        status: Components.Schemas.OccurrenceStatus? = nil,
        checklistOverride: PatchField<OpenAPIObjectContainer>? = nil,
        energy: PatchField<Components.Schemas.EnergyLevel>? = nil,
        completedAt: PatchField<Date>? = nil
    ) {
        self.title = title
        self.startAt = startAt
        self.durationMin = durationMin
        self.status = status
        self.checklistOverride = checklistOverride
        self.energy = energy
        self.completedAt = completedAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodePatchField(String.self, forKey: .title)
        startAt = try container.decodePatchField(Date.self, forKey: .startAt)
        durationMin = try container.decodePatchField(
            Int32.self,
            forKey: .durationMin
        )
        status = try container.decodeIfPresent(
            Components.Schemas.OccurrenceStatus.self,
            forKey: .status
        )
        checklistOverride = try container.decodePatchField(
            OpenAPIObjectContainer.self,
            forKey: .checklistOverride
        )
        energy = try container.decodePatchField(
            Components.Schemas.EnergyLevel.self,
            forKey: .energy
        )
        completedAt = try container.decodePatchField(
            Date.self,
            forKey: .completedAt
        )
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodePatchField(title, forKey: .title)
        try container.encodePatchField(startAt, forKey: .startAt)
        try container.encodePatchField(durationMin, forKey: .durationMin)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodePatchField(
            checklistOverride,
            forKey: .checklistOverride
        )
        try container.encodePatchField(energy, forKey: .energy)
        try container.encodePatchField(completedAt, forKey: .completedAt)
    }

    private enum CodingKeys: String, CodingKey {
        case title
        case startAt
        case durationMin
        case status
        case checklistOverride
        case energy
        case completedAt
    }
}

public struct KairoTaskUpdateRequest: Codable, Hashable, Sendable {
    public var bucket: Components.Schemas.TaskBucket?
    public var title: String?
    public var emoji: PatchField<String>?
    public var categoryId: PatchField<String>?
    public var date: PatchField<String>?
    public var priority: Components.Schemas.Priority?
    public var energy: PatchField<Components.Schemas.EnergyLevel>?
    public var notes: PatchField<String>?

    public init(
        bucket: Components.Schemas.TaskBucket? = nil,
        title: String? = nil,
        emoji: PatchField<String>? = nil,
        categoryId: PatchField<String>? = nil,
        date: PatchField<String>? = nil,
        priority: Components.Schemas.Priority? = nil,
        energy: PatchField<Components.Schemas.EnergyLevel>? = nil,
        notes: PatchField<String>? = nil
    ) {
        self.bucket = bucket
        self.title = title
        self.emoji = emoji
        self.categoryId = categoryId
        self.date = date
        self.priority = priority
        self.energy = energy
        self.notes = notes
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        bucket = try container.decodeIfPresent(
            Components.Schemas.TaskBucket.self,
            forKey: .bucket
        )
        title = try container.decodeIfPresent(String.self, forKey: .title)
        emoji = try container.decodePatchField(String.self, forKey: .emoji)
        categoryId = try container.decodePatchField(
            String.self,
            forKey: .categoryId
        )
        date = try container.decodePatchField(String.self, forKey: .date)
        priority = try container.decodeIfPresent(
            Components.Schemas.Priority.self,
            forKey: .priority
        )
        energy = try container.decodePatchField(
            Components.Schemas.EnergyLevel.self,
            forKey: .energy
        )
        notes = try container.decodePatchField(String.self, forKey: .notes)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(bucket, forKey: .bucket)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodePatchField(emoji, forKey: .emoji)
        try container.encodePatchField(categoryId, forKey: .categoryId)
        try container.encodePatchField(date, forKey: .date)
        try container.encodeIfPresent(priority, forKey: .priority)
        try container.encodePatchField(energy, forKey: .energy)
        try container.encodePatchField(notes, forKey: .notes)
    }

    private enum CodingKeys: String, CodingKey {
        case bucket
        case title
        case emoji
        case categoryId
        case date
        case priority
        case energy
        case notes
    }
}

public struct KairoTagUpdateRequest: Codable, Hashable, Sendable {
    public var name: String?
    public var color: PatchField<String>?

    public init(
        name: String? = nil,
        color: PatchField<String>? = nil
    ) {
        self.name = name
        self.color = color
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        color = try container.decodePatchField(String.self, forKey: .color)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodePatchField(color, forKey: .color)
    }

    private enum CodingKeys: String, CodingKey {
        case name
        case color
    }
}

public struct KairoRoutineUpdateRequest: Codable, Hashable, Sendable {
    public var title: String?
    public var emoji: PatchField<String>?
    public var categoryId: PatchField<String>?
    public var notes: PatchField<String>?

    public init(
        title: String? = nil,
        emoji: PatchField<String>? = nil,
        categoryId: PatchField<String>? = nil,
        notes: PatchField<String>? = nil
    ) {
        self.title = title
        self.emoji = emoji
        self.categoryId = categoryId
        self.notes = notes
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        emoji = try container.decodePatchField(String.self, forKey: .emoji)
        categoryId = try container.decodePatchField(
            String.self,
            forKey: .categoryId
        )
        notes = try container.decodePatchField(String.self, forKey: .notes)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodePatchField(emoji, forKey: .emoji)
        try container.encodePatchField(categoryId, forKey: .categoryId)
        try container.encodePatchField(notes, forKey: .notes)
    }

    private enum CodingKeys: String, CodingKey {
        case title
        case emoji
        case categoryId
        case notes
    }
}
