import SwiftUI

// MARK: Shared word-quiz engine (Grammar Snap + Spell Check). Eight rounds,
// tap a choice, instant kind feedback with a one-line memory hook, no timers
// and no red. Misses are remembered; three or more unlock "your tricky ones",
// and answering one right redeems it off the list. Mirrors the web QuizGame.

struct QuizGameView: View {
    let id: String            // bests + misses key, e.g. "grammarsnap"
    let title: String
    let intro: String
    let bank: [QuizItem]
    let endDetail: (Int) -> String
    let onExit: () -> Void

    private enum Mode { case choose, fresh, practice }
    private static let practiceOfferAt = 3

    @State private var mode: Mode = .fresh
    @State private var started = false
    @State private var rounds: [QuizItem] = []
    @State private var idx = 0
    @State private var chosen: String?
    @State private var score = 0
    @State private var missCount = 0
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?

    private let topicLabels = QuizBank.topicLabels

    var body: some View {
        GameChrome(title: title, subtitle: intro, onExit: onExit) {
            ScrollView {
                VStack(spacing: 16) {
                    if !started {
                        EmptyView()
                    } else if mode == .choose {
                        chooser
                    } else if done {
                        ending
                    } else if let item = rounds.indices.contains(idx) ? rounds[idx] : nil {
                        question(item)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .onAppear { bootstrap() }
    }

    private var chooser: some View {
        VStack(spacing: 14) {
            Text("You've got \(missCount) tricky ones saved up — the exact snags that got you before. Face them, or draw fresh?")
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            Button("My tricky ones (\(min(missCount, ArcadeLogic.quizRounds)))") { startPractice() }
                .buttonStyle(PrimaryPill())
            Button("Fresh eight") { startFresh() }.buttonStyle(SecondaryPill())
            Text("Answer a tricky one right and it leaves the list for good.")
                .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint)
        }
        .padding(.top, 40)
    }

    private func question(_ item: QuizItem) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                if mode == .practice {
                    Text("practice ·").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kIris)
                }
                Text("\(idx + 1) of \(rounds.count)")
                    .font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                if score > 0 {
                    Text("· \(score) right").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kSuccess)
                }
                if let label = topicLabels[item.topic] {
                    Text(label)
                        .font(.kBody(11, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.kSurfaceSunken))
                }
            }
            Text(item.prompt)
                .font(.kDisplay(21)).foregroundStyle(Color.kInk)
                .multilineTextAlignment(.center)
                .padding(.top, 18)
            VStack(spacing: 10) {
                ForEach(item.options, id: \.self) { opt in
                    optionButton(opt, item: item)
                }
            }
            .padding(.top, 22)
            if chosen != nil {
                VStack(spacing: 6) {
                    Text(chosen == item.answer
                         ? (mode == .practice ? "Redeemed — off the tricky list it goes." : "Yes — nailed it.")
                         : "Close one — now you've got it.")
                        .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                    Text(item.note)
                        .font(.kBody(13)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
                    Button(idx + 1 >= rounds.count ? "See how it went" : "Next one") { next() }
                        .buttonStyle(PrimaryPill())
                        .padding(.top, 10)
                }
                .padding(.top, 18)
            }
        }
    }

    private func optionButton(_ opt: String, item: QuizItem) -> some View {
        let isAnswer = opt == item.answer
        let isChosen = opt == chosen
        let answered = chosen != nil
        return Button { choose(opt, item: item) } label: {
            Text(answered && isAnswer ? "\(opt) ✓" : opt)
                .font(.kBody(16, weight: .semibold))
                .foregroundStyle(answered ? (isAnswer ? Color.kSuccess : isChosen ? Color.kCatButterInk : Color.kInkFaint) : Color.kInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 16)
                    .fill(answered ? (isAnswer ? Color.kSuccessSoft : isChosen ? Color.kCatButter : Color.kSurface) : Color.kSurface))
                .overlay(RoundedRectangle(cornerRadius: 16)
                    .stroke(answered && isAnswer ? Color.kSuccess.opacity(0.4) : Color.kBorder, lineWidth: 1))
                .opacity(answered && !isAnswer && !isChosen ? 0.55 : 1)
        }
        .disabled(answered)
    }

    private var ending: some View {
        VStack(spacing: 12) {
            Text("\(score) of \(rounds.count)").font(.kDisplay(30)).foregroundStyle(Color.kInk)
            if mode == .fresh {
                Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.quizRounds)" } ?? "")
                    .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
            }
            Text(mode == .practice
                 ? (score == rounds.count
                    ? "Full redemption — every one of those had beaten you before. Not anymore."
                    : "\(score) redeemed, \(rounds.count - score) still lurking. They'll be here when you want them.")
                 : endDetail(score))
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("Once more") { startFresh() }.buttonStyle(SecondaryPill())
                Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
            }
            .padding(.top, 8)
        }
        .padding(.top, 40)
    }

    private func bootstrap() {
        guard !started else { return }
        best = PlayScores.best(for: id)
        missCount = QuizMisses.read(id).count
        if missCount >= Self.practiceOfferAt {
            mode = .choose
        } else {
            rounds = ArcadeLogic.pickQuizRounds(bank)
            mode = .fresh
        }
        started = true
    }

    private func startFresh() {
        rounds = ArcadeLogic.pickQuizRounds(bank)
        idx = 0
        chosen = nil
        score = 0
        isNewBest = false
        done = false
        best = PlayScores.best(for: id)
        mode = .fresh
    }

    private func startPractice() {
        let pool = QuizMisses.items(in: bank, misses: QuizMisses.read(id))
        rounds = ArcadeLogic.pickQuizRounds(pool, maxPerTopic: 99)
        idx = 0
        chosen = nil
        score = 0
        isNewBest = false
        done = false
        mode = .practice
    }

    private func choose(_ opt: String, item: QuizItem) {
        guard chosen == nil else { return }
        chosen = opt
        if opt == item.answer {
            score += 1
            QuizMisses.clear(id, prompt: item.prompt)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } else {
            QuizMisses.record(id, prompt: item.prompt)
        }
    }

    private func next() {
        if idx + 1 >= rounds.count {
            // Only fresh runs compete with your best — practice is for redemption.
            if mode == .fresh {
                let prior = PlayScores.best(for: id)
                best = PlayScores.recordHigher(score, for: id)
                isNewBest = prior == nil || score > prior!
            }
            missCount = QuizMisses.read(id).count
            done = true
            return
        }
        idx += 1
        chosen = nil
    }
}
