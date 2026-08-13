import SwiftUI

// MARK: Odd One Out — one impostor emoji hides among its near-twins.

struct OddOneOutGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var pairs: [(String, String)] = []
    @State private var roundNo = 0
    @State private var round: ArcadeLogic.OddRound?
    @State private var wrongAt: Int?
    @State private var foundAt: Int?
    @State private var startedAt = Date()
    @State private var elapsed: Double = 0
    @State private var finalTenths = 0
    @State private var isNewBest = false
    @State private var best: Int?
    private let timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        GameChrome(title: "Odd One Out", subtitle: "One of these is not like the others.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Every round hides one near-twin impostor in the crowd. Eight rounds, growing grids — only the clock keeps score.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Start spotting") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1, let round {
                    HStack(spacing: 12) {
                        Text("round \(roundNo + 1) of \(ArcadeLogic.oddRounds)")
                            .font(.kBody(13, weight: .bold)).foregroundStyle(Color.kIris)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Color.kIrisGhost))
                        Text(String(format: "%.1fs", elapsed))
                            .font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    }
                    let cell: CGFloat = round.size == 3 ? 76 : round.size == 4 ? 62 : 52
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(cell), spacing: 8), count: round.size), spacing: 8) {
                        ForEach(0..<(round.size * round.size), id: \.self) { idx in
                            Button { tap(idx) } label: {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(foundAt == idx ? Color.kSuccessSoft : wrongAt == idx ? Color.kDangerSoft : Color.kSurface)
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(foundAt == idx ? Color.kSuccess.opacity(0.4) : wrongAt == idx ? Color.kDanger : Color.kBorder, lineWidth: 1)
                                    Text(idx == round.oddIndex ? round.odd : round.base)
                                        .font(.system(size: cell * 0.42))
                                }
                                .frame(width: cell, height: cell)
                            }
                            .accessibilityLabel("Tile \(idx + 1)")
                        }
                    }
                } else {
                    Text(String(format: "All eight in %.1fs", Double(finalTenths) / 10))
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { String(format: "Your best: %.1fs", Double($0) / 10) } ?? "")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text(finalTenths <= 300
                         ? "Hawk eyes. The impostors are filing a complaint."
                         : "Telling almost-identical things apart is genuinely hard attention work — and you did it eight times.")
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
        pairs = ArcadeLogic.shuffledOddPairs()
        roundNo = 0
        round = ArcadeLogic.buildOddRound(round: 0, pair: pairs[0])
        wrongAt = nil
        foundAt = nil
        elapsed = 0
        isNewBest = false
        best = PlayScores.best(for: "oddoneout")
        startedAt = Date()
        stage = 1
    }

    private func tap(_ idx: Int) {
        guard stage == 1, let current = round, foundAt == nil else { return }
        guard idx == current.oddIndex else {
            wrongAt = idx
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { if wrongAt == idx { wrongAt = nil } }
            return
        }
        foundAt = idx
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        let nextNo = roundNo + 1
        if nextNo >= ArcadeLogic.oddRounds {
            let tenths = ArcadeLogic.schulteTenths(elapsedMs: Date().timeIntervalSince(startedAt) * 1000)
            finalTenths = tenths
            let prior = PlayScores.best(for: "oddoneout")
            best = PlayScores.recordLower(tenths, for: "oddoneout")
            isNewBest = prior == nil || tenths < prior!
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { stage = 2 }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            foundAt = nil
            wrongAt = nil
            roundNo = nextNo
            round = ArcadeLogic.buildOddRound(round: nextNo, pair: pairs[nextNo])
        }
    }
}

// MARK: Digit Span — digits flash, then you tap them back.

