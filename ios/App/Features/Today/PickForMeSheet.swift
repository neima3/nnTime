import SwiftUI

// MARK: - Pick for me: one thing, chosen for you. Starting stops being a decision.

struct PickForMeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let blocks: [DayBlock]
    let nowMin: Int

    @State private var index = 0

    // now → next → slipped → any, not-done
    private var ordered: [DayBlock] {
        let live = blocks.filter { !$0.done }
        func rank(_ b: DayBlock) -> Int {
            if b.startMin <= nowMin && nowMin < b.endMin { return 0 }
            if b.startMin > nowMin { return 1 }
            return 2
        }
        return live.sorted { rank($0) != rank($1) ? rank($0) < rank($1) : $0.startMin < $1.startMin }
    }

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if ordered.isEmpty {
                VStack(spacing: 10) {
                    Text("🌤").font(.system(size: 44))
                    Text("Nothing left to pick").font(.kDisplay(20)).foregroundStyle(Color.kInk)
                    Text("The space is yours. Rest counts too.").font(.kBody(14)).foregroundStyle(Color.kInkSoft)
                    Button("Close") { dismiss() }.font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kIris).padding(.top, 6)
                }
            } else {
                let pick = ordered[index % ordered.count]
                VStack(spacing: 0) {
                    Text("JUST THIS — NOTHING ELSE")
                        .font(.kBody(11, weight: .bold)).kerning(1.3).foregroundStyle(Color.kIris)
                        .padding(.top, 40)
                    Text(pick.emoji).font(.system(size: 64)).padding(.top, 24)
                    Text(pick.title).font(.kDisplay(28)).foregroundStyle(Color.kInk)
                        .multilineTextAlignment(.center).padding(.horizontal, 24).padding(.top, 12)
                    Text(kindLine(pick)).font(.kBody(14)).foregroundStyle(Color.kInkSoft).padding(.top, 6)
                    Spacer()
                    VStack(spacing: 10) {
                        Button {
                            NotificationCenter.default.post(name: .kairoStartFocus, object: nil,
                                userInfo: ["title": pick.title, "emoji": pick.emoji, "duration": min(60, pick.durationMin)])
                            dismiss()
                        } label: {
                            Label("Start \(min(60, pick.durationMin)) min on this", systemImage: "play.fill")
                                .font(.kBody(16, weight: .semibold)).foregroundStyle(Color.kInkInverse)
                                .frame(maxWidth: .infinity).padding(.vertical, 15)
                                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.kIris))
                        }
                        .kFloatShadow()
                        if ordered.count > 1 {
                            Button {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { index += 1 }
                                UISelectionFeedbackGenerator().selectionChanged()
                            } label: {
                                Label("Something else", systemImage: "dice")
                                    .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.kSurface)
                                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.kBorder, lineWidth: 1)))
                            }
                        }
                        Button("Not now") { dismiss() }
                            .font(.kBody(13, weight: .semibold)).foregroundStyle(Color.kInkFaint).padding(.vertical, 6)
                    }
                    .padding(.horizontal, 24).padding(.bottom, 24)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func kindLine(_ b: DayBlock) -> String {
        if b.startMin <= nowMin && nowMin < b.endMin { return "It's on your timeline right now" }
        if b.startMin > nowMin { return "It's coming up next" }
        return "It slipped earlier — still worth a shot"
    }
}
