// Small synthesised sound effects (Web Audio). No audio files needed.

type Name = 'select' | 'order' | 'place' | 'error' | 'hit' | 'shot' | 'death' | 'done' | 'age' | 'alert' | 'birth' | 'grown' | 'quake' | 'plague' | 'hover' | 'confirm';

const GAP: Partial<Record<Name, number>> = { hit: 0.07, shot: 0.09, death: 0.12, select: 0.03, error: 0.3 };

/** The stand-in theme: eight slow bars in D minor. Chords as MIDI notes, and the tune as [beat, note, beats]. */
const BAR = 4.4;
const CHORDS = [[50, 57, 62, 65], [50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [50, 57, 62, 65], [53, 57, 60, 65], [48, 55, 60, 64], [50, 57, 62, 66]];
const TUNE: [number, number, number][][] = [
  [[0, 62, 2], [2, 65, 1], [3, 69, 1]],
  [[0, 67, 1.5], [1.5, 65, 0.5], [2, 64, 2]],
  [[0, 65, 2], [2, 70, 1], [3, 69, 1]],
  [[0, 67, 3], [3, 64, 1]],
  [[0, 62, 1], [1, 69, 1], [2, 74, 2]],
  [[0, 72, 1.5], [1.5, 69, 0.5], [2, 65, 2]],
  [[0, 67, 1], [1, 64, 1], [2, 60, 2]],
  [[0, 62, 4]],
];

class Sfx {
  muted = false;
  music = true;
  private volume = 0.5;

  setVolume(v: number): void {
    this.volume = v;
    if (this.out) this.out.gain.value = v;
    this.syncTheme();
  }
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private last = new Map<Name, number>();

  /** Must be called from a user gesture so the browser allows audio. */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); this.syncTheme(); return; }
    try {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.volume;
      this.out.connect(this.ctx.destination);
      this.startMusic();
      this.syncTheme();
    } catch {
      this.ctx = null;
    }
  }

  /** Quiet generative background music: slow pentatonic notes wandering over a low drone. */
  private startMusic(): void {
    const scale = [220, 247, 294, 330, 392, 440, 494, 587];
    let i = 3, beat = 0;
    setInterval(() => {
      if (!this.ctx || this.muted || !this.music || this.themeOn || this.ctx.state !== 'running' || document.hidden) return;
      if (beat++ % 8 === 0) this.tone(beat % 16 === 1 ? 110 : 147, 9, 'sine', 0.035);
      if (Math.random() < 0.65) {
        i = Math.max(0, Math.min(scale.length - 1, i + Math.floor(Math.random() * 5) - 2));
        this.tone(scale[i], 2.4, 'sine', 0.04);
        this.tone(scale[i] * 2, 1.2, 'triangle', 0.01);
      }
    }, 1300);
  }

  // ---- The main theme ----
  // Played at the main menu. A recording at public/assets/music/theme.* is used when there is one;
  // until then a short synthesised piece stands in for it.

  private themeOn = false;
  private themeUrl: string | null = null;
  private themeEl: HTMLAudioElement | null = null;
  private themeBus: GainNode | null = null;
  private themeTimer = 0;
  private themeFade = 1;
  private themeNext = 0;
  private themeBar = 0;
  private kick = (): void => { this.unlock(); this.syncTheme(); };

  /** Begin the main theme: the recording at `url`, or the stand-in when there is none. Safe to call before any click. */
  theme(url: string | null): void {
    if (this.themeOn) return;
    this.themeOn = true;
    this.themeUrl = url;
    this.themeFade = 1;
    // A browser plays nothing until the page has been clicked or a key pressed, so the first of either starts it.
    window.addEventListener('pointerdown', this.kick);
    window.addEventListener('keydown', this.kick);
    window.addEventListener('pagehide', () => {
      try { if (this.themeEl && this.themeOn) sessionStorage.setItem('rtsv-theme-t', String(this.themeEl.currentTime)); } catch { /* storage unavailable */ }
    });
    clearInterval(this.themeTimer);
    this.themeTimer = window.setInterval(() => this.syncTheme(), 200);
    this.syncTheme();
  }

  /** Let the theme die away as play begins. */
  endTheme(): void {
    if (!this.themeOn) return;
    this.themeOn = false;
    window.removeEventListener('pointerdown', this.kick);
    window.removeEventListener('keydown', this.kick);
    try { sessionStorage.removeItem('rtsv-theme-t'); } catch { /* storage unavailable */ }
    if (this.themeBus && this.ctx) {
      const t = this.ctx.currentTime;
      this.themeBus.gain.cancelScheduledValues(t);
      this.themeBus.gain.setValueAtTime(this.themeBus.gain.value, t);
      this.themeBus.gain.linearRampToValueAtTime(0, t + 2.5);
    }
  }

  private syncTheme(): void {
    const quiet = this.muted || !this.music;
    if (!this.themeOn) {
      // Fading out: the recording is turned down step by step, then stopped.
      if (this.themeFade > 0 && (this.themeFade = Math.max(0, this.themeFade - 0.08)) === 0) {
        this.themeEl?.pause();
        clearInterval(this.themeTimer);
      }
      if (this.themeEl) this.themeEl.volume = Math.min(1, this.volume * 1.4) * this.themeFade;
      return;
    }
    if (this.themeUrl) {
      if (!this.themeEl) {
        const a = this.themeEl = new Audio(this.themeUrl);
        a.loop = true;
        a.preload = 'auto';
        // Moving between the menu's pages reloads the game; the music carries on from where it was.
        const at = Number((() => { try { return sessionStorage.getItem('rtsv-theme-t'); } catch { return null; } })()) || 0;
        if (at > 0) a.addEventListener('loadedmetadata', () => { if (at < a.duration) a.currentTime = at; }, { once: true });
      }
      this.themeEl.volume = Math.min(1, this.volume * 1.4);
      this.themeEl.muted = quiet;
      if (this.themeEl.paused) this.themeEl.play().catch(() => { /* not yet allowed: the first click will start it */ });
      return;
    }
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (!this.themeBus) {
      this.themeBus = c.createGain();
      this.themeBus.connect(this.out!);
      this.themeNext = c.currentTime + 0.15;
      this.themeBar = 0;
    }
    this.themeBus.gain.setTargetAtTime(quiet ? 0 : 1, c.currentTime, 0.25);
    if (this.themeNext < c.currentTime) this.themeNext = c.currentTime + 0.1; // the tab was away
    while (this.themeNext < c.currentTime + 1) { this.themeScore(this.themeBar++, this.themeNext); this.themeNext += BAR; }
  }

  /** One bar of the stand-in theme: low strings holding a chord, a frame drum, and a slow tune above them. */
  private themeScore(bar: number, t: number): void {
    const i = bar % CHORDS.length, hz = (m: number): number => 440 * 2 ** ((m - 69) / 12), beat = BAR / 4;
    for (const m of CHORDS[i]) {
      this.voice('sawtooth', hz(m), t, BAR * 1.15, 0.05, 1.1, 520);
      this.voice('sawtooth', hz(m) * 1.004, t, BAR * 1.15, 0.04, 1.3, 420);
    }
    this.voice('sine', hz(CHORDS[i][0] - 12), t, BAR * 1.1, 0.16, 0.6, 300);
    if (bar >= 2) for (const [b, v] of [[0, 0.55], [2, 0.4], [3.5, 0.22]]) this.drum(t + b * beat, v);
    // The tune waits for the strings to settle, and from then on comes round with them.
    if (bar >= 4) for (const [b, m, len] of TUNE[i]) {
      this.voice('triangle', hz(m), t + b * beat, len * beat * 1.05, 0.11, 0.09, 2200);
      this.voice('sine', hz(m + 12), t + b * beat, len * beat, 0.03, 0.2, 4000);
    }
  }

  /** A sustained note that swells in and dies away, as a bowed or blown one does. */
  private voice(type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack: number, cutoff: number): void {
    const c = this.ctx!, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const up = Math.min(attack, dur * 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + up);
    g.gain.setValueAtTime(vol, t + Math.max(up, dur * 0.6));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f).connect(g).connect(this.themeBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, vol: number): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.3);
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(this.themeBus!);
    o.start(t);
    o.stop(t + 0.65);
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
      case 'hover': this.tone(392, 0.05, 'sine', 0.05); break;
      case 'confirm': this.noise(0.2, 0.3, 'lowpass', 180); this.tone(98, 0.3, 'sine', 0.3); this.tone(294, 0.5, 'triangle', 0.08); this.tone(440, 0.7, 'triangle', 0.06, 0.07); break;
      case 'plague': this.tone(500, 0.9, 'sine', 0.14, 0, 110); this.noise(0.8, 0.08, 'bandpass', 700); break;
    }
  }
}

export const sfx = new Sfx();
