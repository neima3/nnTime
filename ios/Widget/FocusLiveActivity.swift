import AppIntents
import WidgetKit
import SwiftUI
#if canImport(ActivityKit)
import ActivityKit

// MARK: - Focus Live Activity (ios-adaptation.md §4)
// Lock-screen banner + Dynamic Island. The countdown ticks by itself via
// timerInterval text — no per-second pushes.

struct FocusLiveActivity: Widget {
    private let sky = Color(red: 0.784, green: 0.891, blue: 0.98)
    private let skyInk = Color(red: 0.114, green: 0.416, blue: 0.651)
    private let ink = Color(red: 0.141, green: 0.122, blue: 0.192)
    private let now = Color(red: 1.0, green: 0.361, blue: 0.302)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusAttributes.self) { context in
            // Lock screen banner
            VStack(spacing: 10) {
                HStack(spacing: 12) {
                    Text(context.attributes.emoji)
                        .font(.system(size: 22))
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(.white.opacity(0.7)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.title)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .lineLimit(1)
                        Text(context.state.paused ? "paused"
                             : context.state.overtime ? "past target — that's okay"
                             : "focusing · \(context.attributes.targetMin) min target")
                            .font(.system(size: 12, weight: .medium))
                            .opacity(0.7)
                    }
                    Spacer()
                    Group {
                        if context.state.paused {
                            Text(remaining(context.state.pausedRemainingSec))
                        } else if context.state.overtime {
                            Text("+").font(.system(size: 18, weight: .bold, design: .monospaced)) +
                            Text(timerInterval: context.state.endDate...Date.distantFuture, countsDown: false)
                        } else {
                            Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                        }
                    }
                    .font(.system(size: 24, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(context.state.overtime ? now : ink)
                    .frame(minWidth: 78, alignment: .trailing)
                }
                HStack(spacing: 8) {
                    Button(intent: ToggleFocusIntent(
                        sessionId: context.attributes.sessionId,
                        shouldPause: !context.state.paused
                    )) {
                        Label(
                            context.state.paused ? "Resume" : "Pause",
                            systemImage: context.state.paused
                                ? "play.fill" : "pause.fill"
                        )
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(skyInk)
                    .accessibilityLabel(
                        context.state.paused
                            ? "Resume focus session"
                            : "Pause focus session"
                    )
                    Button(intent: CompleteFocusIntent(
                        sessionId: context.attributes.sessionId
                    )) {
                        Label("Done", systemImage: "checkmark")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(skyInk)
                    .accessibilityLabel("Complete focus session")
                }
            }
            .foregroundStyle(ink)
            .padding(14)
            .activityBackgroundTint(sky)
            .activitySystemActionForegroundColor(skyInk)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                focusAccessibilityLabel(
                    attributes: context.attributes,
                    state: context.state
                )
            )
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Text(context.attributes.emoji).font(.system(size: 22))
                        Text(context.attributes.title)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .lineLimit(1)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(
                        "Focus session, \(context.attributes.title)"
                    )
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Group {
                        if context.state.paused {
                            Text(remaining(context.state.pausedRemainingSec))
                        } else if context.state.overtime {
                            Text(timerInterval: context.state.endDate...Date.distantFuture, countsDown: false)
                        } else {
                            Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                        }
                    }
                    .font(.system(size: 20, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(context.state.overtime ? now : .primary)
                    .frame(maxWidth: 70, alignment: .trailing)
                    .accessibilityLabel(
                        focusAccessibilityLabel(
                            attributes: context.attributes,
                            state: context.state
                        )
                    )
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        Button(intent: ToggleFocusIntent(
                            sessionId: context.attributes.sessionId,
                            shouldPause: !context.state.paused
                        )) {
                            Label(
                                context.state.paused ? "Resume" : "Pause",
                                systemImage: context.state.paused
                                    ? "play.fill" : "pause.fill"
                            )
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(skyInk)
                        .accessibilityLabel(
                            context.state.paused
                                ? "Resume focus session"
                                : "Pause focus session"
                        )
                        Button(intent: CompleteFocusIntent(
                            sessionId: context.attributes.sessionId
                        )) {
                            Label("Done", systemImage: "checkmark")
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(skyInk)
                        .accessibilityLabel("Complete focus session")
                        Link(destination: URL(string: "kairo://focus")!) {
                            Image(systemName: "arrow.up.forward.app")
                                .font(.system(size: 13, weight: .bold))
                                .frame(width: 34)
                        }
                        .buttonStyle(.bordered)
                        .tint(skyInk)
                        .accessibilityLabel("Open Kairo focus")
                    }
                }
            } compactLeading: {
                Text("◔").font(.system(size: 15, weight: .bold)).foregroundStyle(sky)
            } compactTrailing: {
                Group {
                    if context.state.paused {
                        Image(systemName: "pause.fill").font(.system(size: 11))
                    } else if context.state.overtime {
                        Text(timerInterval: context.state.endDate...Date.distantFuture, countsDown: false)
                            .monospacedDigit()
                            .frame(maxWidth: 46)
                    } else {
                        Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                            .monospacedDigit()
                            .frame(maxWidth: 46)
                    }
                }
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(context.state.overtime ? now : sky)
            } minimal: {
                Text("◔").font(.system(size: 13, weight: .bold)).foregroundStyle(sky)
            }
        }
    }

    private func remaining(_ sec: Int) -> String {
        String(format: "%02d:%02d", max(0, sec) / 60, max(0, sec) % 60)
    }

    private func focusAccessibilityLabel(
        attributes: FocusAttributes,
        state: FocusAttributes.ContentState
    ) -> String {
        let status: String
        if state.paused {
            status = "paused, \(remaining(state.pausedRemainingSec)) remaining"
        } else if state.overtime {
            status = "past target"
        } else {
            status = "in progress"
        }
        return "Focus, \(attributes.title), \(status), \(attributes.targetMin) minute target"
    }
}
#endif
