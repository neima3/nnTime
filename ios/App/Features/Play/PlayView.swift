import SwiftUI

// MARK: - Brain breaks: two minutes of play counts as rest. Personal bests only.

struct PlayView: View {
    @State private var active: Game?
    enum Game: String, Identifiable { case timeFeel, quickTap, breath; var id: String { rawValue } }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Two minutes of play counts as rest. No streaks, no scores that matter — just your own bests.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).padding(.bottom, 4)
                    card("⏳", "Time Feel", "Your brain vs. the clock — no peeking.", .kCatLilac) { active = .timeFeel }
                    card("⚡", "Quick Tap", "Purple means go. How fast are you today?", .kCatButter) { active = .quickTap }
                    card("🫧", "Steady Breath", "A square minute for a spinning head.", .kCatMint) { active = .breath }
                    Text("Honesty corner: these are breaks, not brain training — the science on games \"fixing\" attention is thin, and we won't pretend otherwise.")
                        .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint).padding(.top, 8)
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .principal) {
            Text("Brain breaks").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
        } }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .fullScreenCover(item: $active) { game in
            switch game {
            case .timeFeel: TimeFeelGame { active = nil }
            case .quickTap: QuickTapGame { active = nil }
            case .breath: SteadyBreathGame { active = nil }
            }
        }
    }

    private func card(_ emoji: String, _ title: String, _ hook: String, _ tint: Color, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 14) {
                Text(emoji).font(.system(size: 26)).frame(width: 52, height: 52).background(RoundedRectangle(cornerRadius: 16).fill(tint))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.kBody(17, weight: .bold)).foregroundStyle(Color.kInk)
                    Text(hook).font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.kInkFaint)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
        }
    }
}

// Shared game chrome
private struct GameChrome<Content: View>: View {
    let title: String; let onExit: () -> Void; @ViewBuilder var content: Content
    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack {
                HStack {
                    Text(title).font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
                    Spacer()
                    Button { onExit() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                            .frame(width: 40, height: 40).background(Circle().fill(Color.kSurface)).kCardShadow()
                    }
                }.padding(.horizontal, 20).padding(.top, 16)
                Spacer(); content; Spacer()
            }
        }
    }
}

// MARK: Time Feel — reproduce N seconds without a clock
struct TimeFeelGame: View {
    let onExit: () -> Void
    @State private var stage = 0   // 0 intro, 1 counting, 2 feedback, 3 done
    @State private var round = 0
    @State private var startedAt = Date()
    @State private var results: [(target: Int, actual: Double)] = []
    private let targets = [5, 8, 12, 20]

