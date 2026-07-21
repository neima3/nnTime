import SwiftUI

// MARK: - Routine player: one step, one timer, no overwhelm.
// Full-screen. Timed steps count down on a calm ring; untimed steps just wait
// for a tap. Time's-up never yanks you forward — it holds at zero until you're
// ready. Finishing every step earns a gentle "you did the whole thing."

struct RoutinePlayerView: View {
    let routine: Routine
    @Environment(\.dismiss) private var dismiss

    @State private var index = 0
    @State private var secondsLeft = 0
    @State private var paused = false
    @State private var finished = false
    @State private var reduced = false

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var steps: [Routine.Step] { routine.orderedSteps }
    private var step: Routine.Step? { steps.indices.contains(index) ? steps[index] : nil }
    private var isTimed: Bool { (step?.durationMin ?? 0) > 0 }
    private var total: Int { max(1, (step?.durationMin ?? 0) * 60) }
    private var timeUp: Bool { isTimed && secondsLeft <= 0 }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if finished {
                completion
            } else if let step {
                player(step)
            }
        }
        .onAppear {
            reduced = UIAccessibility.isReduceMotionEnabled || KairoPrefs.reducedStimulation
            startStep()
        }
        .onReceive(tick) { _ in
            guard !paused, !finished, isTimed, secondsLeft > 0 else { return }
            secondsLeft -= 1
            if secondsLeft == 0 {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    // MARK: Player

    private func player(_ step: Routine.Step) -> some View {
        VStack(spacing: 0) {
            header
            Spacer()

            // Progress dots
            HStack(spacing: 6) {
                ForEach(steps.indices, id: \.self) { i in
                    Capsule()
                        .fill(i < index ? Color.kSuccess : (i == index ? Color.kIris : Color.kBorderStrong))
                        .frame(width: i == index ? 22 : 7, height: 7)
                }
            }
            .padding(.bottom, 28)

            // Timer ring / untimed badge
            ZStack {
                Circle().stroke(Color.kSurfaceSunken, lineWidth: 12)
                    .frame(width: 232, height: 232)
                if isTimed {
                    Circle()
                        .trim(from: 0, to: CGFloat(secondsLeft) / CGFloat(total))
                        .stroke(timeUp ? Color.kSuccess : Color.kIris,
                                style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 232, height: 232)
                        .animation(reduced ? nil : .linear(duration: 0.9), value: secondsLeft)
                }
                VStack(spacing: 4) {
                    if isTimed {
                        Text(KTime.mmss(max(0, secondsLeft)))
                            .font(.kMono(46, weight: .bold)).foregroundStyle(Color.kInk)
                            .contentTransition(.numericText())
                        Text(timeUp ? "time's up — finish when ready"
                                    : (paused ? "paused" : "on this step"))
                            .font(.kBody(12, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    } else {
                        Text("∞").font(.kDisplay(48)).foregroundStyle(Color.kInk)
                        Text("take your time").font(.kBody(12, weight: .semibold))
                            .foregroundStyle(Color.kInkSoft)
                    }
                }
            }
            .padding(.bottom, 24)

            // Step title + next preview
            Text(step.title)
                .font(.kDisplay(24)).foregroundStyle(Color.kInk)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Text("Step \(index + 1) of \(steps.count)")
                .font(.kBody(12.5, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                .padding(.top, 6)
            if index + 1 < steps.count {
                Text("next · \(steps[index + 1].title)")
                    .font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                    .lineLimit(1).padding(.top, 10)
            }

            Spacer()
            controls
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 28)
    }

    private var header: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.kInkSoft)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.kSurface))
            }
            Spacer()
            HStack(spacing: 7) {
                Text(routine.emoji ?? "🔁")
                Text(routine.title).font(.kBody(14, weight: .bold)).foregroundStyle(Color.kInk)
                    .lineLimit(1)
            }
            Spacer()
            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.top, 8)
    }

    private var controls: some View {
        VStack(spacing: 10) {
            Button {
                advance()
            } label: {
                Text(index + 1 < steps.count ? "Done with this step" : "Finish routine")
                    .font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInkInverse)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(RoundedRectangle(cornerRadius: 18).fill(Color.kIris))
            }
            HStack(spacing: 10) {
                if isTimed {
                    Button { paused.toggle() } label: {
                        Label(paused ? "Resume" : "Pause",
                              systemImage: paused ? "play.fill" : "pause.fill")
                            .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                            .frame(maxWidth: .infinity).padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
                    }
                }
                Button { advance(skipped: true) } label: {
                    Label("Skip", systemImage: "forward.fill")
                        .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
                }
            }
        }
    }

    // MARK: Completion

    private var completion: some View {
        VStack(spacing: 14) {
            Text("🌿").font(.system(size: 60))
            Text("You did the whole thing").font(.kDisplay(26)).foregroundStyle(Color.kInk)
                .multilineTextAlignment(.center)
            Text("\(routine.title) — all \(steps.count) steps, start to finish. That's momentum.")
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                .multilineTextAlignment(.center).padding(.horizontal, 32)
            Button { dismiss() } label: {
                Text("Done").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInkInverse)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(RoundedRectangle(cornerRadius: 18).fill(Color.kIris))
            }
            .padding(.horizontal, 40).padding(.top, 8)
        }
        .padding(24)
    }

    // MARK: Flow

    private func startStep() {
        secondsLeft = (step?.durationMin ?? 0) * 60
        paused = false
    }

    private func advance(skipped: Bool = false) {
        if !skipped {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        if index + 1 < steps.count {
            index += 1
            startStep()
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(reduced ? nil : .spring(response: 0.4, dampingFraction: 0.8)) {
                finished = true
            }
        }
    }
}
