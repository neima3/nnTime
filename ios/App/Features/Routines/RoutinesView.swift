import SwiftUI

// MARK: - Routines: your rituals, one gentle step at a time.
// List of saved routines (built on the web) + a native step-player so a
// morning/evening ritual can run entirely on the phone, hands-free.

struct RoutinesView: View {
    @State private var routines: [Routine] = []
    @State private var loading = true
    @State private var playing: Routine?

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if loading {
                ProgressView().tint(.kIris)
            } else if routines.isEmpty {
                emptyState
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        Text("Tap a routine to run it step by step — Kairo keeps time so you don't have to.")
                            .font(.kBody(13)).foregroundStyle(Color.kInkSoft)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.bottom, 2)
                        ForEach(routines) { r in
                            Button { playing = r } label: { card(r) }
                                .buttonStyle(.plain)
                                .disabled(r.orderedSteps.isEmpty)
                        }
                    }
                    .padding(20)
                }
                .refreshable { await load() }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Routines").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
            }
        }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .task { await load() }
        .fullScreenCover(item: $playing) { r in
            RoutinePlayerView(routine: r)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("🧭").font(.system(size: 44))
            Text("No routines yet").font(.kDisplay(20)).foregroundStyle(Color.kInk)
            Text("Build a morning or wind-down ritual on the web, and it'll be here to run — timed, one step at a time.")
                .font(.kBody(13.5)).foregroundStyle(Color.kInkSoft)
                .multilineTextAlignment(.center)
            Link(destination: URL(string: "https://time.neima.me/app/routines")!) {
                Text("Create one on the web →")
                    .font(.kBody(13.5, weight: .bold)).foregroundStyle(Color.kIris)
            }
            .padding(.top, 4)
        }
        .padding(32)
    }

    private func card(_ r: Routine) -> some View {
        let steps = r.orderedSteps
        return HStack(spacing: 14) {
            Text(r.emoji ?? "🔁").font(.system(size: 26))
                .frame(width: 52, height: 52)
                .background(RoundedRectangle(cornerRadius: 15).fill(Color.kIrisGhost))
            VStack(alignment: .leading, spacing: 3) {
                Text(r.title).font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(r.stepCount) step\(r.stepCount == 1 ? "" : "s")")
                    if r.totalMin > 0 {
                        Text("·"); Text(KTime.duration(r.totalMin))
                    }
                    if r.schedules.contains(where: { !$0.paused && $0.rrule != nil }) {
                        Text("·"); Label("scheduled", systemImage: "calendar")
                            .labelStyle(.titleAndIcon)
                    }
                }
                .font(.kBody(12)).foregroundStyle(Color.kInkSoft)
            }
            Spacer(minLength: 4)
            if steps.isEmpty {
                Text("empty").font(.kBody(11)).foregroundStyle(Color.kInkFaint)
            } else {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 26)).foregroundStyle(Color.kIris)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kCard(radius: 20)
        .opacity(steps.isEmpty ? 0.6 : 1)
    }

    private func load() async {
        routines = (try? await KairoAPI.shared.routines()) ?? []
        loading = false
    }
}
