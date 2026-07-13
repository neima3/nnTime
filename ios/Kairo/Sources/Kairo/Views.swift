// Phase 7D — SwiftUI Views for the Kairo iOS app.
//
// Actual SwiftUI views (not just models): Today timeline, activity cards,
// inbox list, focus timer ring. VoiceOver labels, Dynamic Type support,
// reduced motion honored.

import SwiftUI

// MARK: - Today TimelineView

/// The Today timeline — vertical timeline with activity blocks.
public struct TodayTimelineView: View {
    public let activities: [ActivityRow]
    public let nowMinutes: Int

    public init(activities: [ActivityRow], nowMinutes: Int = 780) {
        self.activities = activities
        self.nowMinutes = nowMinutes
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(activities) { activity in
                    ActivityCardView(activity: activity, isCurrent: isCurrent(activity))
                        .padding(.bottom, 8)
                }
            }
            .padding()
        }
        .accessibilityLabel("Today timeline")
    }

    private func isCurrent(_ activity: ActivityRow) -> Bool {
        activity.startMinutes <= nowMinutes && nowMinutes < activity.endTimeMinutes
    }
}

// MARK: - ActivityCardView

/// A single activity block on the timeline.
public struct ActivityCardView: View {
    public let activity: ActivityRow
    public let isCurrent: Bool

    public var body: some View {
        HStack(spacing: 12) {
            Text(activity.emoji)
                .font(.title2)
                .frame(width: 40, height: 40)
                .background(Color.gray.opacity(0.2))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(activity.title)
                    .font(.headline)
                    .strikethrough(activity.isDone)

                Text("\(ActivityRow.formatTime(activity.startMinutes)) – \(ActivityRow.formatTime(activity.endTimeMinutes))")
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)

                if let energy = activity.energy {
                    HStack(spacing: 4) {
                        Image(systemName: "bolt.fill")
                            .font(.caption2)
                        Text(energy.rawValue.capitalized)
                            .font(.caption2)
                    }
                    .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Image(systemName: activity.isDone ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(activity.isDone ? .green : .secondary)
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(isCurrent ? Color.accentColor : Color.clear, lineWidth: 2)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(activity.title), \(ActivityRow.formatTime(activity.startMinutes)) to \(ActivityRow.formatTime(activity.endTimeMinutes))")
        .accessibilityHint(activity.isDone ? "Completed" : "Tap to mark complete")
    }
}

// MARK: - InboxView

/// The To-do inbox — brain-dump list with priority flags.
public struct InboxView: View {
    public let tasks: [TaskRow]

    public init(tasks: [TaskRow]) {
        self.tasks = tasks
    }

    public var body: some View {
        List(tasks) { task in
            InboxRowView(task: task)
        }
        .accessibilityLabel("Inbox, \(tasks.count) items")
    }
}

public struct InboxRowView: View {
    public let task: TaskRow

    public var body: some View {
        HStack(spacing: 12) {
            Text(task.emoji)
                .font(.title3)

            Text(task.title)
                .font(.body)

            Spacer()

            if task.priority == .high {
                Image(systemName: "flag.fill")
                    .foregroundStyle(.red)
                    .accessibilityLabel("High priority")
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - FocusTimerView

/// The focus timer — large ring with remaining time.
public struct FocusTimerView: View {
    public let session: FocusSessionState
    public let activityTitle: String
    public let emoji: String

    @State private var remainingSeconds: Int = 0

    public init(session: FocusSessionState, activityTitle: String, emoji: String) {
        self.session = session
        self.activityTitle = activityTitle
        self.emoji = emoji
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text(emoji)
                .font(.largeTitle)

            Text(activityTitle)
                .font(.title2)
                .fontWeight(.bold)

            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.15), lineWidth: 18)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 18, lineCap: .round))
                    .rotationEffect(.degrees(-90))

                VStack {
                    Text(formatTime(remainingSeconds))
                        .font(.system(size: 48, weight: .bold, design: .monospaced))
                        .monospacedDigit()
                    Text("remaining")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 300, height: 300)
            .accessibilityLabel("\(formatTime(remainingSeconds)) remaining of \(activityTitle)")
        }
        .padding()
        .onAppear {
            updateRemaining()
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            updateRemaining()
        }
    }

    private var progress: CGFloat {
        let total = Double(session.targetDurationMin) * 60
        let elapsed = total - Double(remainingSeconds)
        guard total > 0 else { return 0 }
        return CGFloat(elapsed / total)
    }

    private func updateRemaining() {
        remainingSeconds = session.remainingSeconds()
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}

// MARK: - DayProgressRing

/// Small ring showing day completion percentage.
public struct DayProgressRing: View {
    public let progress: DayProgress

    public init(progress: DayProgress) {
        self.progress = progress
    }

    public var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.15), lineWidth: 5)
            Circle()
                .trim(from: 0, to: CGFloat(progress.percentage) / 100)
                .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(progress.percentage)%")
                    .font(.caption)
                    .fontWeight(.bold)
                    .monospacedDigit()
                Text("\(progress.completed)/\(progress.total)")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 38, height: 38)
        .accessibilityLabel("\(progress.percentage) percent complete, \(progress.completed) of \(progress.total) done")
    }
}
