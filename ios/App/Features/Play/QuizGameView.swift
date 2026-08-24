import SwiftUI

// MARK: Shared word-quiz engine (Grammar Snap + Spell Check). Eight rounds,
// tap a choice, instant kind feedback, no timers and no red. After every
// answer the sentence completes itself, the memory hook lands, and each
// real-word option shows up used correctly (the distinction, not just the
// answer); spelling answers underline their trap letters. Misses are
// remembered; three or more unlock "your tricky ones", answering one right
// redeems it, and the ending recaps this run's missed rules. Mirrors the
// web QuizGame.

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
    @State private var missedThisRun: [QuizItem] = []
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?

    private static let recapCap = 3

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
            promptText(item)
                .font(.kDisplay(21))
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
                    if !item.examples.isEmpty {
                        examplesCard(item)
                            .padding(.top, 8)
                    }
                    Button(idx + 1 >= rounds.count ? "See how it went" : "Next one") { next() }
                        .buttonStyle(PrimaryPill())
                        .padding(.top, 10)
                }
                .padding(.top, 18)
            }
        }
    }

    /// Before answering: the prompt with its blank. After: the sentence
    /// completes itself, the answer in success ink (trap letters underlined).
    private func promptText(_ item: QuizItem) -> Text {
        guard chosen != nil else {
            return Text(item.prompt).foregroundStyle(Color.kInk)
        }
        let parts = item.prompt.components(separatedBy: "___")
        guard parts.count > 1 else {
            return Text(item.prompt).foregroundStyle(Color.kInk)
        }
        var result = Text(verbatim: "")
        for (i, part) in parts.enumerated() {
            result = result + Text(part).foregroundStyle(Color.kInk)
            if i < parts.count - 1 { result = result + answerText(item) }
        }
        return result
    }

    private func answerText(_ item: QuizItem) -> Text {
        guard let stress = item.stress, let range = item.answer.range(of: stress) else {
            return Text(item.answer).foregroundStyle(Color.kSuccess)
        }
        let before = String(item.answer[item.answer.startIndex..<range.lowerBound])
        let trap = String(item.answer[range])
        let after = String(item.answer[range.upperBound...])
        return Text(before).foregroundStyle(Color.kSuccess)
            + Text(trap).underline().foregroundStyle(Color.kSuccess)
            + Text(after).foregroundStyle(Color.kSuccess)
    }

    /// Each real-word option, used correctly in the wild.
    private func examplesCard(_ item: QuizItem) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(item.examples.count > 1 ? "Each one, used right" : "Used right")
                .font(.kBody(10.5, weight: .bold)).kerning(1.2)
                .textCase(.uppercase)
                .foregroundStyle(Color.kInkFaint)
            ForEach(item.examples, id: \.word) { ex in
                (Text(ex.word).fontWeight(.semibold).foregroundStyle(Color.kInk)
                 + Text(" — \(ex.sample)").foregroundStyle(Color.kInkSoft))
                    .font(.kBody(13))
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurfaceSunken))
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
            if !missedThisRun.isEmpty {
                recapCard
                    .padding(.top, 16)
            }
        }
        .padding(.top, 40)
    }

    /// "Pocket these" — the rules from this run's misses leave with you.
    private var recapCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pocket these")
                .font(.kBody(10.5, weight: .bold)).kerning(1.2)
                .textCase(.uppercase)
                .foregroundStyle(Color.kInkFaint)
            ForEach(missedThisRun.prefix(Self.recapCap), id: \.prompt) { m in
                (Text(m.answer).fontWeight(.semibold).foregroundStyle(Color.kInk)
                 + Text(" — \(m.note)").foregroundStyle(Color.kInkSoft))
                    .font(.kBody(12.5))
                    .multilineTextAlignment(.leading)
            }
            if missedThisRun.count > Self.recapCap {
                Text("…and \(missedThisRun.count - Self.recapCap) more, saved with your tricky ones.")
                    .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1))
    }

    private func bootstrap() {
        guard !started else { return }
        best = PlayScores.best(for: id)
        // Prune first: a reworded/retired bank item must not haunt the count.
        missCount = QuizMisses.prune(id, bank: bank).count
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
        missedThisRun = []
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
        missedThisRun = []
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
            missedThisRun.append(item)
        }
    }

    private func next() {
        guard !done else { return }
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
