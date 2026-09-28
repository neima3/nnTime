import Foundation

// MARK: - Arrow Rush + Slide Home — bit-exact mirrors of src/lib/games.ts.
// Random draws are consumed in the same order as the web so seeded runs
// match (pinned on both sides).

extension ArcadeLogic {
    // MARK: Arrow Rush (flanker)

    static let arrowRounds = 20
    static let arrowLimitSeconds = 1.8
    static let arrowGapSeconds = 0.38

    enum ArrowDir: String { case left, right }

    struct ArrowRound: Equatable {
        let dir: ArrowDir
        let congruent: Bool
    }

    struct ArrowResult: Equatable {
        let congruent: Bool
        let correct: Bool
        /// Response time in ms, or nil when the window ran out.
        let ms: Int?
    }

    static func arrowRun(random: () -> Double = { Double.random(in: 0..<1) }) -> [ArrowRound] {
        var rounds: [ArrowRound] = []
        for i in 0..<arrowRounds {
            rounds.append(ArrowRound(dir: random() < 0.5 ? .left : .right, congruent: i % 2 == 0))
        }
        var i = rounds.count - 1
        while i > 0 {
            let j = Int(random() * Double(i + 1))
            rounds.swapAt(i, j)
            i -= 1
        }
        return rounds
    }

    static func arrowRow(_ round: ArrowRound) -> [ArrowDir] {
        let decoy: ArrowDir = round.congruent ? round.dir : (round.dir == .left ? .right : .left)
        return [decoy, decoy, round.dir, decoy, decoy]
    }

    private static func roundHalfUp(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    static func arrowSummary(_ results: [ArrowResult]) -> (correct: Int, avgMs: Int?, decoyCostMs: Int?) {
        let timed = results.filter { $0.correct && $0.ms != nil }
        func mean(_ xs: [Int]) -> Double? { xs.isEmpty ? nil : Double(xs.reduce(0, +)) / Double(xs.count) }
        let all = mean(timed.compactMap(\.ms))
        let easy = mean(timed.filter(\.congruent).compactMap(\.ms))
        let hard = mean(timed.filter { !$0.congruent }.compactMap(\.ms))
        return (
            results.filter(\.correct).count,
            all.map(roundHalfUp),
            (easy != nil && hard != nil) ? roundHalfUp(hard! - easy!) : nil
        )
    }

    // MARK: Slide Home (3×3 sliding puzzle)

    static let slideSide = 3
    static let slideShuffleMoves = 20
    static let slideParMin = 12
    static let slideParMax = 20

    static func slideSolved() -> [Int] { [1, 2, 3, 4, 5, 6, 7, 8, 0] }

    static func isSlideSolved(_ board: [Int]) -> Bool {
        board.enumerated().allSatisfy { i, v in v == (i == board.count - 1 ? 0 : i + 1) }
    }

    /// Up, down, left, right — the same fixed order as the web.
    static func slideNeighbors(_ idx: Int) -> [Int] {
        let n = slideSide
        let row = idx / n, col = idx % n
        var out: [Int] = []
        if row > 0 { out.append(idx - n) }
        if row < n - 1 { out.append(idx + n) }
        if col > 0 { out.append(idx - 1) }
        if col < n - 1 { out.append(idx + 1) }
        return out
    }

    static func slideTap(_ board: [Int], _ idx: Int) -> [Int]? {
        guard let gap = board.firstIndex(of: 0), idx != gap, slideNeighbors(gap).contains(idx) else { return nil }
        var next = board
        next[gap] = board[idx]
        next[idx] = 0
        return next
    }

    static func shuffleSlide(
        random: () -> Double = { Double.random(in: 0..<1) },
        moves: Int = slideShuffleMoves
    ) -> [Int] {
        var board = slideSolved()
        var gap = board.count - 1
        var prev = -1
        func step(_ to: Int) {
            board[gap] = board[to]
            board[to] = 0
            prev = gap
            gap = to
        }
        for _ in 0..<moves {
            let options = slideNeighbors(gap).filter { $0 != prev }
            step(options[Int(random() * Double(options.count))])
        }
        if isSlideSolved(board) { step(slideNeighbors(gap)[0]) }
        return board
    }

    private static func slideManhattan(_ board: [Int]) -> Int {
        let n = slideSide
        var d = 0
        for (i, v) in board.enumerated() where v != 0 {
            let home = v - 1
            d += abs(i / n - home / n) + abs(i % n - home % n)
        }
        return d
    }

    /// Fewest moves home (IDA* on Manhattan distance).
    static func slideShortest(_ start: [Int]) -> Int {
        var board = start
        var gap = board.firstIndex(of: 0) ?? 0
        var bound = slideManhattan(board)
        var found = 0
        func search(_ g: Int, _ prev: Int) -> Int {
            let h = slideManhattan(board)
            let f = g + h
            if f > bound { return f }
            if h == 0 { found = g; return -1 }
            var minimum = Int.max
            for to in slideNeighbors(gap) where to != prev {
                let from = gap
                board[from] = board[to]
                board[to] = 0
                gap = to
                let t = search(g + 1, from)
                board[to] = board[from]
                board[from] = 0
                gap = from
                if t == -1 { return -1 }
                minimum = min(minimum, t)
            }
            return minimum
        }
        while true {
            let t = search(0, -1)
            if t == -1 { return found }
            bound = t
        }
    }

    static func buildSlideBoard(random: () -> Double = { Double.random(in: 0..<1) }) -> (board: [Int], par: Int) {
        var board = shuffleSlide(random: random)
        var par = slideShortest(board)
        var tries = 1
        while tries < 20, !(par >= slideParMin && par <= slideParMax) {
            board = shuffleSlide(random: random)
            par = slideShortest(board)
            tries += 1
        }
        return (board, par)
    }
}

// MARK: - Played today (mirror of web playedOn / recordPlay)

enum PlayLog {
    private static var store: UserDefaults { UserDefaults(suiteName: "group.me.neima.kairo") ?? .standard }
    private static let key = "kairo-play-log"

    /// Native score keys → web game ids (the ids the Daily Three speaks).
    static let webIdForScoreKey: [String: String] = [
        "timefeel": "time-feel", "quicktap": "quick-tap", "emojimatch": "emoji-match",
        "grammarsnap": "grammar-snap", "spellcheck": "spell-check", "focusfinder": "number-hunt",
        "memorytrail": "memory-trail", "colorclash": "color-clash", "oddoneout": "odd-one-out",
        "digitspan": "digit-span", "greenlight": "green-light", "nightsky": "night-sky",
        "lettersoup": "letter-soup", "patterntiles": "pattern-tiles", "proofit": "proof-it",
        "numberladder": "number-ladder", "inorder": "in-order", "arrowrush": "arrow-rush",
        "slidehome": "slide-home", "steadybreath": "steady-breath",
    ]

    private struct Entry: Codable { let date: String; let ids: [String] }

    static func played(on dateKey: String = ArcadeLogic.dailyThreeKey()) -> Set<String> {
        guard let data = store.data(forKey: key),
              let entry = try? JSONDecoder().decode(Entry.self, from: data),
              entry.date == dateKey
        else { return [] }
        return Set(entry.ids)
    }

    static func record(webId: String, on dateKey: String = ArcadeLogic.dailyThreeKey()) {
        var ids = played(on: dateKey)
        ids.insert(webId)
        if let data = try? JSONEncoder().encode(Entry(date: dateKey, ids: ids.sorted())) {
            store.set(data, forKey: key)
        }
    }

    static func record(scoreKey: String) {
        guard let id = webIdForScoreKey[scoreKey] else { return }
        record(webId: id)
    }
}
