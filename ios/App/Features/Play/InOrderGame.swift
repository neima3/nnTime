import SwiftUI

// MARK: In Order — five everyday how-tos, steps shuffled. Tap the steps in
// the order they belong; right picks lock into the plan, wrong picks wobble
// and stay. Best = clean rebuilds (no wobbles) out of 5. Mirrors the web
// InOrder component; pure logic lives in ArcadeLogic + OrderBank.

struct InOrderGame: View {
    let onExit: () -> Void

    private static let id = "inorder"

    @State private var rounds: [OrderItem] = []
    @State private var roundIdx = 0
    @State private var scramble: [Int] = []
    @State private var placed = 0
    @State private var misses = 0
    @State private var cleanCount = 0
    @State private var flashIdx: Int?
    @State private var done = false
    @State private var isNewBest = false
    @State private var best: Int?
    @State private var started = false

    var body: some View {
        GameChrome(
            title: "In Order",
            subtitle: "Steps, shuffled. Tap them in the order they belong.",
            onExit: onExit
        ) {
            ScrollView {
                VStack(spacing: 16) {
                    if !started {
                        EmptyView()
                    } else if done {
                        ending
                    } else if let item = rounds.indices.contains(roundIdx) ? rounds[roundIdx] : nil {
                        round(item)
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

    private func round(_ item: OrderItem) -> some View {
        let roundDone = placed >= item.steps.count
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text("\(roundIdx + 1) of \(rounds.count)")
                    .font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                if cleanCount > 0 {
                    Text("· \(cleanCount) clean").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kSuccess)
                }
            }
            Text(item.title)
                .font(.kDisplay(22)).foregroundStyle(Color.kInk)
                .padding(.top, 14)
            if placed > 0 {
                VStack(spacing: 6) {
                    ForEach(0..<placed, id: \.self) { i in
                        HStack(spacing: 10) {
                            Text("\(i + 1)")
                                .font(.kBody(11, weight: .bold))
                                .foregroundStyle(Color.kSuccess.opacity(0.7))
                            Text(item.steps[i])
                                .font(.kBody(14, weight: .semibold))
                                .foregroundStyle(Color.kSuccess)
                            Spacer()
                        }
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.kSuccessSoft))
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.kSuccess.opacity(0.3), lineWidth: 1))
                    }
                }
                .padding(.top, 16)
            }
            if !roundDone {
                VStack(spacing: 8) {
                    ForEach(scramble.filter { $0 >= placed }, id: \.self) { stepIndex in
                        stepChip(item.steps[stepIndex], stepIndex: stepIndex)
                    }
                }
                .padding(.top, 14)
            } else {
                VStack(spacing: 6) {
                    Text(misses == 0
                         ? "Clean rebuild — first try, every step."
                         : "Rebuilt with \(misses) wobble\(misses == 1 ? "" : "s"). Still counts as done.")
                        .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                    Button(roundIdx + 1 >= rounds.count ? "See how it went" : "Next how-to") { next() }
                        .buttonStyle(PrimaryPill())
                        .padding(.top, 10)
                }
                .padding(.top, 18)
            }
        }
    }

    private func stepChip(_ step: String, stepIndex: Int) -> some View {
        let isFlash = flashIdx == stepIndex
        return Button { tap(stepIndex) } label: {
            HStack {
                Text(step)
                    .font(.kBody(14.5, weight: .semibold))
                    .foregroundStyle(isFlash ? Color.kCatButterInk : Color.kInk)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            .background(RoundedRectangle(cornerRadius: 12)
                .fill(isFlash ? Color.kCatButter : Color.kSurface))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(isFlash ? Color.kCatButterInk.opacity(0.3) : Color.kBorder, lineWidth: 1))
        }
    }

    private var ending: some View {
        VStack(spacing: 12) {
            Text("\(cleanCount) of \(rounds.count) clean").font(.kDisplay(28)).foregroundStyle(Color.kInk)
            Text(isNewBest ? "New personal best 🎉" : best.map { "Your best: \($0)/\(ArcadeLogic.orderRounds)" } ?? "")
                .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
            Text(cleanCount == ArcadeLogic.orderRounds
                 ? "Every sequence, first try. Executive function is showing off."
                 : cleanCount >= 3
                 ? "Solid sequencing — ordering steps in your head is real planning work."
                 : "Shuffled steps are sneaky-hard. Every rebuild you finished still counts.")
                .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("Once more") { start() }.buttonStyle(SecondaryPill())
                Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
            }
            .padding(.top, 8)
        }
        .padding(.top, 40)
    }

    private func bootstrap() {
        guard !started else { return }
        best = PlayScores.best(for: Self.id)
        startRun()
        started = true
    }

    private func start() {
        best = PlayScores.best(for: Self.id)
        isNewBest = false
        done = false
        startRun()
    }

    private func startRun() {
        rounds = ArcadeLogic.pickOrderRounds(OrderBank.sequences)
        roundIdx = 0
        scramble = ArcadeLogic.scrambleOrder(count: rounds[0].steps.count)
        placed = 0
        misses = 0
        cleanCount = 0
        flashIdx = nil
    }

    private func tap(_ stepIndex: Int) {
        guard rounds.indices.contains(roundIdx) else { return }
        let item = rounds[roundIdx]
        guard placed < item.steps.count else { return }
        if stepIndex == placed {
            placed += 1
            flashIdx = nil
            if placed >= item.steps.count && misses == 0 {
                cleanCount += 1
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        } else {
            misses += 1
            flashIdx = stepIndex
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 600_000_000)
                if flashIdx == stepIndex { flashIdx = nil }
            }
        }
    }

    private func next() {
        if roundIdx + 1 >= rounds.count {
            let prior = PlayScores.best(for: Self.id)
            best = PlayScores.recordHigher(cleanCount, for: Self.id)
            isNewBest = prior == nil || cleanCount > prior!
            done = true
            return
        }
        roundIdx += 1
        scramble = ArcadeLogic.scrambleOrder(count: rounds[roundIdx].steps.count)
        placed = 0
        misses = 0
        flashIdx = nil
    }
}
