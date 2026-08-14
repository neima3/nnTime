import SwiftUI

/* ---- Edit scope (ADR-001) ------------------------------------------------
 *
 * A repeating activity is one series with many days on it. Saving or deleting
 * one of those days has to say which days it means, or a rename on Tuesday
 * quietly rewrites every Tuesday-and-everything-else. The three choices map
 * 1:1 onto the ADR-001 scopes; "Just this time" is always the default so the
 * safe answer is the one already selected.
 *
 * Copy is kept word for word with the web editor (`SCOPE_COPY` in
 * src/components/ActivityEditor.tsx) — the two platforms must not diverge in
 * wording.
 */

/// Why the prompt is on screen. Drives the verbs and the confirm button.
enum EditScopeIntent: String, Identifiable, Equatable, Sendable {
    case save
    case delete

    var id: String { rawValue }

    var question: String {
        switch self {
        case .save: "Which days should the change land on?"
        case .delete: "Which days should it come off?"
        }
    }

    var legend: String {
        switch self {
        case .save: "Days to change"
        case .delete: "Days to remove"
        }
    }

    var confirmLabel: String {
        switch self {
        case .save: "Save"
        case .delete: "Delete"
        }
    }

    var busyLabel: String {
        switch self {
        case .save: "Saving…"
        case .delete: "Deleting…"
        }
    }
}

extension ActivityEditScope {
    /// Order the choices are offered in — widest blast radius last.
    static let promptOrder: [ActivityEditScope] = [.this, .thisAndFuture, .all]

    var promptLabel: String {
        switch self {
        case .this: "Just this time"
        case .thisAndFuture: "This and every one after"
        case .all: "The whole series"
        }
    }

    func promptHint(for intent: EditScopeIntent) -> String {
        switch (self, intent) {
        case (.this, .save): "Every other day stays exactly as it is."
        case (.this, .delete): "It still shows up on all the other days."
        case (.thisAndFuture, _): "Days before this one stay as they are."
        case (.all, .save): "Every day this happens, past and future."
        case (.all, .delete): "Removes it from every day, past and future."
        }
    }
}

/// What the editor should do about scope for the activity it has open.
///
/// Pulled out of the view so the defaults are unit-testable: the single most
/// important fact about this screen is which choice is preselected, and a
/// SwiftUI `@State` initial value is not something a test can read.
struct EditScopePlan: Equatable, Sendable {
    /// The series carries an RRULE — it lands on more than one day.
    let repeats: Bool
    /// ADR-001 stable occurrence identity for the day that is open.
    let occurrenceKey: String?

    init(repeats: Bool, occurrenceKey: String?) {
        self.repeats = repeats
        self.occurrenceKey = occurrenceKey
    }

    init(block: DayBlock?) {
        self.init(
            repeats: block?.recurring ?? false,
            occurrenceKey: block?.occurrenceKey
        )
    }

    /// A one-off has a single day, so asking would be noise (ADR-001: one-offs
    /// are a series with no RRULE and one occurrence).
    var asksScope: Bool { repeats }

    /// Without a day identity, only the whole-series answer can be honored.
    var scopedChoicesDisabled: Bool { occurrenceKey == nil }

    func allows(_ scope: ActivityEditScope) -> Bool {
        scope == .all || occurrenceKey != nil
    }

    /// The choice the prompt opens on. `nil` means nothing is preselected —
    /// which happens only when the scoped answers are unavailable, so the
    /// whole-series answer needs an explicit tap. `.all` is never silent.
    var defaultChoice: ActivityEditScope? {
        guard repeats else { return .all }
        return occurrenceKey == nil ? nil : .this
    }

    /// The scope a non-repeating series writes with, with no prompt at all.
    var silentScope: ActivityEditScope? { repeats ? nil : .all }
}

/// Builds the PATCH body for a scoped write.
///
/// Returns `nil` when a per-day scope was asked for without a day identity —
/// the caller must surface that rather than fall back to `.all`.
enum EditScopeWrite {
    static func update(
        scope: ActivityEditScope,
        occurrenceKey: Date?,
        tz: String,
        instant: Date,
        title: String,
        emoji: String,
        categoryId: String?,
        checklist: [ChecklistUpdateItem],
        durationMin: Int
    ) -> ActivityUpdate? {
        if scope != .all, occurrenceKey == nil { return nil }
        /* "Just this time" writes an occurrence override, and an override can
         * only carry the fields that belong to a single day (ADR-001). The
         * rest — icon, category, the repeat rule — live on the series, and the
         * route rejects them outright on a `this` edit. */
        if scope == .this {
            return ActivityUpdate(
                editScope: .this,
                occurrenceKey: occurrenceKey,
                title: title,
                durationMin: durationMin,
                startAt: instant,
                checklistOverride: .value(checklist)
            )
        }
        return ActivityUpdate(
            editScope: scope,
            occurrenceKey: scope == .thisAndFuture ? occurrenceKey : nil,
            tz: tz,
            dtstartLocal: instant,
            title: title,
            emoji: .value(emoji),
            categoryId: categoryId.map { .value($0) } ?? .null,
            durationMin: durationMin
        )
    }

