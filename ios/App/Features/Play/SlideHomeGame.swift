import SwiftUI

// MARK: Slide Home — the 3×3 sliding puzzle, untimed. Tiles wear the colour
// of their home row so the board settles into three calm bands. The best is
// how close to par (the board's shortest path) you got.

struct SlideHomeGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var board: [Int] = []
    @State private var par = 0
    @State private var moves = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var reduced = false

    private let side: CGFloat = 92
    private let gap: CGFloat = 8

    var body: some View {
        GameChrome(title: "Slide Home", subtitle: "Slide the tiles home. Nothing is timed.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    mini(size: 40, spacing: 5, showNumbers: true)
                    Text("Eight tiles, one gap. Tap a tile beside the gap to slide it. Get every row back in its colour — every board has a par, but there's no clock.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Scatter the tiles") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    HStack(spacing: 12) {
                        Text("\(moves) \(moves == 1 ? "move" : "moves") · par \(par)")
                            .font(.kMono(13, weight: .bold)).foregroundStyle(Color.kInkSoft)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Color.kSurfaceSunken))
                        Button("New board") { start() }
                            .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                    }
                    boardView
                    HStack(spacing: 8) {
                        Text("home looks like").font(.kBody(12, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                        mini(size: 10, spacing: 2, showNumbers: false)
                    }
                    .accessibilityHidden(true)
                } else {
                    Text("Home in \(moves) moves").font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \(overPar($0))" } ?? "")
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
        .onAppear {
            best = PlayScores.best(for: "slidehome")
            reduced = UIAccessibility.isReduceMotionEnabled || KairoPrefs.reducedStimulation
        }
    }

    private var solved: Bool { !board.isEmpty && ArcadeLogic.isSlideSolved(board) }

    private var boardView: some View {
        let full = side * 3 + gap * 2
        let hole = board.firstIndex(of: 0) ?? 8
        let movable = Set(ArcadeLogic.slideNeighbors(hole))
        return ZStack(alignment: .topLeading) {
            ForEach(1...8, id: \.self) { tile in
                let cell = board.firstIndex(of: tile) ?? 0
                let home = tile == cell + 1
                Button { slide(cell) } label: {
                    Text("\(tile)")
                        .font(.kDisplay(26))
                        .foregroundStyle(ink(tile))
                        .frame(width: side, height: side)
                        .background(RoundedRectangle(cornerRadius: 20).fill(tint(tile)))
                        .overlay(alignment: .bottomTrailing) {
                            if home {
                                Circle().fill(ink(tile).opacity(0.45)).frame(width: 6, height: 6).padding(9)
                            }
                        }
                        .kCardShadow()
                }
                .buttonStyle(.plain)
                .offset(x: CGFloat(cell % 3) * (side + gap), y: CGFloat(cell / 3) * (side + gap))
                .accessibilityLabel("Tile \(tile)\(home ? ", home" : "")")
                .accessibilityHint(movable.contains(cell) && !solved ? "Slides into the gap" : "")
            }
        }
        .frame(width: full, height: full, alignment: .topLeading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 28).fill(Color.kSurfaceSunken))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(solved ? Color.kSuccess.opacity(0.6) : Color.kBorder, lineWidth: solved ? 2 : 1))
        .background(RoundedRectangle(cornerRadius: 32).fill(solved ? Color.kSuccess.opacity(0.15) : Color.clear).padding(-4))
    }

    private func mini(size: CGFloat, spacing: CGFloat, showNumbers: Bool) -> some View {
        VStack(spacing: spacing) {
            ForEach(0..<3, id: \.self) { row in
                HStack(spacing: spacing) {
                    ForEach(0..<3, id: \.self) { col in
                        let tile = row * 3 + col + 1
                        let isGap = tile == 9
                        RoundedRectangle(cornerRadius: size * 0.28)
                            .fill(isGap ? Color.kSurfaceSunken : tint(tile))
                            .frame(width: size, height: size)
                            .overlay {
                                if showNumbers && !isGap {
                                    Text("\(tile)").font(.kDisplay(size * 0.38)).foregroundStyle(ink(tile))
                                }
                            }
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func tint(_ tile: Int) -> Color {
        [Color.kCatButter, Color.kCatPeach, Color.kCatMint][(tile - 1) / 3]
    }

    private func ink(_ tile: Int) -> Color {
        [Color.kCatButterInk, Color.kCatPeachInk, Color.kCatMintInk][(tile - 1) / 3]
    }

    private func overPar(_ v: Int) -> String { v == 0 ? "on par" : "par +\(v)" }

    private var endDetail: String {
        if moves <= par { return "That's par — \(par) is the shortest path there is. Tidy." }
        if moves - par <= 6 { return "Only \(moves - par) over par (\(par)). The tiles barely noticed the detours." }
        return "Par was \(par). Every slide counted — and nobody was timing you."
    }

    private func start() {
        let next = ArcadeLogic.buildSlideBoard()
        board = next.board
        par = next.par
        moves = 0
        isNewBest = false
        best = PlayScores.best(for: "slidehome")
        stage = 1
    }

    private func slide(_ cell: Int) {
        guard stage == 1, !solved, let next = ArcadeLogic.slideTap(board, cell) else { return }
        withAnimation(reduced ? nil : .easeOut(duration: 0.18)) { board = next }
        moves += 1
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        guard ArcadeLogic.isSlideSolved(next) else { return }
        let over = max(0, moves - par)
        let prior = PlayScores.best(for: "slidehome")
        best = PlayScores.recordLower(over, for: "slidehome")
        isNewBest = prior == nil || over < prior!
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            if stage == 1 { stage = 2 }
        }
    }
}
