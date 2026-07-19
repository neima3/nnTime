import SwiftUI

// MARK: - More: account, the web superpowers, sign out.

struct MoreView: View {
    @Environment(AppState.self) private var app
    @State private var settings: UserSettings?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 12) {
                        card {
                            row(icon: "globe", title: "Planning timezone",
                                value: settings?.timezone ?? app.timezone.identifier)
                            divider
                            row(icon: "paintpalette", title: "Theme",
                                value: "Matches your device")
                        }

                        card {
                            VStack(alignment: .leading, spacing: 10) {
                                Label {
                                    Text("More superpowers on the web")
                                        .font(.kBody(15, weight: .bold))
                                        .foregroundStyle(Color.kInk)
                                } icon: {
                                    Image(systemName: "sparkles").foregroundStyle(Color.kIris)
                                }
                                Text("Brain-break games, AI planning, routines player, week & month views live at time.neima.me — same account, same day.")
                                    .font(.kBody(13.5))
                                    .foregroundStyle(Color.kInkSoft)
                                Link(destination: URL(string: "https://time.neima.me/app/today")!) {
                                    Text("Open Kairo on the web →")
                                        .font(.kBody(13.5, weight: .bold))
                                        .foregroundStyle(Color.kIris)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                        }

                        Button {
                            Task { await app.signOut() }
                        } label: {
                            Text("Sign out")
                                .font(.kBody(15, weight: .semibold))
                                .foregroundStyle(Color.kInkSoft)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .kCard(radius: 18)

                        Text("Kairo for iOS · 1.0 · made with care for ADHD brains")
                            .font(.kBody(12))
                            .foregroundStyle(Color.kInkFaint)
                            .padding(.top, 12)
                    }
                    .padding(20)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("More")
                        .font(.kDisplay(18, relativeTo: .headline))
                        .foregroundStyle(Color.kInk)
                }
            }
            .toolbarBackground(Color.kCanvas, for: .navigationBar)
        }
        .task {
            settings = try? await KairoAPI.shared.settings()
        }
    }

    private var divider: some View {
        Rectangle().fill(Color.kBorder).frame(height: 1).padding(.leading, 52)
    }

    private func card(@ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: 0) { content() }
            .kCard(radius: 20)
    }

    private func row(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.kIris)
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: 9).fill(Color.kIrisGhost))
            Text(title)
                .font(.kBody(15, weight: .medium))
                .foregroundStyle(Color.kInk)
            Spacer()
            Text(value)
                .font(.kBody(13))
                .foregroundStyle(Color.kInkSoft)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }
}
