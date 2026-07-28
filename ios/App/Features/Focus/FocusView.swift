import SwiftUI
import ActivityKit

// MARK: - Focus: server-authoritative timer (ADR-004) with the sky ring,
// overtime that counts up instead of going silent, and Spline Mono digits.

struct FocusView: View {
    /// Named session presets (R3 — mirrors web Focus rituals).
    struct Ritual { let id: String; let label: String; let emoji: String; let title: String; let min: Int; let sound: SoundscapeScene? }
    static let rituals: [Ritual] = [
        .init(id: "deep", label: "Deep work", emoji: "🧠", title: "Deep work", min: 45, sound: .whitenoise),
        .init(id: "quick", label: "Quick win", emoji: "⚡", title: "Quick win", min: 15, sound: nil),
        .init(id: "double", label: "Body double", emoji: "👥", title: "Body double", min: 25, sound: .cafe),
        .init(id: "wind", label: "Wind down", emoji: "🌙", title: "Wind down", min: 10, sound: .rain),
        .init(id: "flow", label: "Creative flow", emoji: "🎨", title: "Creative flow", min: 45, sound: .forest),
    ]

    @State private var session: FocusSession?
    @State private var remaining = 25 * 60
    @State private var overtime = 0
    @State private var duration = 25
    @State private var loading = true
    @State private var finishedMin: Int?
    /// Local break countdown (seconds) after a finished session; nil = none.
    @State private var breakSec: Int?
    @State private var pendingTitle = "Deep focus"
    @State private var pendingEmoji = "🎯"
    // Linked activity + its checklist (H2), when focus is started from a block.
    @State private var linkedActivityId: String?
    @State private var linkedOccurrenceKey: String?
    @State private var linkedRevision = 1
    @State private var checklist: [(label: String, done: Bool)] = []
    @State private var scene: SoundscapeScene?
    /// Companion mode (T11 / R10) — mirrors the web toggle + presence card.
    @State private var companion = KairoPrefs.companion
    @State private var companionBreath = false
    @State private var liveActivity: ActivityKit.Activity<FocusAttributes>?

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let resync = Timer.publish(every: 15, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.kCanvas.ignoresSafeArea()
                if loading {
                    ProgressView().tint(.kIris)
                } else if let breakSec {
                    breakState(breakSec)
                } else if let finishedMin {
                    doneState(minutes: finishedMin)
                } else if let session {
                    activeState(session)
                } else {
                    idleState
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Focus")
                        .font(.kDisplay(18, relativeTo: .headline))
                        .foregroundStyle(Color.kInk)
                }
            }
            .toolbarBackground(Color.kCanvas, for: .navigationBar)
        }
        .task { await hydrate() }
        .onDisappear { SoundscapeEngine.shared.stop(); scene = nil }
        .onReceive(tick) { _ in
            if let bs = breakSec {
                if bs > 1 { breakSec = bs - 1 }
                else {
                    breakSec = nil
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                }
                return
            }
            guard session?.state == "running" else { return }
            if remaining > 0 {
                remaining -= 1
            } else {
                overtime += 1
                if overtime == 1 { Task { await updateLiveActivity() } }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .kairoStartFocus)) { note in
            guard session == nil else { return }
            if let title = note.userInfo?["title"] as? String { pendingTitle = title }
            if let emoji = note.userInfo?["emoji"] as? String { pendingEmoji = emoji }
            if let mins = note.userInfo?["duration"] as? Int {
                duration = min(60, max(5, mins))
                remaining = duration * 60
            }
            linkedActivityId = note.userInfo?["activityId"] as? String
            linkedOccurrenceKey = note.userInfo?["occurrenceKey"] as? String
            linkedRevision = note.userInfo?["revision"] as? Int ?? 1
            if let raw = note.userInfo?["checklist"] as? [[String: Any]] {
                checklist = raw.compactMap {
                    guard let l = $0["label"] as? String else { return nil }
                    return (l, ($0["done"] as? Bool) ?? false)
                }
            } else {
                checklist = []
            }
            finishedMin = nil
        }
        .onReceive(resync) { _ in
            guard session != nil else { return }
            Task { await hydrate(silent: true) }
        }
    }

    // MARK: States

    private var idleState: some View {
        VStack(spacing: 26) {
            FocusRing(progress: 0, overtime: false) {
                VStack(spacing: 6) {
                    Text(pendingEmoji).font(.system(size: 40))
                    Text(KTime.mmss(duration * 60))
                        .font(.kMono(44))
                        .foregroundStyle(Color.kInk)
                    Text(pendingTitle == "Deep focus" ? "ready when you are" : pendingTitle)
                        .font(.kBody(13))
                        .foregroundStyle(Color.kInkSoft)
                }
            }

            // Named rituals — one tap frames the whole session (R3 parity).
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Self.rituals, id: \.id) { r in
                        let on = pendingTitle == r.title && duration == r.min
                        Button {
                            pendingTitle = r.title
                            pendingEmoji = r.emoji
                            duration = r.min
                            remaining = r.min * 60
                            // A ritual is a fresh, unlinked session.
                            linkedActivityId = nil
                            checklist = []
                            // The body-double ritual is the companion's front door.
                            if r.id == "double" && !companion {
                                companion = true
                                KairoPrefs.companion = true
                            }
                            // Auto-start the ritual's vibe (parity with web).
                            scene = r.sound
                            if let s = r.sound { SoundscapeEngine.shared.play(s) }
                            else { SoundscapeEngine.shared.stop() }
                        } label: {
                            HStack(spacing: 5) {
                                Text(r.emoji)
                                Text(r.label)
                            }
                            .font(.kBody(13, weight: .semibold))
                            .foregroundStyle(on ? Color.kIris : Color.kInkSoft)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(
                                Capsule().fill(on ? Color.kIrisSoft : Color.kSurface)
                                    .overlay(Capsule().stroke(on ? Color.kIris : Color.kBorder, lineWidth: 1))
                            )
                        }
                    }
                }
                .padding(.horizontal, 4)
            }

            Button {
                companion.toggle()
                KairoPrefs.companion = companion
            } label: {
                HStack(spacing: 5) {
                    Text("🫂")
                    Text("Companion \(companion ? "on" : "off") · quiet company while you work")
                }
                .font(.kBody(13, weight: .semibold))
                .foregroundStyle(companion ? Color.kIris : Color.kInkSoft)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    Capsule().fill(companion ? Color.kIrisSoft : Color.kSurface)
                        .overlay(Capsule().stroke(companion ? Color.kIris : Color.kBorder, lineWidth: 1))
                )
            }
            .accessibilityLabel("Companion \(companion ? "on" : "off")")
            .accessibilityHint("A quiet presence that stays with you through the session")

            HStack(spacing: 6) {
                ForEach([15, 25, 45, 60], id: \.self) { m in
                    Button {
                        duration = m
                        remaining = m * 60
                    } label: {
                        Text("\(m) min")
                            .font(.kMono(13, weight: .semibold))
                            .foregroundStyle(duration == m ? Color.kIris : Color.kInkSoft)
                            .padding(.horizontal, 13).padding(.vertical, 8)
                            .background(Capsule().fill(duration == m ? Color.kIrisSoft : Color.kSurface))
                    }
                }
            }
            .padding(6)
            .kCard(radius: 26)

            // Soundscape picker (H4) — generated ambient audio, no files.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    soundPill(nil, "🔇 Off")
                    ForEach(SoundscapeScene.allCases, id: \.self) { sc in
                        soundPill(sc, sc.label)
                    }
                }
                .padding(.horizontal, 4)
            }

            Button {
                Task { await start() }
            } label: {
                Label("Start focus", systemImage: "play.fill")
                    .font(.kBody(16, weight: .semibold))
                    .foregroundStyle(Color.kInkInverse)
                    .padding(.horizontal, 30).padding(.vertical, 15)
                    .background(Capsule().fill(Color.kIris))
            }
            .kFloatShadow()
        }
    }

    private func activeState(_ session: FocusSession) -> some View {
        let target = session.targetDurationMin * 60
        let inOvertime = remaining <= 0 && session.state == "running"
        let progress = target > 0 ? 1 - Double(remaining) / Double(target) : 0

        return VStack(spacing: 28) {
            VStack(spacing: 3) {
                Text(session.state == "paused" ? "PAUSED" : inOvertime ? "STILL GOING" : "NOW FOCUSING")
                    .font(.kBody(12, weight: .bold))
                    .kerning(1.6)
                    .foregroundStyle(inOvertime ? Color.kCatButterInk : Color.kInkSoft)
                Text("\(session.targetDurationMin) min target")
                    .font(.kMono(13))
                    .foregroundStyle(Color.kInkFaint)
            }

            FocusRing(progress: inOvertime ? 1 : progress, overtime: inOvertime) {
                VStack(spacing: 6) {
                    Text("🎯").font(.system(size: 38))
                    Text(inOvertime ? "+\(KTime.mmss(overtime))" : KTime.mmss(remaining))
                        .font(.kMono(44))
                        .foregroundStyle(inOvertime ? Color.kCatButterInk : Color.kInk)
                    Text(inOvertime ? "past target — that's okay" : "remaining")
                        .font(.kBody(12.5))
                        .foregroundStyle(Color.kInkSoft)
                }
            }

            if inOvertime {
                VStack(spacing: 8) {
                    Text("\(max(1, overtime / 60)) min past your target. Good stopping point?")
                        .font(.kBody(13.5, weight: .semibold))
                        .foregroundStyle(Color.kCatButterInk)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 8) {
                        Button {
                            Task { await complete(session) }
                        } label: {
                            Text("Wrap up").font(.kBody(13, weight: .bold)).foregroundStyle(Color.kCatButter)
                                .padding(.horizontal, 14).padding(.vertical, 7)
                                .background(Capsule().fill(Color.kCatButterInk))
                        }
                        Button {
                            Task { await action(["action": "extend", "addMinutes": 5]) }
                        } label: {
                            Text("+5 more").font(.kBody(13, weight: .bold)).foregroundStyle(Color.kCatButterInk)
                                .padding(.horizontal, 14).padding(.vertical, 7)
                                .background(Capsule().stroke(Color.kCatButterInk, lineWidth: 1))
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.kCatButter))
            }

            if companion {
                let elapsedMin = max(0, session.targetDurationMin - remaining / 60)
                let compState: CompanionLines.State =
                    session.state == "paused" ? .paused : (inOvertime ? .overtime : .running)
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Color.kIrisSoft).frame(width: 36, height: 36)
                        Circle().fill(Color.kIris).frame(width: 10, height: 10)
                            .scaleEffect(companionBreath ? 1.25 : 0.85)
                            .opacity(companionBreath ? 1 : 0.6)
                    }
                    .onAppear {
                        guard !KairoPrefs.reducedStimulation,
                              !UIAccessibility.isReduceMotionEnabled else { return }
                        withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) {
                            companionBreath = true
                        }
                    }
                    .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("COMPANION").font(.kBody(10, weight: .bold)).kerning(1.2)
                            .foregroundStyle(Color.kInkFaint)
                        Text(CompanionLines.line(elapsedMin: elapsedMin, state: compState))
                            .font(.kBody(13.5, weight: .semibold))
                            .foregroundStyle(Color.kInkSoft)
                    }
                    Spacer(minLength: 0)
                    Button {
                        companion = false
                        KairoPrefs.companion = false
                    } label: {
                        Text("Solo").font(.kBody(12, weight: .semibold)).foregroundStyle(Color.kInkFaint)
                    }
                    .accessibilityLabel("Solo — turn the companion off")
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .kCard(radius: 16)
                .padding(.horizontal, 24)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Companion")
            }

            HStack(spacing: 18) {
                controlButton("plus", size: 56, label: "Extend 5 minutes") {
                    Task { await action(["action": "extend", "addMinutes": 5]) }
                }
                controlButton(session.state == "paused" ? "play.fill" : "pause.fill", size: 76, filled: true,
                              label: session.state == "paused" ? "Resume" : "Pause") {
                    Task {
                        await action([
                            "action": "transition",
                            "state": session.state == "paused" ? "running" : "paused",
                        ])
                    }
                }
                controlButton("checkmark", size: 56, label: "Complete session") {
                    Task { await complete(session) }
                }
            }

            if !checklist.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("STEPS").font(.kBody(10, weight: .bold)).kerning(1.2).foregroundStyle(Color.kInkFaint)
                    ForEach(checklist.indices, id: \.self) { i in
                        Button { Task { await toggleStep(i) } } label: {
                            HStack(spacing: 10) {
                                Image(systemName: checklist[i].done ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 18))
                                    .foregroundStyle(checklist[i].done ? Color.kSuccess : Color.kInkFaint)
                                Text(checklist[i].label)
                                    .font(.kBody(14))
                                    .foregroundStyle(checklist[i].done ? Color.kInkFaint : Color.kInk)
                                    .strikethrough(checklist[i].done)
                                Spacer()
                            }
                        }
                        .accessibilityLabel("\(checklist[i].label), \(checklist[i].done ? "done" : "not done")")
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .kCard(radius: 16)
                .padding(.horizontal, 24)
            }
        }
    }

    private func toggleStep(_ i: Int) async {
        guard let id = linkedActivityId else { return }
        checklist[i].done.toggle()
        UISelectionFeedbackGenerator().selectionChanged()
        let payload = checklist.map { ["label": $0.label, "done": $0.done] as [String: Any] }
        if let updated = try? await KairoAPI.shared.setChecklist(
            activityId: id, revision: linkedRevision, occurrenceKey: linkedOccurrenceKey, checklist: payload
        ) {
            linkedRevision = updated.revision
        }
    }

    private func doneState(minutes: Int) -> some View {
        VStack(spacing: 14) {
            Text("✓")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(Color.kSuccess)
                .frame(width: 74, height: 74)
                .background(RoundedRectangle(cornerRadius: 22).fill(Color.kSuccessSoft))
            Text("\(minutes) min of real focus.")
                .font(.kDisplay(24))
                .foregroundStyle(Color.kInk)
            Text("That counted. What now?")
                .font(.kBody(14.5))
                .foregroundStyle(Color.kInkSoft)
            VStack(spacing: 10) {
                Button {
                    breakSec = 5 * 60
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    Label("Take a 5-min break", systemImage: "cup.and.saucer.fill")
                        .font(.kBody(15, weight: .semibold))
                        .foregroundStyle(Color.kInkInverse)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Capsule().fill(Color.kIris))
                }
                .kFloatShadow()
                HStack(spacing: 10) {
                    Button {
                        finishedMin = nil
                        remaining = duration * 60
                        overtime = 0
                    } label: {
                        Text("Keep going")
                            .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInk)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(Capsule().fill(Color.kSurface).overlay(Capsule().stroke(Color.kBorder, lineWidth: 1)))
                    }
                    Button {
                        finishedMin = nil
                    } label: {
                        Text("Done for now")
                            .font(.kBody(14, weight: .semibold)).foregroundStyle(Color.kInkSoft)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(Capsule().fill(Color.kSurface).overlay(Capsule().stroke(Color.kBorder, lineWidth: 1)))
                    }
                }
            }
            .padding(.top, 8)
            .padding(.horizontal, 28)
        }
    }

    private func breakState(_ sec: Int) -> some View {
        VStack(spacing: 16) {
            Text("☕").font(.system(size: 52))
            Text("Breathe. Stretch. Sip.")
                .font(.kDisplay(22)).foregroundStyle(Color.kInk)
            Text(KTime.mmss(sec))
                .font(.kMono(46, weight: .bold)).foregroundStyle(Color.kInk)
                .contentTransition(.numericText())
            Text("break time — no rush").font(.kBody(13)).foregroundStyle(Color.kInkSoft)
            Button {
                breakSec = nil
            } label: {
                Text("I'm ready now")
                    .font(.kBody(15, weight: .semibold)).foregroundStyle(Color.kInkInverse)
                    .padding(.horizontal, 26).padding(.vertical, 13)
                    .background(Capsule().fill(Color.kIris))
            }
            .padding(.top, 6).kFloatShadow()
        }
    }

    private func soundPill(_ sc: SoundscapeScene?, _ label: String) -> some View {
        let on = scene == sc
        return Button {
            scene = sc
            if let sc { SoundscapeEngine.shared.play(sc) } else { SoundscapeEngine.shared.stop() }
        } label: {
            Text(label)
                .font(.kBody(12.5, weight: .semibold))
                .foregroundStyle(on ? Color.kIris : Color.kInkSoft)
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(Capsule().fill(on ? Color.kIrisSoft : Color.kSurface)
                    .overlay(Capsule().stroke(on ? Color.kIris : Color.kBorder, lineWidth: 1)))
        }
        .accessibilityLabel("\(label) ambient sound")
    }

    private func controlButton(_ symbol: String, size: CGFloat, filled: Bool = false, label: String = "", action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.34, weight: .semibold))
                .foregroundStyle(filled ? Color.kInkInverse : Color.kInkSoft)
                .frame(width: size, height: size)
                .background(
                    Circle().fill(filled ? Color.kIris : Color.kSurface)
                        .overlay(Circle().stroke(filled ? Color.clear : Color.kBorder, lineWidth: 1))
                )
        }
        .accessibilityLabel(label)
        .kCardShadow()
    }

    // MARK: Data

    private func hydrate(silent: Bool = false) async {
        do {
            let state = try await KairoAPI.shared.activeFocus()
            if let s = state.session, s.state == "running" || s.state == "paused" {
                session = s
                remaining = state.remainingSec ?? 0
            } else if !silent {
                session = nil
            }
        } catch {}
        loading = false
    }

    private func start() async {
        do {
            let state = try await KairoAPI.shared.startFocus(minutes: duration, title: pendingTitle, emoji: pendingEmoji)
            session = state.session
            remaining = state.remainingSec ?? duration * 60
            overtime = 0
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            startLiveActivity(remainingSec: remaining)
        } catch {}
    }

    private func action(_ body: [String: Any?]) async {
        guard let session else { return }
        do {
            let state = try await KairoAPI.shared.focusAction(id: session.id, body: body)
            self.session = state.session
            remaining = state.remainingSec ?? remaining
            if body["action"] as? String == "extend" { overtime = 0 }
            await updateLiveActivity()
        } catch {}
    }

    private func complete(_ current: FocusSession) async {
        let focused = max(1, (current.targetDurationMin * 60 - remaining + overtime) / 60)
        do {
            _ = try await KairoAPI.shared.focusAction(
                id: current.id,
                body: ["action": "transition", "state": "completed"]
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            session = nil
            finishedMin = focused
            overtime = 0
            endLiveActivity()
            SoundscapeEngine.shared.stop()
            scene = nil
            let endedAt = Date()
            Task {
                _ = await HealthKitManager.shared.recordCompletedFocus(
                    sessionId: current.id,
                    minutes: focused,
                    endedAt: endedAt
                )
            }
        } catch {}
    }
}

