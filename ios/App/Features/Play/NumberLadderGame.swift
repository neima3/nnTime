import SwiftUI

// MARK: Number Ladder — a six-rung mental-math climb. One small operation at
// a time, three choices per rung, no timers and no paper. Wrong picks show
// the right answer and the climb continues. Mirrors the web NumberLadder.

struct NumberLadderGame: View {
    let onExit: () -> Void

    private static let id = "numberladder"

    @State private var ladder = ArcadeLogic.buildLadder()
    @State private var rung = 0
    @State private var chosen: Int?
    @State private var score = 0
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?

    var body: some View {
        GameChrome(
            title: "Number Ladder",
            subtitle: "Start small. Climb one sum at a time — no paper allowed.",
            onExit: onExit
        ) {
            ScrollView {
                VStack(spacing: 16) {
                    if done {
                        ending
                    } else if let step = ladder.steps.indices.contains(rung) ? ladder.steps[rung] : nil {
                        question(step)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .onAppear { best = PlayScores.best(for: Self.id) }
    }

    private func question(_ step: ArcadeLogic.LadderStep) -> some View {
        let prior = rung == 0 ? ladder.start : ladder.steps[rung - 1].result
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text("rung \(rung + 1) of \(ladder.steps.count)")
                    .font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                if score > 0 {
                    Text("· \(score) right").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kSuccess)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("\(prior)")
                    .font(.kDisplay(44)).foregroundStyle(Color.kInk)
                Text(step.op)
                    .font(.kDisplay(24)).foregroundStyle(Color.kCatPeachInk)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.kCatPeach))
                Text("= ?")
                    .font(.kDisplay(28)).foregroundStyle(Color.kInkFaint)
            }
            .padding(.top, 24)
            HStack(spacing: 10) {
                ForEach(step.options, id: \.self) { opt in
                    optionButton(opt, step: step)
                }
            }
            .padding(.top, 26)
            if chosen != nil {
                VStack(spacing: 6) {
                    Text(chosen == step.result
                         ? "Climbing."
                         : "It's \(step.result) — the ladder keeps going.")
                        .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                    Button(rung + 1 >= ladder.steps.count ? "See how it went" : "Next rung") { next() }
                        .buttonStyle(PrimaryPill())
                        .padding(.top, 10)
                }
                .padding(.top, 18)
            }
        }
    }

    private func optionButton(_ opt: Int, step: ArcadeLogic.LadderStep) -> some View {
        let answered = chosen != nil
        let isAnswer = opt == step.result
        let isChosen = opt == chosen
        return Button { choose(opt, step: step) } label: {
            Text("\(opt)")
                .font(.kDisplay(24))
                .foregroundStyle(answered ? (isAnswer ? Color.kSuccess : isChosen ? Color.kCatButterInk : Color.kInkFaint) : Color.kInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(RoundedRectangle(cornerRadius: 16)
                    .fill(answered ? (isAnswer ? Color.kSuccessSoft : isChosen ? Color.kCatButter : Color.kSurface) : Color.kSurface))
                .overlay(RoundedRectangle(cornerRadius: 16)
                    .stroke(answered && isAnswer ? Color.kSuccess.opacity(0.4) : Color.kBorder, lineWidth: 1))
                .opacity(answered && !isAnswer && !isChosen ? 0.55 : 1)
        }
        .disabled(answered)
        .accessibilityLabel(answered && isAnswer ? "\(opt), correct" : "\(opt)")
    }

    private var ending: some View {
        VStack(spacing: 12) {
            Text("\(score) of \(ladder.steps.count)").font(.kDisplay(30)).foregroundStyle(Color.kInk)
            Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.ladderSteps)" } ?? "")
                .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
            Text(score == ArcadeLogic.ladderSteps
                 ? "A clean climb, all in your head. Genuinely hard."
                 : score >= 4
                 ? "Solid climbing — carrying numbers in your head is real work."
                 : "Mental math under a wandering mind is the hardest mode there is. It counts.")
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("Once more") { start() }.buttonStyle(SecondaryPill())
                Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
            }
            .padding(.top, 8)
        }
        .padding(.top, 40)
    }

    private func start() {
        ladder = ArcadeLogic.buildLadder()
        rung = 0
        chosen = nil
        score = 0
        isNewBest = false
        done = false
        best = PlayScores.best(for: Self.id)
    }

    private func choose(_ opt: Int, step: ArcadeLogic.LadderStep) {
        guard chosen == nil else { return }
        chosen = opt
        if opt == step.result {
            score += 1
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func next() {
        if rung + 1 >= ladder.steps.count {
            let prior = PlayScores.best(for: Self.id)
            best = PlayScores.recordHigher(score, for: Self.id)
            isNewBest = prior == nil || score > prior!
            done = true
            return
        }
        rung += 1
        chosen = nil
    }
}
