import SwiftUI

// MARK: - Brain breaks: two minutes of play counts as rest. Personal bests only.

struct PlayView: View {
    @State private var active: Game?
    @State private var bests: [String: Int] = [:]
    enum Game: String, Identifiable {
        case timeFeel, quickTap, emojiMatch, grammar, spelling, focusFinder, memoryTrail, colorClash, breath,
             oddOneOut, digitSpan, greenLight, nightSky, letterSoup, patternTiles, proofIt, numberLadder, inOrder
        var id: String { rawValue }
    }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Two minutes of play counts as rest. No streaks, no scores that matter — just your own bests.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).padding(.bottom, 4)

                    dailyThreeStrip

                    sectionHeader("Sharp & fast", "Eyes and reflexes on sprint duty.")
                    card("⚡", "Quick Tap", "Purple means go. How fast are you today?", .kCatButter,
                         best: bests["quicktap"].map { "best \($0) ms" }) { active = .quickTap }
                    card("🔍", "Focus Finder", "1 to 25, hiding in plain sight. Eyes on sprint duty.", .kCatSky,
                         best: bests["focusfinder"].map { String(format: "best %.1fs", Double($0) / 10) }) { active = .focusFinder }
                    card("🕵️", "Odd One Out", "One of these is not like the others.", .kCatButter,
                         best: bests["oddoneout"].map { String(format: "best %.1fs", Double($0) / 10) }) { active = .oddOneOut }
                    card("🎨", "Color Clash", "Tap what you see, not what you read.", .kCatRose,
                         best: bests["colorclash"].map { "best \($0)/12" }) { active = .colorClash }
                    card("🚦", "Green Light", "Green means tap. Red means don't. Simple. Ha.", .kCatMint,
                         best: bests["greenlight"].map { "best \($0)/24" }) { active = .greenLight }

                    sectionHeader("Hold it in mind", "Working memory, lifting gently.")
                    card("🃏", "Emoji Match", "Eight pairs hiding in sixteen cards.", .kCatPeach,
                         best: bests["emojimatch"].map { "best \($0) moves" }) { active = .emojiMatch }
                    card("🐾", "Memory Trail", "Watch the path glow, then walk it back.", .kCatLilac,
                         best: bests["memorytrail"].map { "best trail \($0)" }) { active = .memoryTrail }
                    card("🔢", "Digit Span", "Numbers flash, then it's all you.", .kCatPeach,
                         best: bests["digitspan"].map { "best span \($0)" }) { active = .digitSpan }
                    card("🧩", "Pattern Tiles", "A few tiles flash together. Hold the shape.", .kCatSky,
                         best: bests["patterntiles"].map { "best pattern \($0)" }) { active = .patternTiles }
                    card("🪜", "Number Ladder", "Start small. Climb one sum at a time — no paper allowed.", .kCatPeach,
                         best: bests["numberladder"].map { "best \($0)/6" }) { active = .numberLadder }
                    card("🧭", "In Order", "Five everyday how-tos, steps shuffled. Rebuild them.", .kCatLilac,
                         best: bests["inorder"].map { "best \($0)/5 clean" }) { active = .inOrder }

                    sectionHeader("Wordplay", "Snags and spellings, zero red pens.")
                    card("📝", "Grammar Snap", "60+ classic snags across ten topics — it remembers the ones that get you.", .kCatSky,
                         best: bests["grammarsnap"].map { "best \($0)/8" }) { active = .grammar }
                    card("🔤", "Spell Check", "Definitely? Definately? One of these is real.", .kCatRose,
                         best: bests["spellcheck"].map { "best \($0)/8" }) { active = .spelling }
                    card("🍲", "Letter Soup", "Everyday words, gently scrambled.", .kCatButter,
                         best: bests["lettersoup"].map { "best \($0)/8" }) { active = .letterSoup }
                    card("✏️", "Proof It", "One word in each sentence is wrong. Trust your eye.", .kCatMint,
                         best: bests["proofit"].map { "best \($0)/8" }) { active = .proofIt }

                    sectionHeader("Slow down", "For spinning heads and racing clocks.")
                    card("⏳", "Time Feel", "Your brain vs. the clock — no peeking.", .kCatLilac,
                         best: bests["timefeel"].map { "best \($0)/100" }) { active = .timeFeel }
                    card("🫧", "Steady Breath", "A square minute for a spinning head.", .kCatMint, best: nil) { active = .breath }
                    card("🌌", "Night Sky", "Connect the stars. Nothing is timed.", .kCatLilac,
                         best: bests["nightsky"].flatMap { $0 > 0 ? "\($0) skies traced" : nil }) { active = .nightSky }

                    Text("Honesty corner: these are breaks, not brain training — the science on games \"fixing\" attention is thin, and we won't pretend otherwise.")
                        .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint).padding(.top, 8)
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .principal) {
            Text("Brain breaks").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
        } }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .onAppear { refreshBests() }
        .fullScreenCover(item: $active, onDismiss: { refreshBests() }) { game in
            switch game {
            case .timeFeel: TimeFeelGame { active = nil }
            case .quickTap: QuickTapGame { active = nil }
            case .emojiMatch: EmojiMatchGame { active = nil }
            case .grammar:
                QuizGameView(
                    id: "grammarsnap",
                    title: "Grammar Snap",
                    intro: "Tap the word that fits. No red pens here.",
                    bank: QuizBank.grammar,
                    endDetail: { score in
                        score >= 7 ? "Basically an editor. English fears you."
                        : score >= 4 ? "Solid — and every miss came with a memory hook."
                        : "These pairs trip up native speakers daily. Now you know their tricks."
                    }
                ) { active = nil }
            case .spelling:
                QuizGameView(
                    id: "spellcheck",
                    title: "Spell Check",
                    intro: "Tap the real spelling among the impostors.",
                    bank: QuizBank.spelling,
                    endDetail: { score in
                        score >= 7 ? "Spelling bee champion energy."
                        : score >= 4 ? "Good eye — the impostors are convincing on purpose."
                        : "These are the most-misspelled words in English. You're in excellent company."
                    }
                ) { active = nil }
            case .focusFinder: FocusFinderGame { active = nil }
            case .memoryTrail: MemoryTrailGame { active = nil }
            case .colorClash: ColorClashGame { active = nil }
            case .oddOneOut: OddOneOutGame { active = nil }
            case .digitSpan: DigitSpanGame { active = nil }
            case .greenLight: GreenLightGame { active = nil }
            case .nightSky: NightSkyGame { active = nil }
            case .letterSoup: LetterSoupGame { active = nil }
            case .patternTiles: PatternTilesGame { active = nil }
            case .proofIt: ProofItGame { active = nil }
            case .numberLadder: NumberLadderGame { active = nil }
            case .inOrder: InOrderGame { active = nil }
            case .breath: SteadyBreathGame { active = nil }
            }
        }
    }

    /// Web GameId → native case + display meta, for the Daily Three strip.
    private static let webIdMeta: [String: (game: Game, emoji: String, title: String)] = [
        "quick-tap": (.quickTap, "⚡", "Quick Tap"),
        "number-hunt": (.focusFinder, "🔍", "Focus Finder"),
        "odd-one-out": (.oddOneOut, "🕵️", "Odd One Out"),
        "color-clash": (.colorClash, "🎨", "Color Clash"),
        "green-light": (.greenLight, "🚦", "Green Light"),
        "emoji-match": (.emojiMatch, "🃏", "Emoji Match"),
        "memory-trail": (.memoryTrail, "🐾", "Memory Trail"),
        "digit-span": (.digitSpan, "🔢", "Digit Span"),
        "pattern-tiles": (.patternTiles, "🧩", "Pattern Tiles"),
        "number-ladder": (.numberLadder, "🪜", "Number Ladder"),
        "in-order": (.inOrder, "🧭", "In Order"),
        "grammar-snap": (.grammar, "📝", "Grammar Snap"),
        "spell-check": (.spelling, "🔤", "Spell Check"),
        "letter-soup": (.letterSoup, "🍲", "Letter Soup"),
        "proof-it": (.proofIt, "✏️", "Proof It"),
        "time-feel": (.timeFeel, "⏳", "Time Feel"),
        "steady-breath": (.breath, "🫧", "Steady Breath"),
        "night-sky": (.nightSky, "🌌", "Night Sky"),
    ]

    private var dailyThreeStrip: some View {
        let picks = ArcadeLogic.dailyThree(dateKey: ArcadeLogic.dailyThreeKey())
            .compactMap { Self.webIdMeta[$0] }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("TODAY'S THREE")
                    .font(.kBody(11.5, weight: .bold)).kerning(1.4)
                    .foregroundStyle(Color.kIris)
                Text("Picked for today — no choosing required.")
                    .font(.kBody(11.5)).foregroundStyle(Color.kInkFaint)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            ForEach(picks, id: \.title) { pick in
                Button {
                    active = pick.game
                } label: {
                    HStack(spacing: 10) {
                        Text(pick.emoji)
                            .font(.system(size: 17))
                            .frame(width: 34, height: 34)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Color.kSurfaceSunken))
                        Text(pick.title)
                            .font(.kDisplay(15)).foregroundStyle(Color.kInk)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.kInkFaint)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color.kSurface))
                    .overlay(RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.kIris.opacity(0.25), lineWidth: 1))
                }
                .accessibilityLabel("Play \(pick.title), one of today's three")
            }
        }
        .padding(.bottom, 4)
    }

    private func refreshBests() {
        var next: [String: Int] = [:]
        for key in ["timefeel", "quicktap", "emojimatch", "grammarsnap", "spellcheck",
                    "focusfinder", "memorytrail", "colorclash", "oddoneout", "digitspan",
                    "greenlight", "nightsky", "lettersoup", "patterntiles", "proofit",
                    "numberladder", "inorder"] {
            next[key] = PlayScores.best(for: key)
        }
        bests = next
    }

    private func sectionHeader(_ label: String, _ blurb: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label.uppercased())
                .font(.kBody(11.5, weight: .bold)).kerning(1.4)
                .foregroundStyle(Color.kInkFaint)
            Text(blurb).font(.kBody(11.5)).foregroundStyle(Color.kInkFaint)
        }
        .padding(.top, 10)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func card(_ emoji: String, _ title: String, _ hook: String, _ tint: Color, best: String?, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 14) {
                Text(emoji).font(.system(size: 26)).frame(width: 52, height: 52).background(RoundedRectangle(cornerRadius: 16).fill(tint))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.kBody(17, weight: .bold)).foregroundStyle(Color.kInk)
                    Text(hook).font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                }
                Spacer()
                if let best {
                    Text(best)
                        .font(.kMono(11, weight: .bold)).foregroundStyle(Color.kInkSoft)
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.kSurfaceSunken))
                }
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.kInkFaint)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
        }
    }
}

