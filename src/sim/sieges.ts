// A siege that nobody watches (docs/TUNING.md: a town with walls or a fortress and men to hold them should hold
// most of the time, not every time).
//
// When a battle over a town is settled on the map, each side's strength is weighed with a throw of the dice
// (campaign.ts `resolvePending`). Walls did count, but only as so much strength added to the defence, which the
// attacker also counted before he marched: so he came only when he had the numbers, and nearly always won.
// Here walls are worth more than their sum to those who stand on them. A town that is walled (a Fortress on the
// land, or towers or walls standing on its battlefield) and manned (an army of its holder's in it, or grown men of
// its own) has its defence multiplied by SIEGE.walls when the dice are thrown. The attacker does not know this
// when he weighs his chances, which is what makes storming walls the gamble it should be.
//
// It does not touch a field battle, a land of the local tribes, or a battle fought out in person.
import type { Campaign, Pending } from './campaign';
import { BUILDINGS } from './data';
import { folkOf } from './township';

export const SIEGE = {
  /** How many times its counted strength a walled and manned town's defence is worth when an unwatched siege is settled. */
  walls: 2.1,
};

/** Has this land walls: a Fortress, or towers or walls standing (finished) on its battlefield? */
export function walled(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  return t.buildings.includes('fortress') || !!t.town?.b.some((b) => b[4] === undefined && (b[0] === 'tower' || !!BUILDINGS[b[0]]?.wall));
}
/** Has it men to hold them: an army of its holder's standing there, or grown men of the town? */
export function manned(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  return t.owner >= 0 && (c.armies.some((a) => a.at === tid && a.owner === t.owner) || folkOf(c, tid).men > 0);
}
/** What the defence of this pending battle is multiplied by when it is settled unwatched: SIEGE.walls for a walled, manned town, else 1. */
export function wallsEdge(c: Campaign, p: Pending): number {
  if (p.defender < 0 || p.mode === 'field' || p.band !== undefined) return 1;
  return walled(c, p.to) && manned(c, p.to) ? SIEGE.walls : 1;
}
