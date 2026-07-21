import SwiftUI

// MARK: - Insights: gentle numbers — they describe, they don't judge.

struct StatsView: View {
    @Environment(AppState.self) private var app
    @State private var stats: StatsResponse?
    @State private var loading = true

    var body: some View {
        ZStack {
            Color.kCanvas.ignoresSafeArea()
            if loading {
                ProgressView().tint(.kIris)
            } else if let stats {
                ScrollView {
                    VStack(spacing: 14) {
                        weekCard(stats)
                        HStack(spacing: 14) {
                            streakCard(stats)
                            totalsCard(stats)
                        }
                        if let hours = stats.focusHours { focusHoursCard(hours) }
                        if let est = stats.estimate { timeTruthCard(est) }
                    }
                    .padding(20)
                }
                .refreshable { await load() }
            } else {
                Text("Sign in to see your gentle mirror.")
                    .font(.kBody(14)).foregroundStyle(Color.kInkSoft)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Insights").font(.kDisplay(18, relativeTo: .headline)).foregroundStyle(Color.kInk)
            }
        }
        .toolbarBackground(Color.kCanvas, for: .navigationBar)
        .task { await load() }
    }

    private func weekCard(_ s: StatsResponse) -> some View {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = app.timezone
        let today = Date()
        let days: [(label: String, count: Int)] = (0..<7).reversed().map { off in
            let d = cal.date(byAdding: .day, value: -off, to: today) ?? today
            let key = KTime.dateString(d, zone: app.timezone)
            let df = DateFormatter(); df.dateFormat = "EEEEE"; df.timeZone = app.timezone
            return (df.string(from: d), s.byDate[key]?.completed ?? 0)
        }
        let maxC = max(1, days.map(\.count).max() ?? 1)
        return VStack(alignment: .leading, spacing: 4) {
            Text("This week").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
            Text("Completions — no judgment, just shape").font(.kBody(12.5)).foregroundStyle(Color.kInkSoft)
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(days.indices, id: \.self) { i in
                    VStack(spacing: 5) {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(days[i].count > 0 ? Color.kIris : Color.kSurfaceSunken)
                            .frame(height: max(6, CGFloat(days[i].count) / CGFloat(maxC) * 70))
                        Text(days[i].label).font(.kBody(10, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 92, alignment: .bottom)
            .padding(.top, 8)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
    }

    private func streakCard(_ s: StatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Soft streak").font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
            Text("1-day grace").font(.kBody(11.5)).foregroundStyle(Color.kInkSoft)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("🔥").font(.system(size: 20))
                Text("\(s.streak.current)").font(.kDisplay(30)).foregroundStyle(Color.kInk)
            }
            .padding(.top, 4)
            Text("best \(s.streak.best)").font(.kBody(11)).foregroundStyle(Color.kInkSoft)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
    }

    private func totalsCard(_ s: StatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("14 days").font(.kBody(15, weight: .bold)).foregroundStyle(Color.kInk)
            row("Completed", "\(s.totalCompleted)")
            row("Focus min", "\(s.totalFocusMin)")
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
    }

    private func focusHoursCard(_ h: StatsResponse.FocusHours) -> some View {
        let maxH = max(1, h.hours.max() ?? 1)
        return VStack(alignment: .leading, spacing: 8) {
            Text("Your focus hours").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
            HStack(spacing: 2) {
                ForEach(0..<24, id: \.self) { hr in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.kIris.opacity(h.hours[hr] == 0 ? 0.12 : 0.35 + 0.65 * Double(h.hours[hr]) / Double(maxH)))
                        .frame(height: 20)
                }
            }
            HStack {
                Text("6a").font(.kBody(9)); Spacer(); Text("12p").font(.kBody(9)); Spacer(); Text("6p").font(.kBody(9))
            }.foregroundStyle(Color.kInkFaint)
            Text("Focus lands most often around \(h.peakHour):00.").font(.kBody(12.5)).foregroundStyle(Color.kInkSoft)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
    }

    private func timeTruthCard(_ e: StatsResponse.Estimate) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Time truth").font(.kBody(16, weight: .bold)).foregroundStyle(Color.kInk)
            Text(e.ratio >= 1.15
                 ? "Your \(e.avgTargetMin)-min focus plans actually run about \(e.avgActualMin) min. That's normal — plan ×\(String(format: "%.1f", e.ratio)) and you'll land on time."
                 : "Your time estimates are landing — plans and reality match. Rare skill. Keep it.")
                .font(.kBody(13.5)).foregroundStyle(Color.kInkSoft)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).kCard(radius: 20)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.kBody(13)).foregroundStyle(Color.kInkSoft)
            Spacer()
            Text(value).font(.kMono(15, weight: .bold)).foregroundStyle(Color.kInk)
        }
    }

    private func load() async {
        stats = try? await KairoAPI.shared.stats()
        loading = false
    }
}
