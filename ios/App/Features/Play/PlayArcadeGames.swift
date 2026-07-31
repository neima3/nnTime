import SwiftUI

// MARK: Emoji Match — 8 pairs of Kairo's category emoji in a 4×4 grid.

struct EmojiMatchGame: View {
    let onExit: () -> Void

    private enum CardState { case down, up, matched }
    private struct MatchCard: Identifiable { let id: Int; let emoji: String; var state: CardState }

    @State private var cards: [MatchCard] = []
    @State private var picked: [Int] = []
    @State private var moves = 0
    @State private var locked = false
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?

    var body: some View {
        GameChrome(title: "Emoji Match", onExit: onExit) {
            VStack(spacing: 18) {
                if !done {
                    Text("Find the 8 pairs. Fewer flips, better memory day.")
                        .font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(70), spacing: 10), count: 4), spacing: 10) {
                        ForEach(cards) { card in
                            Button { flip(card.id) } label: {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(fillColor(card.state))
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(strokeColor(card.state), lineWidth: 1)
                                    Text(card.emoji).font(.system(size: 27))
                                        .opacity(card.state == .down ? 0 : 1)
                                }
                                .frame(width: 70, height: 70)
                            }
                            .disabled(card.state != .down || locked)
                            .accessibilityLabel(card.state == .down ? "Face-down card" : card.emoji)
                        }
                    }
                    Text("\(moves) moves").font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                } else {
                    Text("All pairs in \(moves) moves").font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0) moves" } ?? "")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text(moves <= 12
                         ? "That's a sharp matching run — the pairs barely stood a chance."
                         : "Every flip you remembered was working memory doing its thing.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 30)
                    HStack(spacing: 10) {
                        Button("Once more") { deal() }.buttonStyle(SecondaryPill())
                        Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                    }
                }
            }
        }
        .onAppear { if cards.isEmpty { deal() } }
    }

    private func fillColor(_ state: CardState) -> Color {
        switch state {
        case .down: return .kIrisSoft
        case .matched: return .kSuccessSoft
        case .up: return .kSurface
        }
    }

    private func strokeColor(_ state: CardState) -> Color {
        switch state {
        case .down: return .kBorder
        case .matched: return Color.kSuccess.opacity(0.3)
        case .up: return .kIris
        }
    }

    private func deal() {
        cards = ArcadeLogic.buildMatchDeck().enumerated().map { MatchCard(id: $0.offset, emoji: $0.element, state: .down) }
        picked = []
        moves = 0
        locked = false
        done = false
        isNewBest = false
        best = PlayScores.best(for: "emojimatch")
    }

    private func flip(_ id: Int) {
        guard !locked, !done, let i = cards.firstIndex(where: { $0.id == id }), cards[i].state == .down else { return }
        cards[i].state = .up
        picked.append(i)
        guard picked.count == 2 else { return }
        moves += 1
        let (a, b) = (picked[0], picked[1])
        picked = []
        if cards[a].emoji == cards[b].emoji {
            cards[a].state = .matched
            cards[b].state = .matched
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            if cards.allSatisfy({ $0.state == .matched }) {
                let prior = PlayScores.best(for: "emojimatch")
                let bestNow = PlayScores.recordLower(moves, for: "emojimatch")
                best = bestNow
                isNewBest = prior == nil || moves < prior!
                done = true
            }
        } else {
            locked = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
                if cards.indices.contains(a), cards[a].state == .up { cards[a].state = .down }
                if cards.indices.contains(b), cards[b].state == .up { cards[b].state = .down }
                locked = false
            }
        }
    }
}

// MARK: Focus Finder — a Schulte grid; tap 1→25 in order.

