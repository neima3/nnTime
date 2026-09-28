import XCTest

/// Round 95 evidence tour: Arrow Rush plays a full run to its end state and
/// Slide Home is solved (BFS from the on-screen board) to "Home in N moves".
final class KairoRound95ArcadeTour: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func openArcade(theme: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding", "-kairoOfflineFixture", "-kairoThemeFixture", theme]
        if theme == "dark" { app.launchArguments += ["-AppleInterfaceStyle", "Dark"] }
        app.launch()
        app.tabBars.buttons["More"].tap()
        let entry = app.staticTexts["Brain breaks"].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()
        return app
    }

    private func open(_ title: String, in app: XCUIApplication) {
        let card = app.staticTexts[title].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 10 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()
    }

    func testArrowRushPlaysToTheEnd() throws {
        let app = openArcade(theme: "light")
        open("Arrow Rush", in: app)
        XCTAssertTrue(app.buttons["Start the rush"].waitForExistence(timeout: 6))
        snap(app, "r95-arrow-intro")
        app.buttons["Start the rush"].tap()

        let round = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Round ")).firstMatch
        var answered = 0
        while answered < 20 {
            guard round.waitForExistence(timeout: 4) else { break }
            let label = round.label
            if answered == 2 { snap(app, "r95-arrow-play") }
            // One deliberate miss to show the wrong state.
            let left = label.hasSuffix("left.")
            let pickLeft = answered == 6 ? !left : left
            app.buttons[pickLeft ? "Middle points left" : "Middle points right"].tap()
            if answered == 6 { snap(app, "r95-arrow-wrong") }
            answered += 1
        }
        let end = app.staticTexts.matching(NSPredicate(format: "label ENDSWITH %@", "of 20 right")).firstMatch
        XCTAssertTrue(end.waitForExistence(timeout: 8))
        snap(app, "r95-arrow-end")
    }

    func testSlideHomeSolvesToHome() throws {
        let app = openArcade(theme: "dark")
        open("Slide Home", in: app)
        XCTAssertTrue(app.buttons["Scatter the tiles"].waitForExistence(timeout: 6))
        snap(app, "r95-slide-intro")
        app.buttons["Scatter the tiles"].tap()
        let firstTile = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Tile 1")).firstMatch
        XCTAssertTrue(firstTile.waitForExistence(timeout: 6))
        snap(app, "r95-slide-start")

        var frames: [Int: CGRect] = [:]
        for t in 1...8 {
            frames[t] = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Tile \(t)")).firstMatch.frame
        }
        let minX = frames.values.map(\.minX).min()!
        let minY = frames.values.map(\.minY).min()!
        let step = frames[1]!.width + 8
        var board = Array(repeating: 0, count: 9)
        for (t, f) in frames {
            let col = Int(((f.minX - minX) / step).rounded())
            let row = Int(((f.minY - minY) / step).rounded())
            board[row * 3 + col] = t
        }
        let path = solve(board)
        XCTAssertFalse(path.isEmpty)
        for (i, tile) in path.enumerated() {
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Tile \(tile)")).firstMatch.tap()
            if i == path.count / 2 { snap(app, "r95-slide-mid") }
        }
        snap(app, "r95-slide-solved")
        let end = app.staticTexts["Home in \(path.count) moves"]
        XCTAssertTrue(end.waitForExistence(timeout: 6))
        snap(app, "r95-slide-end")
    }

    /// Shortest sequence of tiles to tap (plain BFS over the 9! states).
    private func solve(_ start: [Int]) -> [Int] {
        let goal = [1, 2, 3, 4, 5, 6, 7, 8, 0]
        var prev: [[Int]: ([Int], Int)] = [:]
        var queue = [start]
        var head = 0
        var seen: Set<[Int]> = [start]
        while head < queue.count {
            let b = queue[head]; head += 1
            if b == goal { break }
            let g = b.firstIndex(of: 0)!
            var nbs: [Int] = []
            if g >= 3 { nbs.append(g - 3) }
            if g < 6 { nbs.append(g + 3) }
            if g % 3 > 0 { nbs.append(g - 1) }
            if g % 3 < 2 { nbs.append(g + 1) }
            for t in nbs {
                var n = b
                n[g] = n[t]; n[t] = 0
                if seen.insert(n).inserted {
                    prev[n] = (b, b[t])
                    queue.append(n)
                }
            }
        }
        var path: [Int] = []
        var k = goal
        while let p = prev[k] { path.append(p.1); k = p.0 }
        return path.reversed()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