extension FocusView {
    /// Lock-screen + Dynamic Island presence while a session runs (spec §4).
    private func startLiveActivity(remainingSec: Int) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        endLiveActivity()
        guard let sid = session?.id else { return }
        let attributes = FocusAttributes(title: pendingTitle, emoji: pendingEmoji, targetMin: duration, sessionId: sid)
        let state = FocusAttributes.ContentState(
            endDate: Date().addingTimeInterval(TimeInterval(remainingSec)),
            paused: false,
            pausedRemainingSec: remainingSec,
            overtime: false
        )
        liveActivity = try? ActivityKit.Activity<FocusAttributes>.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: nil)
        )
    }

    private func updateLiveActivity() async {
        guard let liveActivity, let session else { return }
        let state = FocusAttributes.ContentState(
            endDate: Date().addingTimeInterval(TimeInterval(remaining)),
            paused: session.state == "paused",
            pausedRemainingSec: remaining,
            overtime: overtime > 0 && session.state == "running"
        )
        await liveActivity.update(ActivityContent(state: state, staleDate: nil))
    }

    private func endLiveActivity() {
        guard let activity = liveActivity else { return }
        liveActivity = nil
        Task {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}

// MARK: - The ring (sky track, sky-ink progress; butter in overtime)

struct FocusRing<Content: View>: View {
    var progress: Double
    var overtime: Bool
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Circle()
                .stroke(overtime ? Color.kCatButter : Color.kCatSky, lineWidth: 18)
            Circle()
                .trim(from: 0, to: max(0.002, min(1, progress)))
                .stroke(
                    overtime ? Color.kCatButterInk : Color.kCatSkyInk,
                    style: StrokeStyle(lineWidth: 18, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: progress)
            content
        }
        .frame(width: 264, height: 264)
    }
}
