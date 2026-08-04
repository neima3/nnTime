import Foundation

// Pure logic for the brain-breaks arcade — mirrors src/lib/games.ts so web and
// iOS behave identically. Every function takes a seedable RNG for tests.
enum ArcadeLogic {
    // MARK: Focus Finder (Schulte grid)

    static let schulteSize = 25

    static func buildSchulteGrid(random: () -> Double = { Double.random(in: 0..<1) }) -> [Int] {
        var cells = Array(1...schulteSize)
        for i in stride(from: cells.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            cells.swapAt(i, j)
        }
        return cells
    }

    /// Elapsed milliseconds → tenths of a second (lower is better, floored at 1).
    static func schulteTenths(elapsedMs: Double) -> Int {
        max(1, Int((elapsedMs / 100).rounded()))
    }

    // MARK: Memory Trail (sequence recall)

    static let trailTiles = 9
    static let trailStartLength = 3

    /// Extend a trail by one tile — never the same tile twice in a row.
    static func extendTrail(_ trail: [Int], random: () -> Double = { Double.random(in: 0..<1) }) -> [Int] {
        let last = trail.last
        var next = min(Int(random() * Double(trailTiles)), trailTiles - 1)
        if next == last {
            let shift = 1 + min(Int(random() * Double(trailTiles - 1)), trailTiles - 2)
            next = (next + shift) % trailTiles
        }
        return trail + [next]
    }

    static func buildTrail(random: () -> Double = { Double.random(in: 0..<1) }) -> [Int] {
        var trail: [Int] = []
        while trail.count < trailStartLength { trail = extendTrail(trail, random: random) }
        return trail
    }

    // MARK: Color Clash (Stroop)

    static let clashColorNames = ["Pink", "Blue", "Green", "Purple"]
    static let clashRounds = 12

    struct ClashRound: Equatable {
        let word: Int
        let ink: Int
    }

    /// One Stroop round; roughly 1 in 4 is congruent to keep players honest.
    static func buildClashRound(random: () -> Double = { Double.random(in: 0..<1) }) -> ClashRound {
        let n = clashColorNames.count
        let word = min(Int(random() * Double(n)), n - 1)
        if random() < 0.25 { return ClashRound(word: word, ink: word) }
        let shift = 1 + min(Int(random() * Double(n - 1)), n - 2)
        return ClashRound(word: word, ink: (word + shift) % n)
    }

    // MARK: Emoji Match (pairs)

    static let matchEmoji = ["🌤", "🎨", "🍜", "🏋️", "📚", "🧘", "☕", "🌙"]

    static func buildMatchDeck(random: () -> Double = { Double.random(in: 0..<1) }) -> [String] {
        var deck = matchEmoji + matchEmoji
        for i in stride(from: deck.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            deck.swapAt(i, j)
        }
        return deck
    }

    // MARK: Odd One Out (visual search)

    /// Look-alike emoji pairs — every round hides one impostor among its twin.
    static let oddPairs: [(String, String)] = [
        ("🙂", "🙃"), ("🐶", "🐺"), ("⭐", "🌟"), ("🍏", "🍐"),
        ("😺", "😸"), ("🌸", "🌺"), ("🔵", "🟣"), ("🌛", "🌜"),
    ]
    static let oddRounds = 8

    /// Grid side length for a round: 3×3 warm-up → 5×5 finale.
    static func oddGridSize(round: Int) -> Int {
        round < 3 ? 3 : round < 6 ? 4 : 5
    }

    /// Shuffled copy of oddPairs so each run meets the pairs in a new order.
    static func shuffledOddPairs(random: () -> Double = { Double.random(in: 0..<1) }) -> [(String, String)] {
        var pairs = oddPairs
        for i in stride(from: pairs.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            pairs.swapAt(i, j)
        }
        return pairs
    }

    struct OddRound: Equatable {
        let base: String
        let odd: String
        let size: Int
        let oddIndex: Int
    }