struct FocusFinderGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var grid: [Int] = []
    @State private var next = 1
    @State private var wrongAt: Int?
    @State private var startedAt = Date()
    @State private var elapsed: Double = 0
    @State private var finalTenths = 0
    @State private var isNewBest = false
    @State private var best: Int?
    private let timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        GameChrome(title: "Focus Finder", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Twenty-five numbers hiding in plain sight. Find them in order — wrong taps only cost time, never points.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Start the hunt") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    HStack(spacing: 12) {
                        Text("find \(next)")
                            .font(.kBody(13, weight: .bold)).foregroundStyle(Color.kIris)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Color.kIrisGhost))
                        Text(String(format: "%.1fs", elapsed))
                            .font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(58), spacing: 8), count: 5), spacing: 8) {
                        ForEach(Array(grid.enumerated()), id: \.offset) { idx, value in
                            let found = value < next
                            Button { tap(value: value, idx: idx) } label: {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(found ? Color.kSuccessSoft : wrongAt == idx ? Color.kDangerSoft : Color.kSurface)
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(found ? Color.kSuccess.opacity(0.3) : wrongAt == idx ? Color.kDanger : Color.kBorder, lineWidth: 1)
                                    Text("\(value)")
                                        .font(.kMono(17, weight: .bold))
                                        .foregroundStyle(found ? Color.kInkFaint : Color.kInk)
                                }
                                .frame(width: 58, height: 58)
                            }
                            .disabled(found)
                            .accessibilityLabel(found ? "\(value), found" : "\(value)")
                        }
                    }
                } else {
                    Text(String(format: "Swept in %.1fs", Double(finalTenths) / 10))
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { String(format: "Your best: %.1fs", Double($0) / 10) } ?? "")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text(finalTenths <= 450
                         ? "That's serious visual scanning — the grid never saw you coming."
                         : "Every number you hunted down was attention doing a full workout.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 30)
                    HStack(spacing: 10) {
                        Button("Once more") { start() }.buttonStyle(SecondaryPill())
                        Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                    }
                }
            }
        }
        .onReceive(timer) { _ in
            if stage == 1 { elapsed = Date().timeIntervalSince(startedAt) }
        }
    }

    private func start() {
        grid = ArcadeLogic.buildSchulteGrid()
        next = 1
        wrongAt = nil
        elapsed = 0
        isNewBest = false
        best = PlayScores.best(for: "focusfinder")
        startedAt = Date()
        stage = 1
    }

    private func tap(value: Int, idx: Int) {
        guard stage == 1 else { return }
        guard value == next else {
            wrongAt = idx
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { if wrongAt == idx { wrongAt = nil } }
            return
        }
        if value == ArcadeLogic.schulteSize {
            let tenths = ArcadeLogic.schulteTenths(elapsedMs: Date().timeIntervalSince(startedAt) * 1000)
            finalTenths = tenths
            let prior = PlayScores.best(for: "focusfinder")
            best = PlayScores.recordLower(tenths, for: "focusfinder")
            isNewBest = prior == nil || tenths < prior!
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            stage = 2
            return
        }
        next = value + 1
    }
}

// MARK: Memory Trail — watch a path glow across nine tiles, then walk it back.

struct MemoryTrailGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 watch, 2 repeat, 3 done
    @State private var trail: [Int] = []
    @State private var lit: Int?
    @State private var tapped: Int?
    @State private var progress = 0
    @State private var completedLen = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var playbackTask: Task<Void, Never>?

    var body: some View {
        GameChrome(title: "Memory Trail", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Nine tiles, one glowing path. It starts three steps long and grows each time you get it right. How far can the trail go?")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Show me the trail") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 || stage == 2 {
                    Text(stage == 1 ? "watch — \(trail.count) steps" : "your turn — \(progress) of \(trail.count)")
                        .font(.kBody(13, weight: .bold))
                        .foregroundStyle(stage == 1 ? Color.kInkSoft : Color.kIris)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 10).fill(stage == 1 ? Color.kSurfaceSunken : Color.kIrisGhost))
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(82), spacing: 10), count: 3), spacing: 10) {
                        ForEach(0..<ArcadeLogic.trailTiles, id: \.self) { idx in
                            Button { tapTile(idx) } label: {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(lit == idx ? Color.kIris : tapped == idx ? Color.kIrisSoft : Color.kSurface)
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(lit == idx ? Color.kIrisDeep : tapped == idx ? Color.kIris : Color.kBorder, lineWidth: 1)
                                }
                                .frame(width: 82, height: 82)
                                .scaleEffect(lit == idx && !KairoPrefs.reducedStimulation ? 1.05 : 1)
                                .animation(.easeOut(duration: 0.15), value: lit)
                            }
                            .disabled(stage != 2)
                            .accessibilityLabel("Tile \(idx + 1)")
                        }
                    }
                } else {
                    Text(completedLen > 0 ? "Trail of \(completedLen)" : "The trail got away")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    if completedLen > 0 {
                        Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: trail of \($0)" } ?? "")
                            .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    }
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
        .onDisappear { playbackTask?.cancel() }
    }

    private var endDetail: String {
        if completedLen >= 7 { return "That's a serious stretch of working memory. The tiles are impressed." }
        if completedLen > 0 { return "Every step you held was working memory lifting real weight." }
        return "Three glowing tiles move fast — one more watch and you'll have them."
    }

    private func start() {
        playbackTask?.cancel()
        completedLen = 0
        isNewBest = false
        best = PlayScores.best(for: "memorytrail")
        trail = ArcadeLogic.buildTrail()
        playback()
    }

    private func playback() {
        stage = 1
        progress = 0
        lit = nil
        let seq = trail
        playbackTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            for tile in seq {
                if Task.isCancelled { return }
                lit = tile
                try? await Task.sleep(nanoseconds: 420_000_000)
                lit = nil
                try? await Task.sleep(nanoseconds: 180_000_000)
            }
            if Task.isCancelled { return }
            stage = 2
        }
    }

    private func tapTile(_ idx: Int) {
        guard stage == 2 else { return }
        tapped = idx
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) { if tapped == idx { tapped = nil } }
        guard idx == trail[progress] else {
            finish()
            return
        }
        if progress + 1 < trail.count {
            progress += 1
            return
        }
        // Clean run — extend the trail and play it again.
        completedLen = trail.count
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        trail = ArcadeLogic.extendTrail(trail)
        stage = 1
        lit = nil
        playbackTask?.cancel()
        playbackTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 650_000_000)
            if !Task.isCancelled { playback() }
        }
    }

    private func finish() {
        if completedLen > 0 {
            let prior = PlayScores.best(for: "memorytrail")
            best = PlayScores.recordHigher(completedLen, for: "memorytrail")
            isNewBest = prior == nil || completedLen > prior!
        }
        stage = 3
    }
}

