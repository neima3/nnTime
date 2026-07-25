import Foundation
import AVFoundation

// MARK: - Native procedural soundscape (H4) — parity with the web Web Audio engine.
// Generates ambient audio in real time with AVAudioEngine + a source node:
// rain / forest (with sparse chirps) / ocean (slow swell) / cafe / white noise.
// No audio files, works offline, loops forever. All DSP is done per-sample in
// the render callback with simple one-pole filters + a leaky integrator.

enum SoundscapeScene: String, CaseIterable {
    case rain, forest, ocean, cafe, whitenoise

    var label: String {
        switch self {
        case .rain: "🌧 Rain"
        case .forest: "🌲 Forest"
        case .ocean: "🌊 Ocean"
        case .cafe: "☕ Café"
        case .whitenoise: "⚪ White"
        }
    }
}

final class SoundscapeEngine {
    static let shared = SoundscapeEngine()

    private let engine = AVAudioEngine()
    private var srcNode: AVAudioSourceNode?
    private var started = false
    private var sampleRate: Double = 44_100

    // Live parameters (read on the audio thread; simple values, races are benign
    // for ambient audio — worst case a momentary texture blip, never a crash).
    private var scene: SoundscapeScene = .whitenoise
    private var gain: Float = 0
    private var targetGain: Float = 0

    // DSP state (audio thread only).
    private var rng: UInt64 = 0x2545F4914F6CDD1D
    private var lp: Float = 0        // one-pole lowpass memory
    private var hp: Float = 0        // highpass memory
    private var brown: Float = 0     // leaky integrator
    private var lfoPhase: Float = 0
    private var chirpSamplesLeft: Int = 0
    private var samplesUntilChirp: Int = 0
    private var chirpPhase: Float = 0
    private var chirpFreq: Float = 2000

    private(set) var current: SoundscapeScene?

    var volume: Float = 0.5
    var muted = false

    private init() {}

    // MARK: Public control

    func play(_ scene: SoundscapeScene) {
        configureSessionIfNeeded()
        setup()
        self.scene = scene
        current = scene
        targetGain = muted ? 0 : volume
        if !engine.isRunning { try? engine.start() }
    }

    func stop() {
        targetGain = 0
        current = nil
        // Let the fade finish, then pause to save power.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            guard let self, self.current == nil else { return }
            self.engine.pause()
        }
    }

    func setVolume(_ v: Float) {
        volume = v
        if current != nil && !muted { targetGain = v }
    }

    func setMuted(_ m: Bool) {
        muted = m
        targetGain = (m || current == nil) ? 0 : volume
    }

    // MARK: Setup

    private func configureSessionIfNeeded() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, options: [.mixWithOthers])
        try? session.setActive(true)
    }

    private func setup() {
        guard !started else { return }
        started = true
        let format = engine.outputNode.outputFormat(forBus: 0)
        sampleRate = format.sampleRate > 0 ? format.sampleRate : 44_100
        samplesUntilChirp = Int(Double.random(in: 1...3) * sampleRate)

        let node = AVAudioSourceNode { [weak self] _, _, frameCount, ablPointer -> OSStatus in
            guard let self else { return noErr }
            let abl = UnsafeMutableAudioBufferListPointer(ablPointer)
            for frame in 0..<Int(frameCount) {
                let s = self.renderSample()
                for buffer in abl {
                    let ptr = buffer.mData!.assumingMemoryBound(to: Float.self)
                    ptr[frame] = s
                }
            }
            return noErr
        }
        srcNode = node
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
    }

    // MARK: DSP (audio thread)

    /// xorshift white noise in [-1, 1].
    private func white() -> Float {
        rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17
        return Float(Int64(bitPattern: rng)) / Float(Int64.max)
    }

    private func renderSample() -> Float {
        // Smooth the gain toward its target to avoid clicks on start/stop.
        gain += (targetGain - gain) * 0.0004
        if gain < 0.00001 && targetGain == 0 { return 0 }

        let w = white()
        var out: Float = 0
        let sr = Float(sampleRate)

        switch scene {
        case .whitenoise:
            lp += 0.4 * (w - lp)
            out = lp * 0.5

        case .rain:
            // Bandpassed hiss + a touch of high crackle.
            lp += 0.10 * (w - lp)          // low content
            hp = w - lp                     // high content
            out = (hp * 0.5 + (w - lp) * 0.1) * 0.6

        case .ocean:
            brown = (brown + 0.02 * w) / 1.02
            lp += 0.05 * (brown * 3.2 - lp)
            lfoPhase += 2 * .pi * 0.09 / sr
            if lfoPhase > 2 * .pi { lfoPhase -= 2 * .pi }
            let swell = 0.55 + 0.45 * sin(lfoPhase)
            out = lp * swell * 1.2

        case .cafe:
            brown = (brown + 0.02 * w) / 1.02
            lp += 0.03 * (brown * 3.4 - lp)
            out = lp * 1.3

        case .forest:
            hp = w - (lp + 0.03 * (w - lp))
            lp += 0.03 * (w - lp)
            out = hp * 0.25
            // Sparse bird chirps.
            if chirpSamplesLeft > 0 {
                let env = Float(chirpSamplesLeft) / (0.18 * sr)
                chirpPhase += 2 * .pi * chirpFreq / sr
                out += sin(chirpPhase) * env * env * 0.18
                chirpSamplesLeft -= 1
            } else {
                samplesUntilChirp -= 1
                if samplesUntilChirp <= 0 {
                    chirpFreq = 1800 + white().magnitude * 1600
                    chirpSamplesLeft = Int(0.18 * sr)
                    chirpPhase = 0
                    samplesUntilChirp = Int((1.5 + white().magnitude * 4) * sr)
                }
            }
        }

        return out * gain
    }
}