    /// One round: pick which twin plays impostor and where it hides.
    static func buildOddRound(
        round: Int,
        pair: (String, String),
        random: () -> Double = { Double.random(in: 0..<1) }
    ) -> OddRound {
        let flip = random() < 0.5
        let base = flip ? pair.1 : pair.0
        let odd = flip ? pair.0 : pair.1
        let size = oddGridSize(round: round)
        let cells = size * size
        let oddIndex = min(Int(random() * Double(cells)), cells - 1)
        return OddRound(base: base, odd: odd, size: size, oddIndex: oddIndex)
    }

    // MARK: Digit Span (working memory)

    static let spanStart = 3

    /// A digit string with no immediate repeats (kinder to read at a glance).
    static func makeSpan(len: Int, random: () -> Double = { Double.random(in: 0..<1) }) -> String {
        var span = ""
        for i in 0..<len {
            var digit = min(Int(random() * 10), 9)
            if i > 0, let prev = span.last, String(prev) == String(digit) {
                digit = (digit + 1 + min(Int(random() * 9), 8)) % 10
            }
            span += String(digit)
        }
        return span
    }

    /// How long the digits stay visible before they vanish.
    static func spanShowSeconds(len: Int) -> Double {
        0.9 + Double(len) * 0.35
    }

    // MARK: Green Light (go / no-go)

    static let goRounds = 24
    static let goShowSeconds = 0.75
    static let goGapSeconds = 0.35

    /// Stimulus plan: ~30% no-go, never more than two no-gos in a row, and
    /// the first two are always go so the run starts in motion.
    static func buildGoSequence(random: () -> Double = { Double.random(in: 0..<1) }) -> [Bool] {
        var seq: [Bool] = []
        for i in 0..<goRounds {
            let twoNoGosBehind = i >= 2 && !seq[i - 1] && !seq[i - 2]
            seq.append(i < 2 || twoNoGosBehind || random() >= 0.3)
        }
        return seq
    }

    // MARK: Night Sky (calm constellation tracing)

    struct Constellation: Equatable {
        let name: String
        let points: [(Double, Double)]

        static func == (lhs: Constellation, rhs: Constellation) -> Bool {
            lhs.name == rhs.name && lhs.points.count == rhs.points.count
        }
    }

    /// Mirrors CONSTELLATIONS in src/lib/games.ts — same names, same points.
    static let constellations: [Constellation] = [
        Constellation(name: "The Kite", points: [
            (0.5, 0.08), (0.26, 0.32), (0.74, 0.34), (0.5, 0.58), (0.42, 0.8), (0.6, 0.92),
        ]),
        Constellation(name: "The Little Cup", points: [
            (0.18, 0.24), (0.36, 0.5), (0.6, 0.56), (0.82, 0.42), (0.74, 0.18), (0.46, 0.14),
        ]),
        Constellation(name: "The River", points: [
            (0.1, 0.85), (0.3, 0.62), (0.44, 0.72), (0.6, 0.45), (0.74, 0.52), (0.88, 0.18),
        ]),
        Constellation(name: "The Door", points: [
            (0.3, 0.85), (0.3, 0.25), (0.52, 0.1), (0.72, 0.25), (0.72, 0.85), (0.52, 0.6),
        ]),
        Constellation(name: "The Fox", points: [
            (0.14, 0.3), (0.34, 0.16), (0.52, 0.32), (0.72, 0.2), (0.86, 0.44), (0.62, 0.62), (0.36, 0.56),
        ]),
    ]

    /// Pick tonight's constellation index from a [0,1) roll.
    static func pickConstellation(random: () -> Double = { Double.random(in: 0..<1) }) -> Int {
        min(Int(random() * Double(constellations.count)), constellations.count - 1)
    }

    // MARK: Letter Soup (unscramble)

    /// Mirrors SOUP_BANK in src/lib/games.ts — curated so no entry shares
    /// its letters with a common anagram.
    static let soupBank: [String] = [
        "cocoa", "honey", "mango", "salad", "chair", "clock", "plant", "music",
        "paint", "cloud", "river", "light", "tulip", "daisy", "koala", "panda",
        "otter", "robin", "finch", "letter", "golden", "pebble", "purple",
        "yellow", "orange", "summer", "winter", "autumn", "spring", "coffee",
        "travel", "basket", "button", "candle", "pillow", "window", "breeze",
        "meadow", "sunset", "waffle", "muffin", "cookie", "puzzle", "rocket",
        "picnic", "ticket",
    ]

