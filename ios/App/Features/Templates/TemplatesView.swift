import SwiftUI

// MARK: - Templates (T5 parity) — ready-made blocks you can drop into today.
// Mirrors web BUILTIN_TEMPLATES; applying one creates an activity at 9am today
// with the steps as a checklist.

struct KTemplate: Identifiable {
    let id: String
    let title: String
    let emoji: String
    let category: String
    let group: String
    let steps: [String]
    let minutes: Int
}

enum TemplateData {
    static let all: [KTemplate] = [
        .init(id: "tpl_morning_gentle", title: "Gentle morning", emoji: "🌤️", category: "butter", group: "Morning", steps: ["Water + meds", "Stretch 5 min", "Breakfast"], minutes: 40),
        .init(id: "tpl_work_launch", title: "Launch into work", emoji: "🚀", category: "lilac", group: "Work", steps: ["Clear desk", "Pick ONE task", "45-min focus"], minutes: 60),
        .init(id: "tpl_study_sprint", title: "Study sprint", emoji: "📚", category: "sky", group: "Study", steps: ["Set topic", "25-min pomodoro", "5-min break"], minutes: 55),
        .init(id: "tpl_reset_space", title: "Reset the space", emoji: "🧺", category: "mint", group: "Home", steps: ["10-min tidy", "Dishes", "Tomorrow's clothes"], minutes: 35),
        .init(id: "tpl_soft_landing", title: "Soft landing", emoji: "🌙", category: "lilac", group: "Evening", steps: ["Screens off", "Tomorrow's plan", "Read"], minutes: 45),
        .init(id: "tpl_body_kindness", title: "Body kindness", emoji: "🫶", category: "rose", group: "Self-care", steps: ["Walk outside", "Water", "One nice thing"], minutes: 30),
        .init(id: "tpl_meal_prep", title: "Meal prep basics", emoji: "🥘", category: "peach", group: "Home", steps: ["Plan 3 meals", "Grocery list", "Cook base batch"], minutes: 75),
        .init(id: "tpl_admin_hour", title: "Admin power hour", emoji: "📮", category: "sky", group: "Work", steps: ["Inbox zero-ish", "Pay bills", "Calendar check"], minutes: 60),
        .init(id: "tpl_sunday_preview", title: "Sunday preview", emoji: "🗓️", category: "butter", group: "Evening", steps: ["Review week", "Pick 3 priorities", "First block Monday"], minutes: 30),
        .init(id: "tpl_deep_work", title: "Deep work block", emoji: "🎯", category: "lilac", group: "Work", steps: ["Phone away", "Define deliverable", "90-min focus", "10-min break"], minutes: 100),
        .init(id: "tpl_gym_push", title: "Gym — push day", emoji: "🏋️", category: "mint", group: "Movement", steps: ["Warm up", "Bench", "Shoulders", "Triceps", "Cool down"], minutes: 75),
        .init(id: "tpl_wind_down", title: "Wind down", emoji: "🌙", category: "lilac", group: "Evening", steps: ["Screens off", "Tomorrow's plan", "Read"], minutes: 45),
        .init(id: "tpl_meds_check", title: "Meds + water check", emoji: "💊", category: "sky", group: "Health", steps: ["Morning meds", "Water bottle", "Evening meds reminder"], minutes: 10),
        .init(id: "tpl_creative_block", title: "Unstick creativity", emoji: "🎨", category: "lilac", group: "Creative", steps: ["Change location", "Free-write 5 min", "Pick one thread"], minutes: 20),
        .init(id: "tpl_transition", title: "Work→home transition", emoji: "🚪", category: "butter", group: "Routine", steps: ["Close laptop", "10-min walk", "Change clothes", "Snack"], minutes: 25),
    ]

    static var groups: [String] {
        var seen: [String] = []
        for t in all where !seen.contains(t.group) { seen.append(t.group) }
        return seen
    }
}

struct TemplatesView: View {
    @Environment(AppState.self) private var app
    @State private var applying: String?
    @State private var appliedId: String?

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Ready-made blocks. Tap one and it lands on today at 9am — steps included, yours to reshape.")
                        .font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                    ForEach(TemplateData.groups, id: \.self) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(group.uppercased())
                                .font(.kBody(11, weight: .bold)).foregroundStyle(Color.kInkFaint)
                                .tracking(1)
                            ForEach(TemplateData.all.filter { $0.group == group }) { t in
                                card(t)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Templates").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
            }
        }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
    }

    private func card(_ t: KTemplate) -> some View {
        let cat = KairoCategory(rawValue: t.category) ?? .sky
        let applied = appliedId == t.id
        return HStack(spacing: 13) {
            Text(t.emoji).font(.system(size: 24))
                .frame(width: 48, height: 48)
                .background(RoundedRectangle(cornerRadius: 14).fill(cat.fill))
            VStack(alignment: .leading, spacing: 2) {
                Text(t.title).font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
                Text(t.steps.joined(separator: " · "))
                    .font(.kBody(12)).foregroundStyle(Color.kInkSoft)
                    .lineLimit(1)
                Text("\(t.steps.count) steps · \(KTime.duration(t.minutes))")
                    .font(.kBody(11)).foregroundStyle(Color.kInkFaint)
            }
            Spacer(minLength: 4)
            Button {
                Task { await apply(t) }
            } label: {
                if applied {
                    Label("Added", systemImage: "checkmark")
                        .font(.kBody(12.5, weight: .bold)).foregroundStyle(Color.kSuccess)
                } else if applying == t.id {
                    ProgressView().tint(.kIris)
                } else {
                    Text("Add").font(.kBody(13, weight: .bold)).foregroundStyle(Color.kInkInverse)
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(Capsule().fill(Color.kIris))
                }
            }
            .disabled(applying != nil || applied)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 18)
    }

    private func apply(_ t: KTemplate) async {
        applying = t.id
        let today = KTime.dateString(Date(), zone: app.timezone)
        let dtstart = KTime.instant(date: today, minutes: 9 * 60, zone: app.timezone)
        let checklist = t.steps.map { ["label": $0, "done": false] as [String: Any] }
        do {
            _ = try await KairoAPI.shared.createActivity(
                tz: app.timezone.identifier, dtstartLocal: dtstart,
                title: t.title, emoji: t.emoji, durationMin: t.minutes,
                rrule: nil, categoryId: app.categoryIdByKey[t.category],
                checklist: checklist
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            appliedId = t.id
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
        applying = nil
    }
}
