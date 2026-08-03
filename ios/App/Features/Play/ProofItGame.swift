import SwiftUI

// MARK: Proof It — each round is one sentence hiding exactly one wrong word.
// Tap the word that's wrong. Eight rounds, corrected sentence + memory hook
// on every answer, misses feed "my slippery ones" practice. Mirrors the web
// ProofIt component; pure logic lives in ArcadeLogic + ProofBank.

struct ProofItGame: View {
    let onExit: () -> Void

    private static let id = "proofit"
    private enum Mode { case choose, fresh, practice }
    private static let practiceOfferAt = 3

    @State private var mode: Mode = .fresh
    @State private var started = false
    @State private var rounds: [ProofItem] = []
    @State private var idx = 0
    @State private var tapped: Int?
    @State private var score = 0
    @State private var missCount = 0
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?

    var body: some View {
        GameChrome(
            title: "Proof It",
            subtitle: "One word in each sentence is wrong. Tap it.",
            onExit: onExit
        ) {
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
            Text("You've got \(missCount) sentences that slipped past you before. Re-read them with fresh eyes, or draw new ones?")
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            Button("My slippery ones (\(min(missCount, ArcadeLogic.proofRounds)))") { startPractice() }
                .buttonStyle(PrimaryPill())
            Button("Fresh eight") { startFresh() }.buttonStyle(SecondaryPill())
            Text("Spot one on the reread and it leaves the list for good.")
                .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint)
        }
        .padding(.top, 40)
    }

    private func question(_ item: ProofItem) -> some View {
        let words = ArcadeLogic.proofWords(item)
        let found = tapped.map { ArcadeLogic.isProofHit(item, tapped: $0) } ?? false
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                if mode == .practice {
                    Text("practice ·").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kIris)
                }
                Text("\(idx + 1) of \(rounds.count)")
                    .font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                if score > 0 {
                    Text("· \(score) found").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kSuccess)
                }
                if let label = QuizBank.topicLabels[item.topic] {
                    Text(label)
                        .font(.kBody(11, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color.kSurfaceSunken))
                }
            }
            ProofFlowLayout(spacing: 8) {
                ForEach(Array(words.enumerated()), id: \.offset) { i, word in
                    wordChip(word, index: i, item: item)
                }
            }
            .padding(.top, 22)
            if tapped != nil {
                VStack(spacing: 6) {
                    Text(found
                         ? (mode == .practice ? "Caught it — off the slippery list it goes." : "Sharp eye.")
                         : "That one's fine — the sneaky one is highlighted.")
                        .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                    Text(ArcadeLogic.proofCorrected(item))
                        .font(.kBody(14, weight: .medium)).foregroundStyle(Color.kInk)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.kSurfaceSunken))
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

    private func wordChip(_ word: String, index: Int, item: ProofItem) -> some View {
        let answered = tapped != nil
        let isError = ArcadeLogic.isProofHit(item, tapped: index)
        let isTapped = index == tapped
        return Button { tap(index, item: item) } label: {
            Text(word)
                .font(.kDisplay(17))
                .foregroundStyle(answered ? (isError ? Color.kSuccess : isTapped ? Color.kCatButterInk : Color.kInkFaint) : Color.kInk)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(RoundedRectangle(cornerRadius: 12)
                    .fill(answered ? (isError ? Color.kSuccessSoft : isTapped ? Color.kCatButter : Color.kSurface) : Color.kSurface))
                .overlay(RoundedRectangle(cornerRadius: 12)
                    .stroke(answered && isError ? Color.kSuccess.opacity(0.4) : Color.kBorder, lineWidth: 1))
                .opacity(answered && !isError && !isTapped ? 0.55 : 1)
        }
        .disabled(answered)
        .accessibilityLabel(answered && isError ? "\(word), the wrong word" : word)
    }

    private var ending: some View {
        VStack(spacing: 12) {
            Text("\(score) of \(rounds.count)").font(.kDisplay(30)).foregroundStyle(Color.kInk)
            if mode == .fresh {
                Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.proofRounds)" } ?? "")
                    .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
            }
            Text(mode == .practice
                 ? (score == rounds.count
                    ? "Every one of those had slipped past you before. Not today."
                    : "\(score) caught, \(rounds.count - score) still sneaky. They'll wait.")
                 : endDetail)
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("Once more") { startFresh() }.buttonStyle(SecondaryPill())
                Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
            }
            .padding(.top, 8)
        }
        .padding(.top, 40)
    }

    private var endDetail: String {
        if score >= 7 { return "Editor eyes. Nothing gets past you." }
        if score >= 4 { return "Solid proofreading — these are built to be invisible." }
        return "These errors fool people who read for a living. Now you know their disguises."
    }

    private func bootstrap() {
        guard !started else { return }
        best = PlayScores.best(for: Self.id)
        missCount = QuizMisses.read(Self.id).count
        if missCount >= Self.practiceOfferAt {
            mode = .choose
        } else {
            rounds = ArcadeLogic.pickProofRounds(ProofBank.sentences)
            mode = .fresh
        }
        started = true
    }

    private func startFresh() {
        rounds = ArcadeLogic.pickProofRounds(ProofBank.sentences)
        idx = 0
        tapped = nil
        score = 0
        isNewBest = false
        done = false
        best = PlayScores.best(for: Self.id)
        mode = .fresh
    }

    private func startPractice() {
        let misses = QuizMisses.read(Self.id)
        let pool = ProofBank.sentences.filter { misses.contains($0.text) }
        rounds = ArcadeLogic.pickProofRounds(pool, maxPerTopic: 99)
        idx = 0
        tapped = nil
        score = 0
        isNewBest = false
        done = false
        mode = .practice
    }

    private func tap(_ index: Int, item: ProofItem) {
        guard tapped == nil else { return }
        tapped = index
        if ArcadeLogic.isProofHit(item, tapped: index) {
            score += 1
            QuizMisses.clear(Self.id, prompt: item.text)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } else {
            QuizMisses.record(Self.id, prompt: item.text)
        }
    }

    private func next() {
        if idx + 1 >= rounds.count {
            if mode == .fresh {
                let prior = PlayScores.best(for: Self.id)
                best = PlayScores.recordHigher(score, for: Self.id)
                isNewBest = prior == nil || score > prior!
            }
            missCount = QuizMisses.read(Self.id).count
            done = true
            return
        }
        idx += 1
        tapped = nil
    }
}

/// Center-aligned wrapping layout for the sentence's word chips.
struct ProofFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Void
    ) -> CGSize {
        let width = proposal.width ?? 320
        let rows = buildRows(width: width, subviews: subviews)
        let height = rows.reduce(CGFloat.zero) { $0 + $1.height }
            + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Void
    ) {
        let rows = buildRows(width: bounds.width, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX + (bounds.width - row.width) / 2
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                    proposal: .unspecified
                )
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func buildRows(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for (i, view) in subviews.enumerated() {
            let size = view.sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty
                ? size.width
                : current.width + spacing + size.width
            if !current.indices.isEmpty && needed > width {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty
                ? size.width
                : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(i)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