    static let soupRounds = 8

    /// Seeded draw of soupRounds distinct words from the bank.
    static func pickSoupWords(random: () -> Double = { Double.random(in: 0..<1) }) -> [String] {
        var idx = Array(soupBank.indices)
        for i in stride(from: idx.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            idx.swapAt(i, j)
        }
        return idx.prefix(soupRounds).map { soupBank[$0] }
    }

    /// Shuffle a word's letters, guaranteed different from the original.
    static func scrambleWord(_ word: String, random: () -> Double = { Double.random(in: 0..<1) }) -> [String] {
        var letters = word.map(String.init)
        for _ in 0..<12 {
            for i in stride(from: letters.count - 1, to: 0, by: -1) {
                let j = min(Int(random() * Double(i + 1)), i)
                letters.swapAt(i, j)
            }
            if letters.joined() != word { return letters }
        }
        // Pathological RNG: rotate by one, which always differs for length ≥ 2.
        let original = word.map(String.init)
        return Array(original.dropFirst()) + [original[0]]
    }

    // MARK: Pattern Tiles (simultaneous spatial recall)

    static let patternGrid = 16
    static let patternStart = 3
    static let patternMax = 9

    /// Draw `count` distinct lit tiles on the 4×4 grid, sorted.
    static func pickPatternTiles(count: Int, random: () -> Double = { Double.random(in: 0..<1) }) -> [Int] {
        var idx = Array(0..<patternGrid)
        for i in stride(from: idx.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            idx.swapAt(i, j)
        }
        return Array(idx.prefix(min(count, patternGrid))).sorted()
    }

    /// How long the pattern stays visible before it hides.
    static func patternShowSeconds(count: Int) -> Double {
        0.9 + Double(count) * 0.25
    }

    // MARK: Word quizzes (Grammar Snap + Spell Check)

    static let quizRounds = 8

    /// Seeded shuffle of the bank with a topic-spread pass (at most
    /// `maxPerTopic` per topic per run), then per-item option shuffle.
    static func pickQuizRounds(
        _ bank: [QuizItem],
        count: Int = quizRounds,
        maxPerTopic: Int = 2,
        random: () -> Double = { Double.random(in: 0..<1) }
    ) -> [QuizItem] {
        var idx = Array(bank.indices)
        for i in stride(from: idx.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            idx.swapAt(i, j)
        }
        let want = min(count, bank.count)
        var taken: [Int] = []
        var perTopic: [String: Int] = [:]
        for i in idx {
            if taken.count >= want { break }
            let topic = bank[i].topic
            if (perTopic[topic] ?? 0) >= maxPerTopic { continue }
            perTopic[topic] = (perTopic[topic] ?? 0) + 1
            taken.append(i)
        }
        for i in idx {
            if taken.count >= want { break }
            if !taken.contains(i) { taken.append(i) }
        }
        return taken.map { i in
            let item = bank[i]
            var options = item.options
            for k in stride(from: options.count - 1, to: 0, by: -1) {
                let j = min(Int(random() * Double(k + 1)), k)
                options.swapAt(k, j)
            }
            return QuizItem(
                topic: item.topic, prompt: item.prompt, options: options,
                answer: item.answer, note: item.note)
        }
    }

    // MARK: Proof It (find the wrong word)

    static let proofRounds = 8

    static func proofWords(_ item: ProofItem) -> [String] {
        item.text.components(separatedBy: " ")
    }

    /// The sentence with the wrong word corrected (or dropped, for doubles —
    /// an empty fix means "this word shouldn't be there").
    static func proofCorrected(_ item: ProofItem) -> String {
        var words = proofWords(item)
        if item.fix.isEmpty {
            words.remove(at: item.errorIndex)
        } else {
            words[item.errorIndex] = item.fix
        }
        return words.joined(separator: " ")
    }

    /// Whether a tapped word index counts as finding the error. Doubled-word
    /// twins are indistinguishable chips, so tapping either one is a find.
    static func isProofHit(_ item: ProofItem, tapped: Int) -> Bool {
        if tapped == item.errorIndex { return true }
        let words = proofWords(item)
        guard tapped >= 0, tapped < words.count else { return false }
        return abs(tapped - item.errorIndex) == 1
            && words[tapped] == words[item.errorIndex]
    }

