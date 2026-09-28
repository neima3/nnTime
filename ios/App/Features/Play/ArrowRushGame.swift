import SwiftUI

// MARK: Arrow Rush — the flanker task. Five arrows; answer only for the
// middle one, whose neighbours disagree half the time. Twenty rounds; right
// answers out of 20 is the best, and the end names the decoy cost.

struct ArrowRushGame: View {
    let onExit: () -> Void

    private enum Verdict { case right, wrong, slow }

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var run: [ArcadeLogic.ArrowRound] = []
    @State private var idx = 0
    @State private var visible = false
    @State private var verdict: Verdict?
    @State private var results: [ArcadeLogic.ArrowResult] = []
    @State private var shownAt = Date()
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var phaseTask: Task<Void, Never>?

    var body: some View {
        GameChrome(title: "Arrow Rush", subtitle: "Which way does the middle arrow point?", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    arrows(ArcadeLogic.arrowRow(.init(dir: .left, congruent: false)), size: 26)
                        .foregroundStyle(Color.kInk)
                        .padding(.horizontal, 22).padding(.vertical, 18)
                        .kCard(radius: 22)
                    Text("here the answer is ← — the middle one")
                        .font(.kBody(12, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                    Text("Twenty quick rows. Tap for the middle arrow only — half the time its neighbours point the other way, on purpose.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Start the rush") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    progress
                    ZStack {
                        RoundedRectangle(cornerRadius: 30)
                            .fill(verdict == .right ? Color.kSuccessSoft : verdict == .wrong ? Color.kDangerSoft
                                  : verdict == .slow ? Color.kSurfaceSunken : Color.kSurface)
                            .overlay(RoundedRectangle(cornerRadius: 30).stroke(
                                verdict == .right ? Color.kSuccess.opacity(0.45)
                                : verdict == .wrong ? Color.kDanger.opacity(0.45) : Color.kBorder, lineWidth: 2))
                            .kFloatShadow()
                        if verdict == .slow {
                            Text("too slow — next one").font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                        } else if visible, idx < run.count {
                            arrows(ArcadeLogic.arrowRow(run[idx]), size: 36)
                                .foregroundStyle(verdict == .right ? Color.kSuccess : verdict == .wrong ? Color.kDanger : Color.kInk)
                        } else {
                            Text("get ready…").font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                        }
                    }
                    .frame(height: 140).padding(.horizontal, 24)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(visible && idx < run.count && verdict == nil
                        ? "Round \(idx + 1) of \(ArcadeLogic.arrowRounds). Middle arrow points \(run[idx].dir.rawValue)."
                        : "Waiting")
                    HStack(spacing: 12) {
                        answerButton(.left)
                        answerButton(.right)
                    }
                    .padding(.horizontal, 24)
                } else {
                    let s = ArcadeLogic.arrowSummary(results)
                    Text("\(s.correct) of \(ArcadeLogic.arrowRounds) right").font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.arrowRounds)" } ?? "")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text(endDetail(s))
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 30)
                    HStack(spacing: 10) {
                        Button("Once more") { start() }.buttonStyle(SecondaryPill())
                        Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                    }
                }
            }
        }
        .onAppear { best = PlayScores.best(for: "arrowrush") }
        .onDisappear { phaseTask?.cancel() }
    }

    private func arrows(_ row: [ArcadeLogic.ArrowDir], size: CGFloat) -> some View {
        HStack(spacing: size * 0.3) {
            ForEach(Array(row.enumerated()), id: \.offset) { _, dir in
                Image(systemName: dir == .left ? "arrow.left" : "arrow.right")
                    .font(.system(size: size, weight: .bold))
            }
        }
        .accessibilityHidden(true)
    }

    private var progress: some View {
        HStack(spacing: 4) {
            ForEach(0..<ArcadeLogic.arrowRounds, id: \.self) { i in
                Capsule()
                    .fill(i < results.count
                          ? (results[i].correct ? Color.kSuccess : Color.kDanger.opacity(0.7))
                          : i == idx ? Color.kIris.opacity(0.4) : Color.kSurfaceSunken)
                    .frame(width: 10, height: 6)
            }
        }
        .accessibilityHidden(true)
    }

    private func answerButton(_ dir: ArcadeLogic.ArrowDir) -> some View {
        Button { answer(dir) } label: {
            Image(systemName: dir == .left ? "arrow.left" : "arrow.right")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Color.kInk)
                .frame(maxWidth: .infinity).frame(height: 92)
                .kCard(radius: 24)
        }
        .accessibilityLabel(dir == .left ? "Middle points left" : "Middle points right")
    }

    private func endDetail(_ s: (correct: Int, avgMs: Int?, decoyCostMs: Int?)) -> String {
        let avg = s.avgMs.map { "Average answer \($0) ms. " } ?? ""
        guard let cost = s.decoyCostMs else { return avg + "The decoys never got a clean shot at you." }
        return avg + (cost > 15
            ? "The decoys cost you \(cost) ms each — that's your brain filtering noise, right on cue."
            : "The decoys barely slowed you. That's unusually good filtering.")
    }

    private func start() {
        phaseTask?.cancel()
        run = ArcadeLogic.arrowRun()
        results = []
        idx = 0
        visible = false
        verdict = nil
        isNewBest = false
        best = PlayScores.best(for: "arrowrush")
        stage = 1
        schedule(after: 0.65) { show(0) }
    }

    private func schedule(after seconds: Double, _ action: @escaping @MainActor () -> Void) {
        phaseTask?.cancel()
        phaseTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            if !Task.isCancelled { action() }
        }
    }

    private func show(_ i: Int) {
        guard i < run.count else { finish(); return }
        idx = i
        verdict = nil
        visible = true
        shownAt = Date()
        schedule(after: ArcadeLogic.arrowLimitSeconds) {
            guard verdict == nil, idx == i else { return }
            results.append(.init(congruent: run[i].congruent, correct: false, ms: nil))
            verdict = .slow
            schedule(after: ArcadeLogic.arrowGapSeconds + 0.22) { show(i + 1) }
        }
    }

    private func answer(_ dir: ArcadeLogic.ArrowDir) {
        guard stage == 1, visible, verdict == nil, idx < run.count else { return }
        let round = run[idx]
        let ms = Int(Date().timeIntervalSince(shownAt) * 1000)
        let correct = dir == round.dir
        results.append(.init(congruent: round.congruent, correct: correct, ms: ms))
        verdict = correct ? .right : .wrong
        if correct {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        }
        let next = idx + 1
        schedule(after: ArcadeLogic.arrowGapSeconds) { show(next) }
    }

    private func finish() {
        let correct = ArcadeLogic.arrowSummary(results).correct
        let prior = PlayScores.best(for: "arrowrush")
        best = PlayScores.recordHigher(correct, for: "arrowrush")
        isNewBest = prior == nil || correct > prior!
        stage = 2
    }
}
