// The season and the sound of the weather in a battle (docs/systems-board, "Weather": no seasons, no thunder, no
// sound of rain).
//
//   - The season: a battle or a visit is fought in the season the map is in (the campaign's turn: spring, summer,
//     autumn, winter). It is a look only: fresh green and blossom in spring, the green of summer, gold and red leaves
//     and browner grass in autumn, and in winter bare boughs and lying snow where the land has a winter (not in the
//     desert, which keeps its summer look). Nothing in the rules reads it, so it moves no battle.
//   - Thunder: in rain heavy enough to be a storm, a flash now and then, and the thunder after it, sooner and louder
//     the nearer the strike. When it strikes is decided here from the time and the weather's own seed, never from
//     the battle's run of chances.
//   - The sound of the weather: rain as loud as it is heavy, and the wind that goes with snow and blowing dust.
// The drawing and the sound are the client's (renderer.ts, scenery.ts, weathersound.ts).
import { SEASONS_A_YEAR } from './ageing';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** The season a campaign turn falls in: the first turn is spring. */
export const seasonOfTurn = (turn: number): Season => SEASONS[((Math.floor(turn) % SEASONS_A_YEAR) + SEASONS_A_YEAR) % SEASONS_A_YEAR];

/** How a season looks on the ground and in the trees, for the drawing. */
export interface SeasonLook {
  season: Season | '';
  /** Added to the grass's red, green and blue (0 to 255). */
  grass: [number, number, number];
  /** Share of broad-leaved trees that stand bare, and of the rest whose leaves have turned. */
  bare: number; turned: number;
  /** Share of the leaves in blossom (spring). */
  blossom: number;
  /** How much of the open ground lies under snow, 0 to 1. */
  snow: number;
}

/** The look of a season in a country. With no season (a skirmish, a mission), the land looks as it always has. */
export function seasonLook(season: Season | '' | undefined, climate: string): SeasonLook {
  const plain: SeasonLook = { season: season ?? '', grass: [0, 0, 0], bare: 0, turned: 0, blossom: 0, snow: 0 };
  if (!season || climate === 'desert') return plain; // the desert has no winter, and no autumn to speak of
  const cold = climate === 'snow', steppe = climate === 'steppe';
  switch (season) {
    case 'spring': return { ...plain, grass: [-8, 12, 2], blossom: cold ? 0 : 0.12, snow: cold ? 0.25 : 0 };
    case 'summer': return { ...plain, grass: steppe ? [10, 2, -4] : [4, 0, -2] };
    case 'autumn': return { ...plain, grass: [26, -4, -10], turned: cold ? 0.4 : 0.75, bare: cold ? 0.3 : 0.1, snow: cold ? 0.2 : 0 };
    case 'winter': return { ...plain, grass: [30, -16, 0], bare: 0.95, snow: cold ? 0.85 : steppe ? 0.45 : 0.6 };
  }
}

/** The weather a sound or a flash follows: its kind and how heavy it is now (Game.weather, Game.weatherAmt). */
export interface Sky { weather: '' | 'rain' | 'snow' | 'dust'; weatherAmt: number }

/** How heavy rain must be before it is a storm with thunder in it. */
export const STORM = 0.6;
/** Thunder is reckoned in slots of this many seconds; at the height of a storm a slot strikes this often. */
export const THUNDER = { slot: 4, most: 0.35 };

/** A steady number in [0, 1) for a seed and a slot of time. */
function chance(seed: number, slot: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(slot | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** How often a slot of time strikes in this weather: nothing short of a storm, then more the heavier it is. */
export function thunderOdds(sky: Sky): number {
  if (sky.weather !== 'rain' || sky.weatherAmt < STORM) return 0;
  return THUNDER.most * Math.min(1, (sky.weatherAmt - STORM) / (1 - STORM) * 0.7 + 0.3);
}

/** A stroke of lightning: when it flashes, how far off (0 near to 1 far), and how long after the flash its thunder comes. */
export interface Stroke { at: number; far: number; delay: number }

/**
 * Does a stroke fall in the slot of time that `t` (in seconds) is in, in this weather? The same seed, time and
 * weather always give the same answer, so a battle loaded again thunders as it did.
 */
export function strokeAt(seed: number, t: number, sky: Sky): Stroke | null {
  const slot = Math.floor(t / THUNDER.slot);
  if (chance(seed, slot) >= thunderOdds(sky)) return null;
  const far = chance(seed + 1, slot);
  return { at: slot * THUNDER.slot + chance(seed + 2, slot) * THUNDER.slot, far, delay: 0.3 + far * 3.2 };
}

/** How loud the weather is, 0 to 1: rain as it is heavy, and the wind that drives snow and dust. */
export function weatherSound(sky: Sky): { rain: number; wind: number } {
  const a = Math.max(0, Math.min(1, sky.weatherAmt));
  if (sky.weather === 'rain') return { rain: a, wind: Math.max(0, a - STORM) * 0.8 };
  if (sky.weather === 'snow') return { rain: 0, wind: a * 0.45 };
  if (sky.weather === 'dust') return { rain: 0, wind: a * 0.9 };
  return { rain: 0, wind: 0 };
}