    /// Seeded shuffle + topic-spread pass, mirroring the web's
    /// pickProofRounds RNG call sequence exactly (no per-item shuffle —
    /// word order is fixed by the sentence).
    static func pickProofRounds(
        _ bank: [ProofItem],
        count: Int = proofRounds,
        maxPerTopic: Int = 2,
        random: () -> Double = { Double.random(in: 0..<1) }
    ) -> [ProofItem] {
        var idx = Array(bank.indices)
        for i in stride(from: idx.count - 1, to: 0, by: -1) {
            let j = min(Int(random() * Double(i + 1)), i)
            idx.swapAt(i, j)
        }
        let want = min(count, bank.count)
        var taken: [Int] = []
        var perTopic: [String: Int] = [:]
        for i in idx {
            if taken.count >= want { break }
            let topic = bank[i].topic
            if (perTopic[topic] ?? 0) >= maxPerTopic { continue }
            perTopic[topic] = (perTopic[topic] ?? 0) + 1
            taken.append(i)
        }
        for i in idx {
            if taken.count >= want { break }
            if !taken.contains(i) { taken.append(i) }
        }
        return taken.map { bank[$0] }
    }

    // MARK: Number Ladder (mental-math chain)

    struct LadderStep: Equatable {
        let op: String
        let result: Int
        let options: [Int]
    }

    struct Ladder: Equatable {
        let start: Int
        let steps: [LadderStep]
    }

    static let ladderSteps = 6

    /// Six-rung mental-math ladder mirroring the web's buildLadder RNG call
    /// sequence exactly (1 start roll + 6 per rung; branches never skip a
    /// consumed roll).
    static func buildLadder(
        random: () -> Double = { Double.random(in: 0..<1) }
    ) -> Ladder {
        let start = 3 + min(Int(random() * 10), 9)
        var value = start
        var steps: [LadderStep] = []
        for _ in 0..<ladderSteps {
            let opRoll = random()
            let amtRoll = random()
            let amt = 2 + min(Int(amtRoll * 8), 7)
            let op: String
            let result: Int
            if opRoll < 0.2 && value * 2 <= 99 && value >= 2 {
                op = "\u{00D7}2"
                result = value * 2
            } else if (opRoll < 0.6 && value + amt <= 99) || value - amt < 0 {
                op = "+\(amt)"
                result = value + amt
            } else {
                op = "\u{2212}\(amt)"
                result = value - amt
            }
            let d1Roll = random()
            let d2Roll = random()
            let d1 = result + 1 + min(Int(d1Roll * 3), 2)
            var d2 = result - (1 + min(Int(d2Roll * 3), 2))
            if d2 < 0 || d2 == result { d2 = d1 + 2 }
            var options = [result, d1, d2]
            for i in stride(from: options.count - 1, to: 0, by: -1) {
                let j = min(Int(random() * Double(i + 1)), i)
                options.swapAt(i, j)
            }
            steps.append(LadderStep(op: op, result: result, options: options))
            value = result
        }
        return Ladder(start: start, steps: steps)
    }
}

// MARK: - Missed-item practice ("your tricky ones") — same semantics as web.

enum QuizMisses {
    static let cap = 40
    private static var store: UserDefaults { UserDefaults(suiteName: "group.me.neima.kairo") ?? .standard }
    private static func key(_ id: String) -> String { "kairo-play-misses-\(id)" }

    static func read(_ id: String) -> [String] {
        store.stringArray(forKey: key(id)) ?? []
    }

    /// Remember a miss (deduped, newest last, capped).
    static func record(_ id: String, prompt: String) {
        var list = read(id).filter { $0 != prompt }
        list.append(prompt)
        store.set(Array(list.suffix(cap)), forKey: key(id))
    }

    /// A correct answer redeems the prompt — it leaves the tricky list.
    static func clear(_ id: String, prompt: String) {
        store.set(read(id).filter { $0 != prompt }, forKey: key(id))
    }

    /// Bank items matching stored missed prompts (oldest miss first).
    static func items(in bank: [QuizItem], misses: [String]) -> [QuizItem] {
        misses.compactMap { prompt in bank.first { $0.prompt == prompt } }
    }
}
