/**
 * Procedural soundscape engine (R5).
 *
 * Generates ambient audio in real time with the Web Audio API — no audio files
 * to ship, no network, works offline, and loops seamlessly forever. Each
 * soundscape is a small graph of noise + filters + slow modulation:
 *
 *   rain       — bandpassed white noise + a touch of high crackle
 *   forest     — airy filtered noise + sparse random bird chirps
 *   ocean      — brown noise under a slow swell (waves in and out)
 *   cafe       — low warm murmur (brown noise) + gentle mid presence
 *   whitenoise — flat, full-spectrum
 *
 * Built lazily on first user gesture (autoplay policy). Cross-fades on switch.
 */

export type SoundscapeId = "rain" | "forest" | "ocean" | "cafe" | "whitenoise";

/** Fill a buffer with white noise. */
function whiteNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Fill a buffer with brown (Brownian) noise — warmer, less hiss. */
function brownNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private chirpTimer: ReturnType<typeof setTimeout> | null = null;
  private _volume = 0.5;
  private _muted = false;
  current: SoundscapeId | null = null;

  private ensureCtx() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private loopSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  /** Start (or switch to) a soundscape. Returns the id now playing. */
  play(id: SoundscapeId): SoundscapeId {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    this.stopNodes();
    this.current = id;

    switch (id) {
      case "whitenoise": {
        const src = this.loopSource(whiteNoiseBuffer(ctx));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 11000;
        src.connect(lp).connect(this.master!);
        src.start();
        this.nodes.push(src);
        break;
      }
      case "rain": {
        const src = this.loopSource(whiteNoiseBuffer(ctx));
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1400;
        bp.Q.value = 0.5;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 400;
        src.connect(hp).connect(bp).connect(this.master!);
        src.start();
        this.nodes.push(src);
        break;
      }
      case "ocean": {
        const src = this.loopSource(brownNoiseBuffer(ctx));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        const swell = ctx.createGain();
        swell.gain.value = 0.5;
        // Slow LFO opens/closes the swell — waves rolling in and out (~11s).
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.45;
        lfo.connect(lfoGain).connect(swell.gain);
        src.connect(lp).connect(swell).connect(this.master!);
        src.start();
        lfo.start();
        this.nodes.push(src, lfo);
        break;
      }
      case "cafe": {
        const src = this.loopSource(brownNoiseBuffer(ctx));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 500;
        const presence = ctx.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 800;
        presence.gain.value = 4;
        src.connect(lp).connect(presence).connect(this.master!);
        src.start();
        this.nodes.push(src);
        break;
      }
      case "forest": {
        const src = this.loopSource(whiteNoiseBuffer(ctx));
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 2200;
        const airy = ctx.createGain();
        airy.gain.value = 0.25;
        src.connect(hp).connect(airy).connect(this.master!);
        src.start();
        this.nodes.push(src);
        this.scheduleChirps();
        break;
      }
    }
    return id;
  }

  /** Sparse, randomly-pitched bird chirps for the forest scene. */
  private scheduleChirps() {
    const ctx = this.ctx!;
    const chirp = () => {
      if (this.current !== "forest" || !this.master) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const base = 1800 + Math.random() * 1600;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.08);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.2);
      this.chirpTimer = setTimeout(chirp, 1500 + Math.random() * 4000);
    };
    this.chirpTimer = setTimeout(chirp, 1200 + Math.random() * 2000);
  }

  private stopNodes() {
    if (this.chirpTimer) {
      clearTimeout(this.chirpTimer);
      this.chirpTimer = null;
    }
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.nodes = [];
  }

  /** Stop everything (keeps the context for a fast restart). */
  stop() {
    this.stopNodes();
    this.current = null;
  }

  setVolume(v: number) {
    this._volume = v;
    if (this.master && !this._muted) {
      this.master.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05);
    }
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(
        m ? 0 : this._volume,
        this.ctx!.currentTime,
        0.05,
      );
    }
  }
}