// MARK: Color Clash — the classic Stroop clash; tap the ink, not the word.

struct ColorClashGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var round = ArcadeLogic.ClashRound(word: 0, ink: 1)
    @State private var roundNo = 0
    @State private var score = 0
    @State private var verdict: Bool?
    @State private var isNewBest = false
    @State private var best: Int?

    private let inkColors: [Color] = [.kCatRoseInk, .kCatSkyInk, .kCatMintInk, .kCatLilacInk]

    var body: some View {
        GameChrome(title: "Color Clash", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Your reading brain and your seeing brain are about to disagree. Side with your eyes: tap the color the word is painted in.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Bring the clash") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Text("round \(roundNo + 1) of \(ArcadeLogic.clashRounds) · \(score) right")
                        .font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    ZStack {
                        RoundedRectangle(cornerRadius: 22)
                            .fill(verdict == true ? Color.kSuccessSoft : verdict == false ? Color.kDangerSoft : Color.kSurface)
                        RoundedRectangle(cornerRadius: 22)
                            .stroke(verdict == true ? Color.kSuccess.opacity(0.4) : verdict == false ? Color.kDanger.opacity(0.4) : Color.kBorder, lineWidth: 1)
                        Text(ArcadeLogic.clashColorNames[round.word])
                            .font(.kDisplay(40))
                            .foregroundStyle(inkColors[round.ink])
                    }
                    .frame(width: 290, height: 120)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(140), spacing: 10), count: 2), spacing: 10) {
                        ForEach(Array(ArcadeLogic.clashColorNames.enumerated()), id: \.offset) { idx, name in
                            Button { answer(idx) } label: {
                                HStack(spacing: 8) {
                                    Circle().fill(inkColors[idx]).frame(width: 13, height: 13)
                                    Text(name).font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInk)
                                }
                                .frame(width: 140, height: 52)
                                .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1))
                            }
                        }
                    }
                } else {
                    Text("\(score) of \(ArcadeLogic.clashRounds) clashes won")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.clashRounds)" } ?? "")
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
    }

    private var endDetail: String {
        if score >= 10 { return "Your seeing brain runs this town. The words never stood a chance." }
        if score >= 6 { return "Reading is automatic — overriding it even half the time is real focus work." }
        return "The clash is rigged: brains read faster than they see. Another round evens the odds."
    }

    private func start() {
        score = 0
        roundNo = 0
        verdict = nil
        isNewBest = false
        best = PlayScores.best(for: "colorclash")
        round = ArcadeLogic.buildClashRound()
        stage = 1
    }

    private func answer(_ idx: Int) {
        guard stage == 1, verdict == nil else { return }
        let right = idx == round.ink
        if right { score += 1 }
        verdict = right
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) {
            verdict = nil
            if roundNo + 1 >= ArcadeLogic.clashRounds {
                let prior = PlayScores.best(for: "colorclash")
                best = PlayScores.recordHigher(score, for: "colorclash")
                isNewBest = prior == nil || score > prior!
                stage = 2
                return
            }
            roundNo += 1
            round = ArcadeLogic.buildClashRound()
        }
    }
}
