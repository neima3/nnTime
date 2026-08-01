import SwiftUI

// MARK: Pattern Tiles — a handful of tiles light up at once, then hide.
// Tap the ones that were lit; each clean recall adds a tile. Memory
// Trail's simultaneous sibling.

struct PatternTilesGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 showing, 2 recall, 3 done
    @State private var lit: [Int] = []
    @State private var picked: Set<Int> = []
    @State private var missed: Int?
    @State private var completedSize = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var phaseTask: Task<Void, Never>?

    var body: some View {
        GameChrome(title: "Pattern Tiles", subtitle: "A few tiles flash together. Hold the shape.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Three tiles light up at once, then hide. Find them all and the pattern grows by one. How big a shape can you hold?")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Light them up") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 || stage == 2 {
                    Text(stage == 1 ? "memorize — \(lit.count) tiles" : "your turn — \(picked.count) of \(lit.count)")
                        .font(.kBody(13, weight: .bold))
                        .foregroundStyle(stage == 1 ? Color.kInkSoft : Color.kIris)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 10).fill(stage == 1 ? Color.kSurfaceSunken : Color.kIrisGhost))
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(64), spacing: 8), count: 4), spacing: 8) {
                        ForEach(0..<ArcadeLogic.patternGrid, id: \.self) { idx in
                            let showLit = (stage == 1 || missed != nil) && lit.contains(idx)
                            let isPicked = picked.contains(idx)
                            let isMiss = missed == idx
                            Button { tap(idx) } label: {
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(isMiss ? Color.kDangerSoft : isPicked ? Color.kSuccessSoft : showLit ? Color.kIris : Color.kSurface)
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(
                                        isMiss ? Color.kDanger : isPicked ? Color.kSuccess.opacity(0.4) : showLit ? Color.kIrisDeep : Color.kBorder,
                                        lineWidth: 1))
                                    .frame(width: 64, height: 64)
                            }
                            .disabled(stage != 2 || missed != nil)
                            .accessibilityLabel("Tile \(idx + 1)\(isPicked ? ", found" : "")")
                        }
                    }
                } else {
                    Text(completedSize > 0 ? "Pattern of \(completedSize)" : "The tiles kept their secret")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    if completedSize > 0 {
                        Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: pattern of \($0)" } ?? "")
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
        .onAppear { best = PlayScores.best(for: "patterntiles") }
        .onDisappear { phaseTask?.cancel() }
    }

    private var endDetail: String {
        if completedSize >= ArcadeLogic.patternMax { return "Nine at once is the whole board's worth of holding. Remarkable." }
        if completedSize >= 6 { return "Holding six-plus shapes at once is serious spatial memory." }
        if completedSize > 0 { return "Every tile you held was a little map your brain drew and kept." }
        return "Three tiles vanish fast. One more look and they're yours."
    }

    private func show(size: Int) {
        lit = ArcadeLogic.pickPatternTiles(count: size)
        picked = []
        missed = nil
        stage = 1
        phaseTask?.cancel()
        phaseTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(ArcadeLogic.patternShowSeconds(count: size) * 1_000_000_000))
            if !Task.isCancelled { stage = 2 }
        }
    }

    private func start() {
        completedSize = 0
        isNewBest = false
        best = PlayScores.best(for: "patterntiles")
        show(size: ArcadeLogic.patternStart)
    }

    private func finish() {
        if completedSize > 0 {
            let prior = PlayScores.best(for: "patterntiles")
            best = PlayScores.recordHigher(completedSize, for: "patterntiles")
            isNewBest = prior == nil || completedSize > prior!
        }
        stage = 3
    }

    private func tap(_ idx: Int) {
        guard stage == 2, missed == nil, !picked.contains(idx) else { return }
        guard lit.contains(idx) else {
            missed = idx
            phaseTask?.cancel()
            phaseTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 900_000_000)
                if !Task.isCancelled { finish() }
            }
            return
        }
        picked.insert(idx)
        if picked.count == lit.count {
            completedSize = lit.count
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            if completedSize >= ArcadeLogic.patternMax {
                finish()
                return
            }
            let nextSize = completedSize + 1
            phaseTask?.cancel()
            phaseTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 700_000_000)
                if !Task.isCancelled { show(size: nextSize) }
            }
        }
    }
}
