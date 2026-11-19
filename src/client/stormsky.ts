// Thunder and the sound of the weather in a battle (src/sim/seasonsky.ts says when a stroke falls and how loud the
// weather is). A flash lights the field when a stroke falls; its thunder follows, later and softer the further off it
// is. Rain hisses as hard as it falls, and wind blows with snow and dust. Every sound is made here from noise, as
// the game's other sounds are (sfx.ts): no recordings.
import { strokeAt, weatherSound } from '../sim/seasonsky';
import type { Sky, Stroke } from '../sim/seasonsky';
import { sfx } from './sfx';

/** How long a flash takes to die away, in seconds. */
const FLASH = 0.45;

export class StormSky {
  /** How bright the lightning is just now, 0 to 1: the renderer lifts the light by it. */
  flash = 0;
  private struck = -1;
  private flashT = 0;
  private flicker = 0;
  private loops: { ctx: AudioContext; rain: GainNode; wind: GainNode; windF: BiquadFilterNode } | null = null;

  /** Once a frame: `t` is the battle's own time, `seed` its seed, `sky` its weather. */
  update(dt: number, t: number, seed: number, sky: Sky): void {
    const s: Stroke | null = strokeAt(seed, t, sky);
    if (s && t >= s.at && this.struck !== s.at) {
      this.struck = s.at;
      this.flashT = FLASH;
      this.flicker = 0.08 + s.far * 0.1;
      this.thunder(s);
    }
    this.flashT = Math.max(0, this.flashT - dt);
    // A stroke flickers: a first bright flash, a dip, and a second one before it dies.
    const age = FLASH - this.flashT;
    this.flash = this.flashT <= 0 ? 0 : Math.max(0, (age < this.flicker ? 1 : age < this.flicker * 1.6 ? 0.25 : 0.8) * (this.flashT / FLASH));
    this.sound(sky);
  }

  /** The thunder of a stroke: a crack when it is near, and a long low roll. */
  private thunder(s: Stroke): void {
    const b = sfx.bus();
    if (!b) return;
    const { ctx: c, out } = b, at = c.currentTime + s.delay, near = 1 - s.far;
    if (near > 0.6) burst(c, out, at, 0.35, 0.5 * near, 'highpass', 900);
    burst(c, out, at + 0.05, 2.4 + s.far * 1.6, 0.55 + 0.45 * near, 'lowpass', 110 + near * 140);
  }

  /** The rain and the wind, as loud as the weather is heavy. */
  private sound(sky: Sky): void {
    const b = sfx.bus(), level = weatherSound(sky);
    if (!b) { if (this.loops) { this.loops.rain.gain.value = 0; this.loops.wind.gain.value = 0; } return; }
    if (!this.loops || this.loops.ctx !== b.ctx) this.loops = makeLoops(b.ctx, b.out);
    const now = b.ctx.currentTime, L = this.loops;
    L.rain.gain.setTargetAtTime(level.rain * 0.22, now, 0.6);
    L.wind.gain.setTargetAtTime(level.wind * 0.3, now, 0.8);
    L.windF.frequency.setTargetAtTime(260 + 220 * Math.sin(now * 0.37) * Math.sin(now * 0.13), now, 0.5); // gusts
  }
}

/** Two seconds of noise. */
function noiseBuffer(c: AudioContext, secs = 2): AudioBuffer {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * secs), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A burst of filtered noise that swells and dies away. */
function burst(c: AudioContext, out: AudioNode, at: number, dur: number, vol: number, type: BiquadFilterType, freq: number): void {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuffer(c, dur);
  f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.12, dur * 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.05);
}

/** The rain's hiss and the wind's roar, looping for as long as the battle lasts, silent until the weather comes. */
function makeLoops(c: AudioContext, out: AudioNode): NonNullable<StormSky['loops']> {
  const loop = (): AudioBufferSourceNode => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c); s.loop = true; s.start(); return s; };
  const rain = c.createGain(), rf = c.createBiquadFilter(), rf2 = c.createBiquadFilter();
  rain.gain.value = 0;
  rf.type = 'highpass'; rf.frequency.value = 1100;
  rf2.type = 'lowpass'; rf2.frequency.value = 7000;
  loop().connect(rf).connect(rf2).connect(rain).connect(out);
  const wind = c.createGain(), windF = c.createBiquadFilter();
  wind.gain.value = 0;
  windF.type = 'bandpass'; windF.frequency.value = 300; windF.Q.value = 0.8;
  loop().connect(windF).connect(wind).connect(out);
  return { ctx: c, rain, wind, windF };
}
