import SwiftUI

// MARK: Letter Soup — everyday words, gently scrambled. Tap letters into
// place; a wrong build shakes out kindly, and "Show me" always exists
// without shame. Solved words out of eight is the personal best.

struct LetterSoupGame: View {
    let onExit: () -> Void

    private struct Tile: Identifiable {
        let id: Int
        let letter: String
        var used: Bool
    }

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var words: [String] = []
    @State private var roundNo = 0
    @State private var tiles: [Tile] = []
    @State private var built: [Int] = []
    @State private var wrongFlash = false
    @State private var revealed = false
    @State private var solved = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var advanceTask: Task<Void, Never>?

    private var word: String { words.indices.contains(roundNo) ? words[roundNo] : "" }

    var body: some View {
        GameChrome(title: "Letter Soup", subtitle: "Everyday words, gently scrambled.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Eight familiar words hiding in their own letters. Build each one back — and \"Show me\" is always there, no shame attached.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Stir the soup") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Text("word \(roundNo + 1) of \(words.count) · \(solved) solved")
                        .font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)

                    HStack(spacing: 5) {
                        if revealed {
                            ForEach(Array(word.enumerated()), id: \.offset) { _, letter in
                                Text(String(letter).uppercased())
                                    .font(.kDisplay(22)).foregroundStyle(Color.kInk)
                            }
                        } else {
                            ForEach(0..<word.count, id: \.self) { i in
                                Text(i < built.count ? tiles[built[i]].letter.uppercased() : "")
                                    .font(.kDisplay(19)).foregroundStyle(Color.kInk)
                                    .frame(width: 34, height: 40)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.kSurface))
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.kBorder, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 16).fill(
                        wrongFlash ? Color.kDangerSoft : revealed ? Color.kSuccessSoft : Color.kSurfaceSunken))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(
                        wrongFlash ? Color.kDanger.opacity(0.5) : revealed ? Color.kSuccess.opacity(0.4) : Color.kBorder, lineWidth: 1))
                    .accessibilityLabel(revealed ? "The word was \(word)" : "Your letters so far")

                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(48), spacing: 8), count: min(6, tiles.count)), spacing: 8) {
                        ForEach(tiles) { tile in
                            Button { tap(tile.id) } label: {
                                Text(tile.letter.uppercased())
                                    .font(.kDisplay(19))
                                    .foregroundStyle(tile.used ? Color.kInkFaint : Color.kInk)
                                    .frame(width: 48, height: 48)
                                    .background(RoundedRectangle(cornerRadius: 14).fill(tile.used ? Color.kSurfaceSunken : Color.kSurface))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.kBorder, lineWidth: 1))
                                    .opacity(tile.used ? 0.4 : 1)
                            }
                            .disabled(tile.used || revealed)
                            .accessibilityLabel("Letter \(tile.letter.uppercased())\(tile.used ? ", placed" : "")")
                        }
                    }

                    HStack(spacing: 10) {
                        Button("⌫ Take one back") { undoLast() }
                            .buttonStyle(SecondaryPill())
                            .disabled(built.isEmpty || revealed)
                        Button("Show me") { reveal() }
                            .buttonStyle(SecondaryPill())
                            .disabled(revealed)
                    }
                } else {
                    Text("\(solved) of \(ArcadeLogic.soupRounds) unscrambled")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.soupRounds)" } ?? "")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text(endDetail)
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 30)
                    HStack(spacing: 10) {
                        Button("Once more") { start() }.buttonStyle(SecondaryPill())
                        Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                    }
                }
            }
        }
        .onDisappear { advanceTask?.cancel() }
    }

    private var endDetail: String {
        if solved >= 7 { return "The alphabet works for you now. Barely a scramble at all." }
        if solved >= 4 { return "Solid soup work — reassembling words is real pattern-matching." }
        return "Scrambles are sneakier than they look. The words don't mind another visit."
    }

    private func dealRound(_ nextWord: String) {
        tiles = ArcadeLogic.scrambleWord(nextWord).enumerated().map { Tile(id: $0.offset, letter: $0.element, used: false) }
        built = []
        wrongFlash = false
        revealed = false
    }

    private func start() {
        advanceTask?.cancel()
        words = ArcadeLogic.pickSoupWords()
        roundNo = 0
        solved = 0
        isNewBest = false
        best = PlayScores.best(for: "lettersoup")
        dealRound(words[0])
        stage = 1
    }

    private func finishRound(didSolve: Bool) {
        if didSolve {
            solved += 1
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        let nextRound = roundNo + 1
        let delay: UInt64 = didSolve ? 650_000_000 : 1_400_000_000
        advanceTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: delay)
            if Task.isCancelled { return }
            if nextRound >= words.count {
                let finalSolved = solved
                let prior = PlayScores.best(for: "lettersoup")
                best = PlayScores.recordHigher(finalSolved, for: "lettersoup")
                isNewBest = prior == nil || finalSolved > prior!
                stage = 2
                return
            }
            roundNo = nextRound
            dealRound(words[nextRound])
        }
    }

    private func tap(_ id: Int) {
        guard stage == 1, !revealed, !wrongFlash,
              let idx = tiles.firstIndex(where: { $0.id == id }), !tiles[idx].used else { return }
        tiles[idx].used = true
        built.append(idx)
        guard built.count == tiles.count else { return }
        let attempt = built.map { tiles[$0].letter }.joined()
        if attempt == word {
            finishRound(didSolve: true)
        } else {
            wrongFlash = true
            advanceTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 650_000_000)
                if Task.isCancelled { return }
                for i in tiles.indices { tiles[i].used = false }
                built = []
                wrongFlash = false
            }
        }
    }

    private func undoLast() {
        guard stage == 1, let last = built.last, !wrongFlash else { return }
        tiles[last].used = false
        built.removeLast()
    }

    private func reveal() {
        guard stage == 1, !revealed else { return }
        revealed = true
        built = []
        finishRound(didSolve: false)
    }
}
