// Bands on the march, and the armies they meet (docs/DESIGN.md: threats of men never stop, and live on the map).
// Three small rules that the bands' moving (bandroam.ts) and their coming against armies (bandfight.ts) read.
//
//   Along a road a band goes farther. A camp that has set out for a mark a few lands off goes a land a season over
//     wild country, but where a road runs (between two lands next to each other that peoples hold) it goes
//     on: up to MARCH.pace lands in a season. (Pirates already sail to any coast in one move.)
//   They make for what is rich as well as what is weak. When a camp weighs where to go, a mark with full stores
//     draws it more, by up to MARCH.rich; which town it strikes once there is still the softest (threats.ts).
//   An army is not always what it looks. One resting after it has stormed a town counts for MARCH.tired of its
//     strength to a band that weighs falling on it, and fights at that; one alone in a land that is not its
//     people's, with none of their armies in it or beside it, counts for MARCH.alone.
//   Armies see them coming. An army standing in or beside a land a band on the march passes through sees it, and
//     its people are told where the band is and where it is bound. If that is a town of theirs, the town is
//     warned as heralds would warn it (heralds.ts), a season before the band can strike.
//
// Plain data in, plain data out; the telling is the callers'. Strengths are first guesses.
import type { Army, Campaign } from './campaign';
import { resting } from './armytown';
import { STORE_KINDS, folkOf } from './township';
import { warn } from './heralds';

export const MARCH = {
  /** The most lands a band on the march goes in a season, the legs after the first only along a road. */
  pace: 2,
  /** How much more a mark with full stores draws a camp choosing where to go, and the stores that count as full. */
  rich: 1, richAt: 2000,
  /** What an army counts for to a band: resting after a storming, and alone in a land not its people's. */
  tired: 0.6, alone: 0.8,
};

/** Does a road run between these two lands: they are next to each other and each is held by some people (roads join towns)? */
export function onRoad(c: Campaign, from: number, to: number): boolean {
  const x = c.territories[from], y = c.territories[to];
  const held = (o: number): boolean => o >= 0 && !!c.factions[o]?.alive;
  return !!x && !!y && x.adj.includes(to) && held(x.owner) && held(y.owner);
}

/** How rich a town is to a band looking for where to go, 0 to 1: its stores of every kind against a full store. */
export function richness(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return 0;
  const s = folkOf(c, tid).stores;
  return Math.min(1, STORE_KINDS.reduce((k, x) => k + Math.max(0, s[x]), 0) / MARCH.richAt);
}
/** What a mark's lure is multiplied by for its riches. */
export const richLure = (c: Campaign, tid: number): number => 1 + MARCH.rich * richness(c, tid);

/** Is this army alone: in a land that is not its people's, with no other army of theirs in it or beside it? */
export function alone(c: Campaign, a: Army): boolean {
  const t = c.territories[a.at];
  if (!t || t.owner === a.owner) return false;
  const near = new Set([a.at, ...t.adj]);
  return !c.armies.some((x) => x !== a && x.owner === a.owner && near.has(x.at));
}
/** What share of its strength an army counts for to a band: less when it is resting after a storming, or alone. */
export const exposure = (c: Campaign, a: Army): number => (resting(c, a) ? MARCH.tired : 1) * (alone(c, a) ? MARCH.alone : 1);
/** Why an army is worth falling on, for the telling: '' if it is neither tired nor alone. */
export const exposedHow = (c: Campaign, a: Army): string => (resting(c, a) ? 'still resting after the storming' : alone(c, a) ? 'alone in a strange land' : '');

/** The armies that see a band pass: those standing in or beside any of these lands, one for each people, the nearest to the front of the list first. */
export function watchers(c: Campaign, path: number[]): Army[] {
  const seen: Army[] = [];
  for (const id of path) {
    const near = new Set([id, ...(c.territories[id]?.adj ?? [])]);
    for (const a of [...c.armies].sort((x, y) => x.id - y.id)) if (near.has(a.at) && c.factions[a.owner]?.alive && !seen.some((s) => s.owner === a.owner)) seen.push(a);
  }
  return seen;
}
/** A people whose army has seen a band bound for one of its own towns warns the town. Returns whether it was theirs to warn. */
export function warnBound(c: Campaign, owner: number, mark: number | undefined): boolean {
  if (mark === undefined || c.territories[mark]?.owner !== owner) return false;
  warn(c, mark);
  return true;
}