// Shared game chrome
struct GameChrome<Content: View>: View {
    let title: String
    var subtitle: String? = nil
    let onExit: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
                        if let subtitle {
                            Text(subtitle).font(.kBody(12)).foregroundStyle(Color.kInkSoft).lineLimit(1)
                        }
                    }
                    Spacer()
                    Button { onExit() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                            .frame(width: 40, height: 40).background(Circle().fill(Color.kSurface)).kCardShadow()
                    }
                    .accessibilityLabel("Exit game")
                }.padding(.horizontal, 20).padding(.top, 16)
                Spacer(); content; Spacer()
            }
        }
    }
}

// MARK: Time Feel — reproduce N seconds without a clock
struct TimeFeelGame: View {
    let onExit: () -> Void
    @State private var stage = 0   // 0 intro, 1 counting, 2 feedback, 3 done
    @State private var round = 0
    @State private var startedAt = Date()
    @State private var results: [(target: Int, actual: Double)] = []
    private let targets = [5, 8, 12, 20]

    var body: some View {
        GameChrome(title: "Time Feel", onExit: onExit) {
            let target = targets[min(round, targets.count - 1)]
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("Round \(round + 1) of \(targets.count)").font(.kBody(12, weight: .bold)).foregroundStyle(Color.kInkFaint)
                    Text("\(target) seconds").font(.kDisplay(44)).foregroundStyle(Color.kInk)
                    Text("Feel the time pass, tap when \(target)s are up. No counting out loud.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 40)
                    Button("Start feeling") { startedAt = Date(); stage = 1 }
                        .buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Button {
                        results.append((target, Date().timeIntervalSince(startedAt)))
                        stage = round + 1 >= targets.count ? 3 : 2
                    } label: {
                        VStack(spacing: 10) {
                            Text("⏳").font(.system(size: 48))
                            Text("Tap when \(target)s feel over").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
                        }
                        .frame(width: 240, height: 240).background(Circle().stroke(Color.kIrisSoft, lineWidth: 8)).background(Circle().fill(Color.kSurface)).kFloatShadow()
                    }
                } else if stage == 2, let last = results.last {
                    Text(String(format: "%.1fs", last.actual)).font(.kDisplay(40)).foregroundStyle(Color.kInk)
                    Text(feeling(last)).font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInk).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Next round") { round += 1; stage = 0 }.buttonStyle(PrimaryPill())
                } else {
                    let s = score()
                    let best = PlayScores.recordHigher(s, for: "timefeel")
                    Text("Inner clock: \(s)/100").font(.kDisplay(30)).foregroundStyle(Color.kInk)
                    Text(s >= best ? "New personal best 🎉" : "Your best: \(best)/100")
                        .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    Text("Everyone's clock drifts — that's exactly why your timeline does the feeling for you.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
    }
    private func feeling(_ r: (target: Int, actual: Double)) -> String {
        let err = (r.actual - Double(r.target)) / Double(r.target)
        if abs(err) <= 0.08 { return "Spot on. Your inner clock showed up today." }
        return err < 0 ? "\(r.target)s felt shorter to you — a fast-running brain." : "\(r.target)s felt longer — time was dragging."
    }
    private func score() -> Int {
        ArcadeLogic.timeFeelScore(results.map { (targetSec: Double($0.target), actualSec: $0.actual) })
    }
}

// MARK: - Personal bests (G8) — local, never shared, just your own.
enum PlayScores {
    private static let store = UserDefaults(suiteName: "group.me.neima.kairo") ?? .standard

    /// Record a score where higher is better; returns the current best.
    static func recordHigher(_ value: Int, for key: String) -> Int {
        let k = "kairo-best-\(key)"
        let prev = store.object(forKey: k) as? Int
        let best = max(value, prev ?? value)
        if prev == nil || value > prev! { store.set(best, forKey: k) }
        return best
    }

    /// Accumulate a lifetime counter (e.g. skies traced); returns the total.
    static func recordCount(_ value: Int, for key: String) -> Int {
        let k = "kairo-best-\(key)"
        let total = (store.object(forKey: k) as? Int ?? 0) + value
        store.set(total, forKey: k)
        return total
    }

    /// Record a score where lower is better (e.g. reaction ms); returns best.
    static func recordLower(_ value: Int, for key: String) -> Int {
        let k = "kairo-best-\(key)"
        let prev = store.object(forKey: k) as? Int
        let best = min(value, prev ?? value)
        if prev == nil || value < prev! { store.set(best, forKey: k) }
        return best
    }

    static func best(for key: String) -> Int? {
        store.object(forKey: "kairo-best-\(key)") as? Int
    }
}

// MARK: Quick Tap
struct QuickTapGame: View {
    let onExit: () -> Void
    @State private var stage = 0  // 0 intro, 1 wait, 2 go, 3 early, 4 between, 5 done
    @State private var round = 0
    @State private var goAt = Date()
    @State private var times: [Int] = []
    @State private var last = 0
    @State private var task: Task<Void, Never>?
    private let rounds = 5

    var body: some View {
        GameChrome(title: "Quick Tap", onExit: onExit) {
            VStack(spacing: 18) {
                switch stage {
                case 0:
                    Text("Wait for purple, then tap fast. \(rounds) rounds, average wins.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 40)
                    Button("Round \(round + 1) — ready") { arm() }.buttonStyle(PrimaryPill())
                case 1, 2:
                    Button { tap() } label: {
                        Text(stage == 2 ? "TAP!" : "wait for it…")
                            .font(.kBody(20, weight: .bold)).foregroundStyle(stage == 2 ? Color.kInkInverse : Color.kInkFaint)
                            .frame(width: 250, height: 250)
                            .background(RoundedRectangle(cornerRadius: 40).fill(stage == 2 ? Color.kIris : Color.kSurfaceSunken)).kFloatShadow()
                    }
                case 3:
                    Text("Jumped the gun 😅").font(.kDisplay(24)).foregroundStyle(Color.kInk)
                    Text("Happens to the best brains. That round doesn't count.").font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Go again") { arm() }.buttonStyle(PrimaryPill())
                case 4:
                    Text("\(last) ms").font(.kDisplay(44)).foregroundStyle(Color.kInk)
                    Text("Round \(times.count) of \(rounds)").font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                    Button("Next round") { arm() }.buttonStyle(PrimaryPill())
                default:
                    let avg = ArcadeLogic.quickTapAverage(times.map { Optional($0) })
                    let best = avg.map { PlayScores.recordLower($0, for: "quicktap") } ?? PlayScores.best(for: "quicktap")
                    Text(avg.map { "Average: \($0) ms" } ?? "All jumps 😄").font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    if let best, let avg {
                        Text(avg <= best ? "New personal best 🎉" : "Your best: \(best) ms")
                            .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kIris)
                    }
                    Text("Reaction wobbles with sleep, food, and interest. A snapshot, not a verdict.").font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 30)
                    Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
        .onDisappear { task?.cancel() }
    }
    private func arm() {
        if times.count >= rounds { return }
        round = min(round + (stage == 0 ? 0 : 1), rounds)
        stage = 1
        let delay = ArcadeLogic.quickTapDelayMs(roll: Double.random(in: 0..<1))
        task = Task {
            try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000)
            if !Task.isCancelled { goAt = Date(); stage = 2 }
        }
    }
    private func tap() {
        if stage == 1 {
            // An early tap still fills a round slot — if it was the last one,
            // the run ends instead of stranding the player on "Go again".
            task?.cancel()
            times.append(-1)
            stage = times.count >= rounds ? 5 : 3
            return
        }
        if stage == 2 {
            last = ArcadeLogic.jsRound(Date().timeIntervalSince(goAt) * 1000)
            times.append(last)
            stage = times.count >= rounds ? 5 : 4
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}

// MARK: Steady Breath (box breathing 4-4-4-4)
struct SteadyBreathGame: View {
    let onExit: () -> Void
    @State private var running = false
    @State private var cyclesTarget = 4
    @State private var cycle = 0
    @State private var phase = 0
    @State private var secLeft = 4
    @State private var finished = false
    @State private var reduced = false
    private let phases = [("Breathe in", 4), ("Hold", 4), ("Breathe out", 4), ("Rest", 4)]
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        GameChrome(title: "Steady Breath", onExit: onExit) {
            VStack(spacing: 18) {
                if !running && !finished {
                    Text("One minute of square breathing settles a spinning head. No score — breathing isn't a competition.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft).multilineTextAlignment(.center).padding(.horizontal, 36)
                    HStack(spacing: 10) {
                        Button("1 minute") { start(4) }.buttonStyle(PrimaryPill())
                        Button("2 minutes") { start(8) }.buttonStyle(SecondaryPill())
                    }
                } else if running {
                    let grow = phases[phase].0 == "Breathe in" || phases[phase].0 == "Hold"
                    RoundedRectangle(cornerRadius: 28).fill(Color.kIrisSoft).overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.kIris, lineWidth: 4))
                        .frame(width: reduced ? 200 : (grow ? 230 : 150), height: reduced ? 200 : (grow ? 230 : 150))
                        .animation(reduced ? nil : .easeInOut(duration: 3.6), value: grow)
                        .overlay(VStack(spacing: 4) {
                            Text(phases[phase].0).font(.kBody(18, weight: .bold)).foregroundStyle(Color.kIris)
                            Text("\(secLeft)").font(.kMono(28, weight: .bold)).foregroundStyle(Color.kInk)
                        })
                    Text("cycle \(min(cycle + 1, cyclesTarget)) of \(cyclesTarget)").font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                    Button("I'm good, stop here") { onExit() }.font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                } else {
                    Text("Steadier.").font(.kDisplay(30)).foregroundStyle(Color.kInk)
                    Text("A real minute of rest — the kind that counts.").font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                    Button("Back to it") { onExit() }.buttonStyle(PrimaryPill())
                }
            }
        }
        .onAppear { reduced = UIAccessibility.isReduceMotionEnabled || KairoPrefs.reducedStimulation }
        .onReceive(timer) { _ in tick() }
    }
    private func start(_ c: Int) { cyclesTarget = c; cycle = 0; phase = 0; secLeft = 4; finished = false; running = true }
    private func tick() {
        guard running else { return }
        if secLeft > 1 { secLeft -= 1; return }
        let next = (phase + 1) % phases.count
        if next == 0 {
            cycle += 1
            if cycle >= cyclesTarget { running = false; finished = true; return }
        }
        phase = next; secLeft = phases[next].1
    }
}

struct PrimaryPill: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkInverse)
            .padding(.horizontal, 28).padding(.vertical, 14).background(Capsule().fill(Color.kIris))
            .scaleEffect(configuration.isPressed ? 0.97 : 1).kFloatShadow()
    }
}
struct SecondaryPill: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkSoft)
            .padding(.horizontal, 28).padding(.vertical, 14).background(Capsule().fill(Color.kSurface).overlay(Capsule().stroke(Color.kBorder, lineWidth: 1)))
    }
}
