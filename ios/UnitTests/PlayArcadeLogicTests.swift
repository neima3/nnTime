import XCTest
@testable import Kairo

/// Pins the arcade's pure logic to the web contract (src/lib/games.ts +
/// games.test.ts): same grids, trails, Stroop rounds, quiz picking, and
/// miss-memory semantics. If the web logic changes, these fail on purpose.
final class PlayArcadeLogicTests: XCTestCase {

    // MARK: Focus Finder

    func testSchulteGridContainsEveryNumberOnce() {
        let grid = ArcadeLogic.buildSchulteGrid()
        XCTAssertEqual(grid.sorted(), Array(1...ArcadeLogic.schulteSize))
    }

    func testSchulteGridShufflesDeterministicallyFromSeededRNG() {
        var calls = 0
        func seeded() -> Double {
            calls += 1
            return Double((calls * 37) % 100) / 100
        }
        let a = ArcadeLogic.buildSchulteGrid(random: seeded)
        calls = 0
        let b = ArcadeLogic.buildSchulteGrid(random: seeded)
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, ArcadeLogic.buildSchulteGrid(random: { 0 }))
    }

    func testSchulteTenthsRoundsAndFloors() {
        XCTAssertEqual(ArcadeLogic.schulteTenths(elapsedMs: 43_240), 432)
        XCTAssertEqual(ArcadeLogic.schulteTenths(elapsedMs: 43_260), 433)
        XCTAssertEqual(ArcadeLogic.schulteTenths(elapsedMs: 0), 1)
        XCTAssertEqual(ArcadeLogic.schulteTenths(elapsedMs: 20), 1)
    }

    // MARK: Memory Trail

    func testBuildTrailStartsAtThreeTilesInRange() {
        let trail = ArcadeLogic.buildTrail()
        XCTAssertEqual(trail.count, ArcadeLogic.trailStartLength)
        for tile in trail {
            XCTAssertTrue((0..<ArcadeLogic.trailTiles).contains(tile))
        }
    }

    func testExtendTrailNeverRepeatsTheSameTileTwiceInARow() {
        var trail = [4]
        // A roll that always collides with tile 4 must still avoid repeats.
        let collide = { 4.0 / Double(ArcadeLogic.trailTiles) + 0.001 }
        for _ in 0..<50 {
            trail = ArcadeLogic.extendTrail(trail, random: collide)
            XCTAssertNotEqual(trail[trail.count - 1], trail[trail.count - 2])
        }
    }

    func testExtendTrailAppendsWithoutMutatingInput() {
        let start = [1, 2, 3]
        let next = ArcadeLogic.extendTrail(start, random: { 0.9 })
        XCTAssertEqual(start, [1, 2, 3])
        XCTAssertEqual(next.count, 4)
        XCTAssertEqual(Array(next.prefix(3)), start)
    }

    // MARK: Color Clash

    func testClashRoundIndexesStayInRange() {
        for _ in 0..<100 {
            let round = ArcadeLogic.buildClashRound()
            XCTAssertTrue((0..<ArcadeLogic.clashColorNames.count).contains(round.word))
            XCTAssertTrue((0..<ArcadeLogic.clashColorNames.count).contains(round.ink))
        }
    }

    func testClashRoundIsCongruentWhenCongruenceRollIsLow() {
        var rolls = [0.5, 0.1]
        let round = ArcadeLogic.buildClashRound(random: { rolls.removeFirst() })
        XCTAssertEqual(round.word, 2)
        XCTAssertEqual(round.ink, 2)
    }

    func testClashRoundIncongruentNeverMapsInkOntoWord() {
        for shift in 0..<30 {
            var rolls = [0.5, 0.9, Double(shift % 3) / 3]
            let round = ArcadeLogic.buildClashRound(random: { rolls.removeFirst() })
            XCTAssertNotEqual(round.ink, round.word)
        }
    }

    // MARK: Emoji Match

    func testMatchDeckHasEightPairs() {
        let deck = ArcadeLogic.buildMatchDeck()
        XCTAssertEqual(deck.count, 16)
        let counts = Dictionary(grouping: deck, by: { $0 }).mapValues(\.count)
        XCTAssertEqual(counts.count, 8)
        XCTAssertTrue(counts.values.allSatisfy { $0 == 2 })
    }

    // MARK: Quiz picking

    func testPickQuizRoundsReturnsEightSpreadRounds() {
        let rounds = ArcadeLogic.pickQuizRounds(QuizBank.grammar)
        XCTAssertEqual(rounds.count, ArcadeLogic.quizRounds)
        var perTopic: [String: Int] = [:]
        for item in rounds {
            perTopic[item.topic, default: 0] += 1
            XCTAssertTrue(item.options.contains(item.answer))
        }
        // Grammar has 9+ topics, so the default cap of 2 must hold.
        XCTAssertTrue(perTopic.values.allSatisfy { $0 <= 2 })
    }

    func testPickQuizRoundsShufflesOptionsButPreservesTheirContents() {
        let rounds = ArcadeLogic.pickQuizRounds(QuizBank.grammar)
        for item in rounds {
            let original = QuizBank.grammar.first { $0.prompt == item.prompt }
            XCTAssertNotNil(original)
            XCTAssertEqual(item.options.sorted(), original!.options.sorted())
        }
    }

    func testPickQuizRoundsFillsFromASingleTopicPoolDespiteTheCap() {
        // Spelling is one topic; the second pass must still fill all 8.
        let rounds = ArcadeLogic.pickQuizRounds(QuizBank.spelling)
        XCTAssertEqual(rounds.count, ArcadeLogic.quizRounds)
    }

    func testPickQuizRoundsWithSmallPoolReturnsWholePool() {
        let pool = Array(QuizBank.grammar.prefix(3))
        let rounds = ArcadeLogic.pickQuizRounds(pool, maxPerTopic: 99)
        XCTAssertEqual(rounds.count, 3)
    }

    // MARK: Quiz banks

    func testQuizBanksMatchTheWebCounts() {
        XCTAssertEqual(QuizBank.grammar.count, 66)
        XCTAssertEqual(QuizBank.spelling.count, 16)
    }

    func testEveryBankItemIsAnswerableAndLabeled() {
        for item in QuizBank.grammar + QuizBank.spelling {
            XCTAssertTrue(item.options.contains(item.answer), item.prompt)
            XCTAssertNotNil(QuizBank.topicLabels[item.topic], item.topic)
        }
    }

    // MARK: Miss memory

    func testMissesRecordDedupeRedeemAndCap() {
        let id = "test-arcade-\(UUID().uuidString)"
        defer {
            for prompt in QuizMisses.read(id) { QuizMisses.clear(id, prompt: prompt) }
        }
        XCTAssertEqual(QuizMisses.read(id), [])
        QuizMisses.record(id, prompt: "A")
        QuizMisses.record(id, prompt: "B")
        QuizMisses.record(id, prompt: "A")
        XCTAssertEqual(QuizMisses.read(id), ["B", "A"], "re-missing moves the prompt to newest")
        QuizMisses.clear(id, prompt: "B")
        XCTAssertEqual(QuizMisses.read(id), ["A"])
        for i in 0..<50 { QuizMisses.record(id, prompt: "P\(i)") }
        XCTAssertEqual(QuizMisses.read(id).count, QuizMisses.cap)
        XCTAssertEqual(QuizMisses.read(id).last, "P49")
    }

    func testMissedItemsMapBackToBankInStoredOrderSkippingUnknowns() {
        let bank = QuizBank.grammar
        let items = QuizMisses.items(in: bank, misses: [bank[5].prompt, "not-a-real-prompt", bank[0].prompt])
        XCTAssertEqual(items.map(\.prompt), [bank[5].prompt, bank[0].prompt])
    }

    // MARK: Odd One Out

    func testOddPairsShuffleKeepsEveryPair() {
        var calls = 0
        func seeded() -> Double {
            calls += 1
            return Double((calls * 31) % 100) / 100
        }
        let shuffled = ArcadeLogic.shuffledOddPairs(random: seeded)
        XCTAssertEqual(shuffled.count, ArcadeLogic.oddPairs.count)
        XCTAssertEqual(Set(shuffled.map(\.0)), Set(ArcadeLogic.oddPairs.map(\.0)))
    }

    func testOddGridGrowsAcrossRounds() {
        XCTAssertEqual([0, 1, 2].map { ArcadeLogic.oddGridSize(round: $0) }, [3, 3, 3])
        XCTAssertEqual([3, 4, 5].map { ArcadeLogic.oddGridSize(round: $0) }, [4, 4, 4])
        XCTAssertEqual([6, 7].map { ArcadeLogic.oddGridSize(round: $0) }, [5, 5])
    }

    func testOddRoundImpostorDiffersAndFitsGrid() {
        for round in 0..<ArcadeLogic.oddRounds {
            let r = ArcadeLogic.buildOddRound(round: round, pair: ArcadeLogic.oddPairs[0])
            XCTAssertNotEqual(r.base, r.odd)
            XCTAssertEqual(r.size, ArcadeLogic.oddGridSize(round: round))
            XCTAssertTrue((0..<(r.size * r.size)).contains(r.oddIndex))
        }
    }

    // MARK: Digit Span

    func testMakeSpanLengthAndDigitsOnly() {
        let span = ArcadeLogic.makeSpan(len: 7)
        XCTAssertEqual(span.count, 7)
        XCTAssertTrue(span.allSatisfy(\.isNumber))
    }

    func testMakeSpanNeverRepeatsImmediately() {
        let same = { 0.45 }
        let span = Array(ArcadeLogic.makeSpan(len: 20, random: same))
        for i in 1..<span.count {
            XCTAssertNotEqual(span[i], span[i - 1])
        }
    }

    func testSpanShowSecondsScalesWithLength() {
        XCTAssertEqual(ArcadeLogic.spanShowSeconds(len: 3), 1.95, accuracy: 0.001)
        XCTAssertEqual(ArcadeLogic.spanShowSeconds(len: 8), 3.7, accuracy: 0.001)
    }
}