struct DigitSpanGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 showing, 2 typing, 3 done
    @State private var span = ""
    @State private var entered = ""
    @State private var completedLen = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var revealTask: Task<Void, Never>?

    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

    var body: some View {
        GameChrome(title: "Digit Span", subtitle: "Numbers flash, then it's all you.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Three digits to start. Hold them for a breath, tap them back, and the span grows by one. How long is your line?")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Flash the digits") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Text("memorize — \(span.count) digits")
                        .font(.kBody(13, weight: .bold)).foregroundStyle(Color.kInkSoft)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.kSurfaceSunken))
                    Text(span)
                        .font(.kMono(46, weight: .bold)).kerning(6)
                        .foregroundStyle(Color.kInk)
                } else if stage == 2 {
                    Text("your turn — \(entered.count) of \(span.count)")
                        .font(.kBody(13, weight: .bold)).foregroundStyle(Color.kIris)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.kIrisGhost))
                    Text(entered.isEmpty ? "·" : entered)
                        .font(.kMono(34, weight: .bold)).kerning(5)
                        .foregroundStyle(entered == String(span.prefix(entered.count)) ? Color.kInk : Color.kDanger)
                        .frame(height: 44)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(64), spacing: 8), count: 3), spacing: 8) {
                        ForEach(keys, id: \.self) { key in
                            keypadButton(key) { press(key) }
                        }
                        Button { erase() } label: {
                            Text("⌫")
                                .font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInkSoft)
                                .frame(width: 64, height: 64)
                                .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurfaceSunken))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1))
                        }
                        .accessibilityLabel("Delete last digit")
                        keypadButton("0") { press("0") }
                    }
                } else {
                    Text(completedLen > 0 ? "Span of \(completedLen)" : "The digits got away")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    if completedLen > 0 {
                        Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: span of \($0)" } ?? "")
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
        .onDisappear { revealTask?.cancel() }
    }

    private var endDetail: String {
        if completedLen >= 7 { return "Seven-plus is phone-number territory — working memory in top form." }
        if completedLen > 0 { return "Every digit you held was your brain juggling in real time." }
        return "Three digits vanish fast. One more flash and they're yours."
    }

    private func keypadButton(_ key: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(key)
                .font(.kMono(20, weight: .bold)).foregroundStyle(Color.kInk)
                .frame(width: 64, height: 64)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1))
        }
    }

    private func start() {
        completedLen = 0
        isNewBest = false
        best = PlayScores.best(for: "digitspan")
        show(len: ArcadeLogic.spanStart)
    }

    private func show(len: Int) {
        span = ArcadeLogic.makeSpan(len: len)
        entered = ""
        stage = 1
        revealTask?.cancel()
        revealTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(ArcadeLogic.spanShowSeconds(len: len) * 1_000_000_000))
            if !Task.isCancelled { stage = 2 }
        }
    }

    private func press(_ key: String) {
        guard stage == 2 else { return }
        entered += key
        guard entered.count >= span.count else { return }
        if entered == span {
            completedLen = span.count
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            let nextLen = span.count + 1
            revealTask?.cancel()
            revealTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 550_000_000)
                if !Task.isCancelled { show(len: nextLen) }
            }
        } else {
            if completedLen > 0 {
                let prior = PlayScores.best(for: "digitspan")
                best = PlayScores.recordHigher(completedLen, for: "digitspan")
                isNewBest = prior == nil || completedLen > prior!
            }
            stage = 3
        }
    }

    private func erase() {
        guard stage == 2 else { return }
        if !entered.isEmpty { entered.removeLast() }
    }
}

// MARK: Green Light — go / no-go; holding back is the game.

struct GreenLightGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 playing, 2 done
    @State private var idx = 0
    @State private var showing = false
    @State private var goNow = true
    @State private var flash: Bool?  // true hit, false slip
    @State private var score = 0
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var sequence: [Bool] = []
    @State private var tapped = false
    @State private var runTask: Task<Void, Never>?

    var body: some View {
        GameChrome(title: "Green Light", subtitle: "Green means tap. Red means don't.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Signals flash fast: tap every green light, and let the red ones pass. Your tapping finger will have opinions.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Start the signals") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Text("\(min(idx + 1, ArcadeLogic.goRounds)) of \(ArcadeLogic.goRounds)")
                        .font(.kMono(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    Button { tap() } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 40)
                                .fill(flash == true ? Color.kSuccessSoft : flash == false ? Color.kDangerSoft : Color.kSurfaceSunken)
                            RoundedRectangle(cornerRadius: 40)
                                .stroke(flash == true ? Color.kSuccess.opacity(0.5) : flash == false ? Color.kDanger.opacity(0.5) : Color.kBorder, lineWidth: 4)
                            Text(showing ? (goNow ? "🟢" : "🛑") : "")
                                .font(.system(size: 64))
                        }
                        .frame(width: 250, height: 250)
                    }
                    .accessibilityLabel(showing ? (goNow ? "Green light — tap!" : "Red light — hold back") : "Waiting for the next signal")
                } else {
                    Text("\(score) of \(ArcadeLogic.goRounds) right calls")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.goRounds)" } ?? "")
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
        .onDisappear { runTask?.cancel() }
    }

    private var endDetail: String {
        if score >= 21 { return "Elite impulse control. Your tapping finger takes orders now." }
        if score >= 15 { return "Solid — stopping a tap mid-flight is genuinely harder than starting one." }
        return "The red lights are rigged against eager fingers. Another run evens it out."
    }

    private func start() {
        runTask?.cancel()
        sequence = ArcadeLogic.buildGoSequence()
        score = 0
        idx = 0
        showing = false
        flash = nil
        isNewBest = false
        best = PlayScores.best(for: "greenlight")
        stage = 1
        runTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            var runningScore = 0
            for i in 0..<sequence.count {
                if Task.isCancelled { return }
                tapped = false
                goNow = sequence[i]
                idx = i
                showing = true
                flash = nil
                try? await Task.sleep(nanoseconds: UInt64(ArcadeLogic.goShowSeconds * 1_000_000_000))
                if Task.isCancelled { return }
                showing = false
                try? await Task.sleep(nanoseconds: UInt64(ArcadeLogic.goGapSeconds * 1_000_000_000))
                if Task.isCancelled { return }
                let correct = sequence[i] == tapped
                if correct { runningScore += 1 }
                score = runningScore
                if sequence[i] && !tapped { flash = false }
            }
            let prior = PlayScores.best(for: "greenlight")
            best = PlayScores.recordHigher(runningScore, for: "greenlight")
            isNewBest = prior == nil || runningScore > prior!
            stage = 2
        }
    }

    private func tap() {
        guard stage == 1, showing, !tapped else { return }
        tapped = true
        flash = goNow
        if goNow { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }
}
