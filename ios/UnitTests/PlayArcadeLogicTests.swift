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

    // MARK: Green Light

    func testGoSequenceStartsInMotionAndFillsTheRun() {
        let seq = ArcadeLogic.buildGoSequence()
        XCTAssertEqual(seq.count, ArcadeLogic.goRounds)
        XCTAssertTrue(seq[0])
        XCTAssertTrue(seq[1])
    }

    func testGoSequenceNeverAllowsThreeNoGosInARow() {
        let seq = ArcadeLogic.buildGoSequence(random: { 0 })
        for i in 2..<seq.count {
            XCTAssertTrue(seq[i - 2] || seq[i - 1] || seq[i])
        }
        XCTAssertTrue(seq.contains(false))
    }

    func testGoSequenceIsAllGoAboveTheNoGoBand() {
        XCTAssertTrue(ArcadeLogic.buildGoSequence(random: { 0.9 }).allSatisfy { $0 })
    }

    // MARK: Night Sky

    func testConstellationsMatchTheWebContract() {
        XCTAssertEqual(ArcadeLogic.constellations.count, 5)
        let names = ArcadeLogic.constellations.map(\.name)
        XCTAssertEqual(Set(names).count, names.count, "names are unique")
        for sky in ArcadeLogic.constellations {
            XCTAssertGreaterThanOrEqual(sky.points.count, 5)
            for (x, y) in sky.points {
                XCTAssertTrue((0.0...1.0).contains(x))
                XCTAssertTrue((0.0...1.0).contains(y))
            }
        }
    }

    func testPickConstellationIsDeterministicAndInRange() {
        XCTAssertEqual(ArcadeLogic.pickConstellation(random: { 0 }), 0)
        XCTAssertEqual(
            ArcadeLogic.pickConstellation(random: { 0.999999 }),
            ArcadeLogic.constellations.count - 1)
    }

    func testRecordCountAccumulatesALifetimeTotal() {
        let key = "test-count-\(UUID().uuidString)"
        XCTAssertEqual(PlayScores.recordCount(1, for: key), 1)
        XCTAssertEqual(PlayScores.recordCount(1, for: key), 2)
        XCTAssertEqual(PlayScores.recordCount(3, for: key), 5)
        XCTAssertEqual(PlayScores.best(for: key), 5)
    }

    // MARK: Letter Soup

    func testSoupBankMatchesTheWebShapeAndStaysAnagramSafe() {
        XCTAssertEqual(ArcadeLogic.soupBank.count, 46)
        XCTAssertEqual(Set(ArcadeLogic.soupBank).count, ArcadeLogic.soupBank.count)
        var sortedKeys = Set<String>()
        for word in ArcadeLogic.soupBank {
            XCTAssertTrue((5...6).contains(word.count), word)
            XCTAssertTrue(word.allSatisfy { $0.isLowercase && $0.isLetter }, word)
            let key = String(word.sorted())
            XCTAssertFalse(sortedKeys.contains(key), "anagram pair in bank: \(word)")
            sortedKeys.insert(key)
        }
    }

    func testPickSoupWordsDrawsEightDistinctDeterministically() {
        var calls = 0
        func seeded() -> Double {
            calls += 1
            return Double((calls * 23) % 100) / 100
        }
        let a = ArcadeLogic.pickSoupWords(random: seeded)
        XCTAssertEqual(a.count, ArcadeLogic.soupRounds)
        XCTAssertEqual(Set(a).count, ArcadeLogic.soupRounds)
        calls = 0
        XCTAssertEqual(ArcadeLogic.pickSoupWords(random: seeded), a)
    }

    func testScrambleKeepsLettersButNeverTheOriginalOrder() {
        for word in ArcadeLogic.soupBank {
            let scrambled = ArcadeLogic.scrambleWord(word)
            XCTAssertNotEqual(scrambled.joined(), word)
            XCTAssertEqual(scrambled.sorted(), word.map(String.init).sorted())
        }
        // Identity RNG must fall back to rotation.
        let out = ArcadeLogic.scrambleWord("candle", random: { 0.999999 })
        XCTAssertNotEqual(out.joined(), "candle")
        XCTAssertEqual(out.sorted(), "candle".map(String.init).sorted())
    }

    // MARK: Pattern Tiles

    func testPatternDrawIsDistinctSortedAndInGrid() {
        for count in [3, 5, 9] {
            let tiles = ArcadeLogic.pickPatternTiles(count: count)
            XCTAssertEqual(tiles.count, count)
            XCTAssertEqual(Set(tiles).count, count)
            XCTAssertEqual(tiles, tiles.sorted())
            for t in tiles {
                XCTAssertTrue((0..<ArcadeLogic.patternGrid).contains(t))
            }
        }
        XCTAssertEqual(ArcadeLogic.pickPatternTiles(count: 99).count, ArcadeLogic.patternGrid)
    }

    func testPatternDrawIsDeterministicForASeededRNG() {
        var calls = 0
        func seeded() -> Double {
            calls += 1
            return Double((calls * 31) % 100) / 100
        }
        let a = ArcadeLogic.pickPatternTiles(count: 5, random: seeded)
        calls = 0
        XCTAssertEqual(ArcadeLogic.pickPatternTiles(count: 5, random: seeded), a)
    }

    func testPatternShowTimeScalesWithSize() {
        XCTAssertEqual(ArcadeLogic.patternShowSeconds(count: 3), 1.65, accuracy: 0.001)
        XCTAssertEqual(ArcadeLogic.patternShowSeconds(count: 9), 3.15, accuracy: 0.001)
    }

    // MARK: Proof It (find the wrong word) — mirrors src/lib/games.test.ts

    func testProofBankIntegrity() {
        var seen = Set<String>()
        for item in ProofBank.sentences {
            let words = ArcadeLogic.proofWords(item)
            XCTAssertGreaterThanOrEqual(words.count, 5)
            XCTAssertGreaterThanOrEqual(item.errorIndex, 0)
            XCTAssertLessThan(item.errorIndex, words.count)
            XCTAssertNotEqual(words[item.errorIndex], item.fix)
            if item.fix.isEmpty {
                // Deletion entries are doubled words — the twin sits right before.
                XCTAssertEqual(words[item.errorIndex - 1], words[item.errorIndex])
            }
            XCTAssertFalse(item.note.trimmingCharacters(in: .whitespaces).isEmpty)
            XCTAssertFalse(seen.contains(item.text))
            seen.insert(item.text)
        }
        XCTAssertGreaterThanOrEqual(ProofBank.sentences.count, 44)
    }

    func testProofCorrectedSwapsOnlyTheWrongWord() {
        let item = ProofBank.sentences[0]
        let corrected = ArcadeLogic.proofCorrected(item).components(separatedBy: " ")
        let original = ArcadeLogic.proofWords(item)
        XCTAssertEqual(corrected.count, original.count)
        XCTAssertEqual(corrected[item.errorIndex], item.fix)
    }

    func testProofCorrectedDropsOneTwinForDoubledWords() {
        let doubled = ProofBank.sentences.filter { $0.fix.isEmpty }
        XCTAssertGreaterThanOrEqual(doubled.count, 3)
        for item in doubled {
            let corrected = ArcadeLogic.proofCorrected(item)
            XCTAssertEqual(
                corrected.components(separatedBy: " ").count,
                ArcadeLogic.proofWords(item).count - 1
            )
        }
    }

    func testProofHitAcceptsEitherTwinExactIndexOtherwise() {
        let doubled = ProofBank.sentences.first { $0.fix.isEmpty }!
        XCTAssertTrue(ArcadeLogic.isProofHit(doubled, tapped: doubled.errorIndex))
        XCTAssertTrue(ArcadeLogic.isProofHit(doubled, tapped: doubled.errorIndex - 1))
        XCTAssertFalse(ArcadeLogic.isProofHit(doubled, tapped: doubled.errorIndex + 1))
        let plain = ProofBank.sentences[0]
        XCTAssertTrue(ArcadeLogic.isProofHit(plain, tapped: plain.errorIndex))
        XCTAssertFalse(ArcadeLogic.isProofHit(plain, tapped: plain.errorIndex + 1))
    }

    func testProofPickHonorsTopicSpread() {
        var calls = 0
        let rounds = ArcadeLogic.pickProofRounds(ProofBank.sentences, random: {
            calls += 1
            return (Double(calls) * 0.271).truncatingRemainder(dividingBy: 1)
        })
        XCTAssertEqual(rounds.count, ArcadeLogic.proofRounds)
        var perTopic: [String: Int] = [:]
        for r in rounds { perTopic[r.topic] = (perTopic[r.topic] ?? 0) + 1 }
        for count in perTopic.values { XCTAssertLessThanOrEqual(count, 2) }
        XCTAssertEqual(Set(rounds.map(\.text)).count, ArcadeLogic.proofRounds)
    }

    func testProofSeededDrawMatchesWebPin() {
        // The exact draw pinned by src/lib/games.test.ts "cross-platform
        // seeded pin" — both platforms must produce this list.
        var calls = 0
        let rounds = ArcadeLogic.pickProofRounds(ProofBank.sentences, random: {
            calls += 1
            return (Double(calls) * 0.137).truncatingRemainder(dividingBy: 1)
        })
        XCTAssertEqual(rounds.map(\.text), [
            "I could of finished it with ten more minutes.",
            "Whos turn is it to water the plants?",
            "That was a wierd way to end a meeting.",
            "I think that that plan needs one more step.",
            "Neither of the routes are faster at rush hour.",
            "The dog wagged it's tail at every stranger.",
            "It happend again right after the reset.",
            "The Smiths dog knows everyone on the street.",
        ])
    }

    // MARK: Number Ladder — mirrors src/lib/games.test.ts

    private func ladderSeed(_ mult: Double) -> () -> Double {
        var calls = 0
        return {
            calls += 1
            return (Double(calls) * mult).truncatingRemainder(dividingBy: 1)
        }
    }

    func testLadderChainAndBoundsHold() {
        for mult in [0.137, 0.271, 0.319, 0.457, 0.611, 0.733] {
            let ladder = ArcadeLogic.buildLadder(random: ladderSeed(mult))
            XCTAssertEqual(ladder.steps.count, ArcadeLogic.ladderSteps)
            XCTAssertGreaterThanOrEqual(ladder.start, 3)
            XCTAssertLessThanOrEqual(ladder.start, 12)
            var value = ladder.start
            for step in ladder.steps {
                XCTAssertGreaterThanOrEqual(step.result, 0)
                XCTAssertLessThanOrEqual(step.result, 99)
                XCTAssertEqual(step.options.count, 3)
                XCTAssertTrue(step.options.contains(step.result))
                XCTAssertEqual(Set(step.options).count, 3)
                for opt in step.options { XCTAssertGreaterThanOrEqual(opt, 0) }
                if step.op == "\u{00D7}2" {
                    XCTAssertEqual(step.result, value * 2)
                } else if step.op.hasPrefix("+") {
                    XCTAssertEqual(step.result, value + Int(step.op.dropFirst())!)
                } else {
                    XCTAssertEqual(step.result, value - Int(step.op.dropFirst())!)
                }
                value = step.result
            }
        }
    }

    func testLadderIsDeterministicForASeededRNG() {
        let a = ArcadeLogic.buildLadder(random: ladderSeed(0.271))
        XCTAssertEqual(ArcadeLogic.buildLadder(random: ladderSeed(0.271)), a)
    }

    func testLadderSeededDrawMatchesWebPin() {
        // The exact ladder pinned by src/lib/games.test.ts — both platforms
        // must produce it for the same seeded RNG.
        let ladder = ArcadeLogic.buildLadder(random: ladderSeed(0.137))
        XCTAssertEqual(ladder.start, 4)
        XCTAssertEqual(ladder.steps.map(\.op), [
            "+5", "\u{00D7}2", "\u{2212}2", "\u{2212}9", "+7", "+6",
        ])
        XCTAssertEqual(ladder.steps.map(\.result), [9, 18, 16, 7, 14, 20])
        XCTAssertEqual(ladder.steps.map(\.options), [
            [9, 11, 6], [18, 16, 20], [16, 15, 17], [8, 6, 7], [17, 11, 14], [22, 20, 17],
        ])
    }

    // MARK: Daily Three — mirrors src/lib/games.test.ts

    func testDailyThreeMoodPoolsCoverAllSeventeenGamesOnce() {
        let all = ArcadeLogic.moodGames.flatMap { $0 }
        XCTAssertEqual(all.count, 18)
        XCTAssertEqual(Set(all).count, all.count)
    }

    func testDailyThreePicksThreeDistinctMoodsDeterministically() {
        var moodOf: [String: Int] = [:]
        for (i, pool) in ArcadeLogic.moodGames.enumerated() {
            for g in pool { moodOf[g] = i }
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        var date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 1))!
        for _ in 0..<60 {
            let key = ArcadeLogic.dailyThreeKey(now: date, zone: calendar.timeZone)
            let picks = ArcadeLogic.dailyThree(dateKey: key)
            XCTAssertEqual(picks.count, 3)
            XCTAssertEqual(Set(picks).count, 3)
            XCTAssertEqual(Set(picks.map { moodOf[$0]! }).count, 3)
            XCTAssertEqual(ArcadeLogic.dailyThree(dateKey: key), picks)
            date = calendar.date(byAdding: .day, value: 1, to: date)!
        }
    }

    func testDailyThreeSeededPinMatchesWeb() {
        // Pinned by src/lib/games.test.ts — both platforms must agree.
        XCTAssertEqual(ArcadeLogic.dailyThree(dateKey: "2026-08-03"), [
            "pattern-tiles", "spell-check", "time-feel",
        ])
        XCTAssertEqual(ArcadeLogic.dailyThree(dateKey: "2026-08-04"), [
            "color-clash", "spell-check", "time-feel",
        ])
    }

    // MARK: In Order — mirrors src/lib/games.test.ts

    private func orderSeed(_ mult: Double) -> () -> Double {
        var calls = 0
        return {
            calls += 1
            return (Double(calls) * mult).truncatingRemainder(dividingBy: 1)
        }
    }

    func testOrderBankIntegrity() {
        var titles = Set<String>()
        for item in OrderBank.sequences {
            XCTAssertGreaterThanOrEqual(item.steps.count, 4)
            XCTAssertLessThanOrEqual(item.steps.count, 5)
            XCTAssertEqual(Set(item.steps).count, item.steps.count)
            XCTAssertFalse(titles.contains(item.title))
            titles.insert(item.title)
        }
        XCTAssertGreaterThanOrEqual(OrderBank.sequences.count, 40)
    }

    func testScrambleIsAPermutationAndNeverIdentity() {
        for mult in [0.137, 0.271, 0.319, 0.457, 0.611, 0.733, 0.999] {
            for count in [4, 5] {
                let order = ArcadeLogic.scrambleOrder(count: count, random: orderSeed(mult))
                XCTAssertEqual(order.sorted(), Array(0..<count))
                XCTAssertNotEqual(order, Array(0..<count))
            }
        }
    }

    func testOrderPickSpreadsTopicsDeterministically() {
        let rounds = ArcadeLogic.pickOrderRounds(OrderBank.sequences, random: orderSeed(0.271))
        XCTAssertEqual(rounds.count, ArcadeLogic.orderRounds)
        XCTAssertEqual(Set(rounds.map(\.topic)).count, ArcadeLogic.orderRounds)
        XCTAssertEqual(ArcadeLogic.pickOrderRounds(OrderBank.sequences, random: orderSeed(0.271)), rounds)
    }

    func testOrderSeededPinsMatchWeb() {
        // Pinned by src/lib/games.test.ts — both platforms must agree.
        XCTAssertEqual(
            ArcadeLogic.pickOrderRounds(OrderBank.sequences, random: orderSeed(0.137)).map(\.title),
            ["Packing a lunch", "Changing a bulb", "Ironing a shirt", "Renting a bike", "A bath"]
        )
        XCTAssertEqual(
            ArcadeLogic.scrambleOrder(count: 5, random: orderSeed(0.137)),
            [4, 2, 3, 1, 0]
        )
    }
}
