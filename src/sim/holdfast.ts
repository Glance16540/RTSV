// A people about to rule beyond challenge holds what it has (docs/TUNING.md, pace: campaigns undecided at 200 seasons).
//
// One people rules beyond challenge when it has held most of the land ten turns running (campaign.ts checkDominion),
// and a single season under that share sets the count back to nothing. Read over 384 campaigns in each course, the
// campaigns still undecided after 200 seasons were not stalemates: their leaders took about ten lands each in the last
// forty seasons and lost two towns to their own risings for every one lost to a rival (conquered.ts: a town taken by
// force resents it, and without an army in it may rise). A third to a half of them had held the share needed, six to
// thirteen for five turns and more, several for nine of the ten, and then a taken town rose behind an army that had
// marched on to take another.
//
// So a people whose count is running stops taking new land until it is done (`holding`), and stands its armies where
// they do most to keep what it has (`holdStep`): an army in a town that would rise without it stays there; one in a
// quiet town goes, by its own lands, towards the nearest town of its people that might rise and has no army in it.
// A garrisoned town still rises now and then and is put down, as before; nothing about risings is changed.
// The computer's rivals keep to this, and so does a player the computer plays for (campaign.ts aiStep).
// A human player is told nothing new and bound by nothing: it is how a sensible ruler ends a war already won.
import type { Army, Campaign } from './campaign';
import { armyAt, reach } from './campaignbase';
import { revoltChance } from './conquered';

/** Is this people's count towards rule beyond challenge running? */
export const holding = (c: Campaign, f: number): boolean => c.phase !== 'over' && !!c.dominion && c.dominion.f === f && c.dominion.turns > 0;

/** How likely this town is to rise this season if no army of its holder stood in it. */
export const riseBare = (c: Campaign, tid: number): number => revoltChance(c, tid, { bare: true });

/** The towns of a people that might rise and have no army of its own in them, the likeliest first. */
export function restless(c: Campaign, f: number): number[] {
  return c.territories.filter((t) => t.owner === f && !t.horde && riseBare(c, t.id) > 0 && armyAt(c, t.id)?.owner !== f)
    .sort((a, b) => riseBare(c, b.id) - riseBare(c, a.id) || a.id - b.id).map((t) => t.id);
}

/**
 * Where an army of a people that is holding should go this turn: -1 to stand where it is (its town would rise
 * without it, or there is nowhere it is wanted that it can get to), else the next land of its own on the shortest
 * way to the nearest restless town with no army in it (the likelier to rise, of two as near).
 */
export function holdStep(c: Campaign, f: number, army: Army): number {
  if (c.territories[army.at]?.owner === f && riseBare(c, army.at) > 0) return -1;
  const want = new Set(restless(c, f));
  if (!want.size) return -1;
  const prev = new Map<number, number>([[army.at, -1]]);
  let ring = [army.at];
  while (ring.length) {
    const next: number[] = [];
    for (const cur of ring) for (const n of reach(c, cur)) {
      if (prev.has(n) || c.territories[n].owner !== f || c.territories[n].horde) continue;
      prev.set(n, cur); next.push(n);
    }
    const found = next.filter((n) => want.has(n)).sort((a, b) => riseBare(c, b) - riseBare(c, a) || a - b)[0];
    if (found !== undefined) { let s = found; while (prev.get(s) !== army.at) s = prev.get(s)!; return s; }
    ring = next;
  }
  return -1;
}
