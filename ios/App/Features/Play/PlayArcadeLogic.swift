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