    /// Parse an ADR-001 occurrence key (RFC 3339, with or without fractional
    /// seconds) as `DayBlock` renders it.
    static func occurrenceDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    /// Fields the user changed that belong to the whole series, so "Just this
    /// time" can say plainly what it won't carry across.
    static func sharedFields(
        emoji: String,
        savedEmoji: String,
        category: KairoCategory,
        savedCategory: KairoCategory
    ) -> [String] {
        var changed: [String] = []
        if emoji != savedEmoji { changed.append("the icon") }
        if category != savedCategory { changed.append("the category") }
        return changed
    }

    /// "the icon, the category and the notes"
    static func joinWithAnd(_ parts: [String]) -> String {
        guard parts.count > 1 else { return parts.first ?? "" }
        return "\(parts.dropLast().joined(separator: ", ")) and \(parts[parts.count - 1])"
    }

    static func sentenceCase(_ text: String) -> String {
        guard let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }

    /// The full "…is shared by every day" sentence, or nil when nothing shared
    /// changed.
    static func sharedFieldsNote(_ fields: [String]) -> String? {
        guard !fields.isEmpty else { return nil }
        let plural = fields.count > 1
        return "\(sentenceCase(joinWithAnd(fields))) \(plural ? "are" : "is") "
            + "shared by every day, so \(plural ? "they" : "it") won’t change here."
    }
}

// MARK: - The prompt

/// The scope question, asked once, right before the write.
///
/// Radio rows rather than three buttons so the default choice is announced,
/// VoiceOver can move between the choices, and a stray tap can't commit a
/// delete — the answer and the confirmation are separate gestures.
struct EditScopeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let intent: EditScopeIntent
    let plan: EditScopePlan
    /// Changed fields that only exist on the whole series.
    var sharedFields: [String] = []
    let busy: Bool
    let onConfirm: (ActivityEditScope) -> Void

    @State private var choice: ActivityEditScope?

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("This one repeats")
                                .font(.kDisplay(19))
                                .foregroundStyle(Color.kInk)
                            Text(intent.question)
                                .font(.kBody(14))
                                .foregroundStyle(Color.kInkSoft)
                        }
                        .accessibilityElement(children: .combine)

                        VStack(spacing: 10) {
                            ForEach(ActivityEditScope.promptOrder, id: \.self) { scope in
                                row(scope)
                            }
                        }
                        // A container, not an element: a plain
                        // `.accessibilityLabel` here replaced every row's own
                        // label with the legend, so VoiceOver read three
                        // identical "Days to change" buttons.
                        .accessibilityElement(children: .contain)
                        .accessibilityLabel(intent.legend)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 22)
                    .padding(.bottom, 18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                // Pinned, so the answer is never scrolled off at .medium.
                footer
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear { choice = plan.defaultChoice }
    }

    private var footer: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Never mind")
                    .font(.kBody(15, weight: .semibold))
                    .foregroundStyle(Color.kInkSoft)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.kSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(Color.kBorder, lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(.plain)
            confirmRow
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 20)
        .background(
            Color.kSurfaceRaised
                .overlay(alignment: .top) {
                    Rectangle().fill(Color.kBorder).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func row(_ scope: ActivityEditScope) -> some View {
        let disabled = !plan.allows(scope)
        let selected = choice == scope
        return Button {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.12)) {
                choice = scope
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .strokeBorder(
                            selected ? Color.kIris : Color.kBorderStrong,
                            lineWidth: 2
                        )
                        .frame(width: 20, height: 20)
                    if selected {
                        Circle().fill(Color.kIris).frame(width: 10, height: 10)
                    }
                }
                .padding(.top, 2)

                VStack(alignment: .leading, spacing: 3) {
                    Text(scope.promptLabel)
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(selected ? Color.kIris : Color.kInk)
                    Text(scope.promptHint(for: intent))
                        .font(.kBody(13))
                        .foregroundStyle(Color.kInkSoft)
                    if scope == .this, intent == .save,
                       let note = EditScopeWrite.sharedFieldsNote(sharedFields) {
                        Text(note)
                            .font(.kBody(12.5))
                            .foregroundStyle(Color.kInkFaint)
                    }
                    if disabled {
                        Text("Open it from a day to pick this.")
                            .font(.kBody(12.5))
                            .foregroundStyle(Color.kInkFaint)
                    }
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        disabled
                            ? Color.kSurfaceSunken
                            : (selected ? Color.kIrisSoft : Color.kSurface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(
                                selected ? Color.kIris : Color.kBorder,
                                lineWidth: selected ? 2 : 1
                            )
                    )
            )
            .opacity(disabled ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var confirmRow: some View {
        Button {
            guard let choice else { return }
            onConfirm(choice)
        } label: {
            Group {
                if busy {
                    Text(intent.busyLabel)
                } else {
                    Text(intent.confirmLabel)
                }
            }
            .font(.kBody(15, weight: .bold))
            .foregroundStyle(intent == .delete ? Color.kDanger : Color.kInkInverse)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(intent == .delete ? Color.kDangerSoft : Color.kIris)
            )
        }
        .buttonStyle(.plain)
        .disabled(busy || choice == nil)
        .opacity(busy || choice == nil ? 0.6 : 1)
    }
}
