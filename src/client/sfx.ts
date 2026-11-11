// Small synthesised sound effects (Web Audio). No audio files needed.

type Name = 'select' | 'order' | 'place' | 'error' | 'hit' | 'shot' | 'death' | 'done' | 'age' | 'alert' | 'birth' | 'grown' | 'quake' | 'plague';

const GAP: Partial<Record<Name, number>> = { hit: 0.07, shot: 0.09, death: 0.12, select: 0.03, error: 0.3 };

class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private last = new Map<Name, number>();

  /** Must be called from a user gesture so the browser allows audio. */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 0): void {
    const c = this.ctx!, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0): void {
    const c = this.ctx!, t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    f.type = filter;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t);
  }

  play(name: Name): void {
    const c = this.ctx;
    if (!c || this.muted || c.state !== 'running') return;
    const now = c.currentTime;
    if (now - (this.last.get(name) ?? -1) < (GAP[name] ?? 0.05)) return;
    this.last.set(name, now);
    const r = 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'select': this.tone(880, 0.05, 'sine', 0.12); break;
      case 'order': this.tone(520, 0.06, 'triangle', 0.14); this.tone(700, 0.07, 'triangle', 0.12, 0.06); break;
      case 'place': this.noise(0.14, 0.4, 'lowpass', 260); this.tone(110, 0.14, 'sine', 0.3); break;
      case 'error': this.tone(150, 0.14, 'square', 0.08); break;
      case 'hit': this.noise(0.06, 0.22, 'highpass', 1800 * r); this.tone(260 * r, 0.07, 'triangle', 0.1); break;
      case 'shot': this.noise(0.12, 0.1, 'bandpass', 2600 * r); break;
      case 'death': this.tone(280 * r, 0.25, 'triangle', 0.12, 0, 80); break;
      case 'done': this.tone(660, 0.1, 'triangle', 0.14); this.tone(880, 0.16, 'triangle', 0.14, 0.1); break;
      case 'birth': this.tone(1047, 0.18, 'sine', 0.12); this.tone(1319, 0.3, 'sine', 0.12, 0.14); break;
      case 'grown': this.tone(784, 0.1, 'sine', 0.1); this.tone(988, 0.14, 'sine', 0.1, 0.09); break;
      case 'age': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.22, 'sawtooth', 0.09, i * 0.18)); break;
      case 'alert': this.tone(220, 0.35, 'sawtooth', 0.12); this.tone(196, 0.5, 'sawtooth', 0.12, 0.36); break;
      case 'quake': this.noise(2.2, 0.7, 'lowpass', 90); this.tone(48, 2, 'sine', 0.4, 0, 30); break;
      case 'plague': this.tone(500, 0.9, 'sine', 0.14, 0, 110); this.noise(0.8, 0.08, 'bandpass', 700); break;
    }
  }
}

export const sfx = new Sfx();