    var body: some View {
        GameChrome(title: "Time Feel", onExit: onExit) {
            let target = targets[min(round, targets.count - 1)]
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Round \(round + 1) of \(targets.count)").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                    Text("\(target) seconds").font(.kDisplay(44)).foregroundStyle(Color.kInk)
                    Text("Feel the time pass, tap when \(target)s are up. No counting out loud.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 40)
                    Button("Start feeling") { startedAt = Date(); stage = 1 }
                        .buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Button {
                        results.append((target, Date().timeIntervalSince(startedAt)))
                        stage = round + 1 >= targets.count ? 3 : 2
                    } label: {
                        VStack(spacing: 10) {
                            Text("⏳").font(.system(size: 48))
                            Text("Tap when \(target)s feel over").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
                        }
                        .frame(width: 240, height: 240).background(Circle().stroke(Color.kIrisSoft, lineWidth: 8)).background(Circle().fill(Color.kSurface)).kFloatShadow()
                    }
                } else if stage == 2, let last = results.last {
                    Text(String(format: "%.1fs", last.actual)).font(.kDisplay(40)).foregroundStyle(Color.kInk)
                    Text(feeling(last)).font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInk).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Next round") { round += 1; stage = 0 }.buttonStyle(PrimaryPill())
                } else {
                    Text("Inner clock: \(score())/100").font(.kDisplay(30)).foregroundStyle(Color.kInk)
                    Text("Everyone's clock drifts — that's exactly why your timeline does the feeling for you.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
    }
    private func feeling(_ r: (target: Int, actual: Double)) -> String {
        let err = (r.actual - Double(r.target)) / Double(r.target)
        if abs(err) <= 0.08 { return "Spot on. Your inner clock showed up today." }
        return err < 0 ? "\(r.target)s felt shorter to you — a fast-running brain." : "\(r.target)s felt longer — time was dragging."
    }
    private func score() -> Int {
        guard !results.isEmpty else { return 0 }
        let mean = results.map { abs($0.actual - Double($0.target)) / Double($0.target) }.reduce(0, +) / Double(results.count)
        return max(0, Int((1 - mean) * 100))
    }
}

// MARK: Quick Tap
struct QuickTapGame: View {
    let onExit: () -> Void
    @State private var stage = 0  // 0 intro, 1 wait, 2 go, 3 early, 4 between, 5 done
    @State private var round = 0
    @State private var goAt = Date()
    @State private var times: [Int] = []
    @State private var last = 0
    @State private var task: Task<Void, Never>?
    private let rounds = 5

    var body: some View {
        GameChrome(title: "Quick Tap", onExit: onExit) {
            VStack(spacing: 18) {
                switch stage {
                case 0:
                    Text("Wait for purple, then tap fast. \(rounds) rounds, average wins.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 40)
                    Button("Round \(round + 1) — ready") { arm() }.buttonStyle(PrimaryPill())
                case 1, 2:
                    Button { tap() } label: {
                        Text(stage == 2 ? "TAP!" : "wait for it…")
                            .font(.kBody(20, weight: .bold)).foregroundStyle(stage == 2 ? Color.kInkInverse : Color.kInkFaint)
                            .frame(width: 250, height: 250)
                            .background(RoundedRectangle(cornerRadius: 40).fill(stage == 2 ? Color.kIris : Color.kSurfaceSunken)).kFloatShadow()
                    }
                case 3:
                    Text("Jumped the gun 😅").font(.kDisplay(24)).foregroundStyle(Color.kInk)
                    Text("Happens to the best brains. That round doesn't count.").font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Go again") { arm() }.buttonStyle(PrimaryPill())
                case 4:
                    Text("\(last) ms").font(.kDisplay(44)).foregroundStyle(Color.kInk)
                    Text("Round \(times.count) of \(rounds)").font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                    Button("Next round") { arm() }.buttonStyle(PrimaryPill())
                default:
                    let avg = times.isEmpty ? 0 : times.reduce(0, +) / times.count
                    Text(times.isEmpty ? "All jumps 😄" : "Average: \(avg) ms").font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text("Reaction wobbles with sleep, food, and interest. A snapshot, not a verdict.").font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
        .onDisappear { task?.cancel() }
    }
    private func arm() {
        if times.count >= rounds || (stage == 4 && round + 1 > rounds) { return }
        round = min(round + (stage == 0 ? 0 : 1), rounds)
        stage = 1
        task = Task {
            try? await Task.sleep(nanoseconds: UInt64((1.2 + Double.random(in: 0...2.3)) * 1_000_000_000))
            if !Task.isCancelled { goAt = Date(); stage = 2 }
        }
    }
    private func tap() {
        if stage == 1 { task?.cancel(); times.append(-1); stage = 3; return }
        if stage == 2 {
            last = Int(Date().timeIntervalSince(goAt) * 1000)
            times.append(last)
            let valid = times.filter { $0 > 0 }
            stage = valid.count >= rounds || times.count >= rounds ? 5 : 4
            if stage == 5 { times = valid }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}

// MARK: Steady Breath (box breathing 4-4-4-4)
struct SteadyBreathGame: View {
    let onExit: () -> Void
    @State private var running = false
    @State private var cyclesTarget = 4
    @State private var cycle = 0
    @State private var phase = 0
    @State private var secLeft = 4
    @State private var finished = false
    @State private var reduced = false
    private let phases = [("Breathe in", 4), ("Hold", 4), ("Breathe out", 4), ("Rest", 4)]
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        GameChrome(title: "Steady Breath", onExit: onExit) {
            VStack(spacing: 18) {
                if !running && !finished {
                    Text("One minute of square breathing settles a spinning head. No score — breathing isn't a competition.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 36)
                    HStack(spacing: 10) {
                        Button("1 minute") { start(4) }.buttonStyle(PrimaryPill())
                        Button("2 minutes") { start(8) }.buttonStyle(SecondaryPill())
                    }
                } else if running {
                    let grow = phases[phase].0 == "Breathe in" || phases[phase].0 == "Hold"
                    RoundedRectangle(cornerRadius: 28).fill(Color.kIrisSoft).overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.kIris, lineWidth: 4))
                        .frame(width: reduced ? 200 : (grow ? 230 : 150), height: reduced ? 200 : (grow ? 230 : 150))
                        .animation(reduced ? nil : .easeInOut(duration: 3.6), value: grow)
                        .overlay(VStack(spacing: 4) {
                            Text(phases[phase].0).font(.kBody(18, weight: .bold)).foregroundStyle(Color.kIris)
                            Text("\(secLeft)").font(.kMono(28, weight: .bold)).foregroundStyle(Color.kInk)
                        })
                    Text("cycle \(min(cycle + 1, cyclesTarget)) of \(cyclesTarget)").font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    Button("I'm good, stop here") { onExit() }.font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                } else {
                    Text("Steadier.").font(.kDisplay(30)).foregroundStyle(Color.kInk)
                    Text("A real minute of rest — the kind that counts.").font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                    Button("Back to it") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
        .onAppear { reduced = UIAccessibility.isReduceMotionEnabled || KairoPrefs.reducedStimulation }
        .onReceive(timer) { _ in tick() }
    }
    private func start(_ c: Int) { cyclesTarget = c; cycle = 0; phase = 0; secLeft = 4; finished = false; running = true }
    private func tick() {
        guard running else { return }
        if secLeft > 1 { secLeft -= 1; return }
        let next = (phase + 1) % phases.count
        if next == 0 {
            cycle += 1
            if cycle >= cyclesTarget { running = false; finished = true; return }
        }
        phase = next; secLeft = phases[next].1
    }
}

private struct PrimaryPill: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkInverse)
            .padding(.horizontal, 28).padding(.vertical, 14).background(Capsule().fill(Color.kIris))
            .scaleEffect(configuration.isPressed ? 0.97 : 1).kFloatShadow()
    }
}
private struct SecondaryPill: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            .padding(.horizontal, 28).padding(.vertical, 14).background(Capsule().fill(Color.kSurface).overlay(Capsule().stroke(Color.kBorder, lineWidth: 1)))
    }
}
