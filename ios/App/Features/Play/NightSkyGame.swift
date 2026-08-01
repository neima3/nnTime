import SwiftUI

// MARK: Night Sky — trace a small constellation, star by star, in order.
// No timer, no score, no failure: a wind-down. The counter only remembers
// how many skies have ever been traced.

struct NightSkyGame: View {
    let onExit: () -> Void

    @State private var stage = 0  // 0 intro, 1 tracing, 2 done
    @State private var skyIndex = 0
    @State private var lit = 0
    @State private var traced: Int?

    private var sky: ArcadeLogic.Constellation { ArcadeLogic.constellations[skyIndex] }

    var body: some View {
        GameChrome(title: "Night Sky", subtitle: "Connect the stars. Nothing is timed.", onExit: onExit) {
            VStack(spacing: 18) {
                if stage == 0 {
                    Text("A small constellation is waiting. Tap its stars in order and watch the lines appear. No clock, no score — just a quieter sky.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 36)
                    Button("Look up") { start() }.buttonStyle(PrimaryPill())
                } else if stage == 1 {
                    Text("\(sky.name) · \(lit) of \(sky.points.count) stars")
                        .font(.kBody(13, weight: .bold)).foregroundStyle(Color.kInkSoft)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.kSurfaceSunken))
                    canvas
                } else {
                    Text("🌌").font(.system(size: 40))
                    Text("\(sky.name), complete")
                        .font(.kDisplay(28)).foregroundStyle(Color.kInk)
                    Text("The sky doesn't hurry, and it always gets there. Neither do you, and neither will you.")
                        .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                        .multilineTextAlignment(.center).padding(.horizontal, 30)
                    HStack(spacing: 10) {
                        Button("Another sky") { start() }.buttonStyle(SecondaryPill())
                        Button("Back to my day") { onExit() }.buttonStyle(PrimaryPill())
                    }
                }
            }
        }
        .onAppear { traced = PlayScores.best(for: "nightsky") }
    }

    private var canvas: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                Path { path in
                    guard lit > 1 else { return }
                    let visible = Array(sky.points.prefix(lit))
                    path.move(to: CGPoint(x: visible[0].0 * w, y: visible[0].1 * h))
                    for point in visible.dropFirst() {
                        path.addLine(to: CGPoint(x: point.0 * w, y: point.1 * h))
                    }
                }
                .stroke(Color.kIris.opacity(0.7), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

                ForEach(Array(sky.points.enumerated()), id: \.offset) { idx, point in
                    let isLit = idx < lit
                    let isNext = idx == lit
                    Button { tap(idx) } label: {
                        Circle()
                            .fill(isLit ? Color.kCatButter : isNext ? Color.kIris : Color.kInkFaint.opacity(0.6))
                            .frame(width: isLit ? 14 : isNext ? 12 : 8,
                                   height: isLit ? 14 : isNext ? 12 : 8)
                            .frame(width: 44, height: 44)
                            .contentShape(Circle())
                    }
                    .position(x: point.0 * w, y: point.1 * h)
                    .accessibilityLabel("Star \(idx + 1)\(isLit ? ", lit" : isNext ? ", next" : "")")
                }
            }
        }
        .frame(width: 320, height: 360)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.kSurfaceSunken))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color.kBorder, lineWidth: 1))
        .kCardShadow()
    }

    private func start() {
        skyIndex = ArcadeLogic.pickConstellation()
        lit = 0
        stage = 1
    }

    private func tap(_ idx: Int) {
        guard stage == 1, idx == lit else { return }
        lit += 1
        if lit >= sky.points.count {
            traced = PlayScores.recordCount(1, for: "nightsky")
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { stage = 2 }
        }
    }
}
