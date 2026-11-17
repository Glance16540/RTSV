// The Granary (docs/DESIGN.md, "Buildings and research that answer the systems": "a Granary keeps food against a
// failed harvest, so a town goes hungry later and drifts less in famine").
//
// On the map it is a building on the town's record (townworks.ts: raised from the map, finished by the governor), and
// counts once it stands finished. It keeps grain dry and safe, so:
//   - what a town lays by spoils later: GRANARY.keep more seasons of its own eating are kept from spoiling
//     (larder.ts asks `granaryKeeps`);
//   - a failed harvest eats less of the store: the town draws only GRANARY.famine of what it would have drawn
//     (acts.ts asks `famineShare`).
// So a town with one has more in store when the bad year comes, and less of it goes. It goes hungry later, and
// since drift answers hunger (drift.ts reads the larder), it drifts less in a famine. Nothing else is changed.
//
// The governor raises one (`granaryWanted`) where the town lives by its fields, has known a failed harvest or
// hunger lately, has a place free, and can pay for it without going below what he keeps. Rivals' towns have
// governors too, so rivals raise them by the same rule.
//
// In a town (a battle or a visit) a finished Granary makes a bare store take GRANARY.grace times as long to turn
// to hunger and to famine (famine.ts asks `famineGrace`).
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { folkOf } from './township';
import { onRecord as begunAt, standing as standsAt } from './townrecord';

export const GRANARY = {
  /** Seasons of a town's own eating kept from spoiling, beyond what the larder keeps without one. */
  keep: 1,
  /** The share of a failed harvest's draw on the store that a town with a granary still makes. */
  famine: 0.6,
  /** How many seasons back a failed harvest, or hunger, makes a governor want one. */
  recall: 8,
  /** In a town: how many times as long a bare store takes to turn to hunger and to famine. */
  grace: 2,
};

/** Whether a Granary stands finished on the town's record. */
export const hasGranary = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'granary');
/** Seasons of eating beyond the larder's own that a town's granary keeps from spoiling (larder.ts). */
export const granaryKeeps = (c: Campaign, tid: number): number => (hasGranary(c, tid) ? GRANARY.keep : 0);
/** The share of a failed harvest's draw on the store that this town makes (acts.ts): less with a granary. */
export const famineShare = (c: Campaign, tid: number): number => (hasGranary(c, tid) ? GRANARY.famine : 1);

/** Whether the governor wants a Granary here: a town of fields that has lately gone hungry or lost a harvest, and has none. */
export function granaryWanted(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || begunAt(c, tid, 'granary') || !t.buildings.includes('farm')) return false;
  const lately = (c.events ?? []).some((e) => e.at === tid && e.kind === 'famine' && e.turn > c.turn - GRANARY.recall);
  return lately || !!folkOf(c, tid).hungry;
}

/** In a town: how many times as long a bare store takes to turn to hunger and to famine for this people (famine.ts). */
export function famineGrace(g: Game, owner: number): number {
  return g.buildings.some((b) => !b.dead && b.owner === owner && b.type === 'granary' && b.complete) ? GRANARY.grace : 1;
}
