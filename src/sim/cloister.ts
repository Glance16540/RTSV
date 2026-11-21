// Who serves in a Monastery or Convent, on the map (docs/CLOSING.md, "A Monastery or Convent": on the map it kept no
// count of who serves in it, so the work of monks and nuns, clergywork.ts, could act only in a town's streets).
//
// Once a season every town with a Monastery or Convent standing keeps a count of those who serve in it
// (`Folk.cloister`): as many as a town's Monastery takes in its streets (CLOISTER.most, six), but never more than one
// in CLOISTER.per of the town's grown men and women, so that a hamlet is not emptied into it. They are men and women
// in the town's own proportion, the more of whichever the town has the more: a Convent where the women are the more.
// They are still the town's people, counted as before; the count says only who of them serves. Where none stands,
// none serves.
//
// What they do on the map is clergywork.ts's split, at CLOISTER.share of its effect in a town:
//   - nuns nurse: where an Infirmary stands too, each nun makes plague take NUNS.each x CLOISTER.share fewer of those
//     it would have taken (acts.ts), to NUNS.most x CLOISTER.share at most;
//   - monks copy and teach: each monk makes a study learned in the town cost as if it went MONKS.each x CLOISTER.share
//     the faster (studies.ts), to MONKS.most x CLOISTER.share at most.
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Folk } from './township';
import { MONKS, NUNS } from './clergywork';
import { standing } from './townrecord';

declare module './township' {
  interface Folk { /** Those who serve in the town's Monastery or Convent (cloister.ts). */ cloister?: { monks: number; nuns: number } }
}

export const CLOISTER = {
  /** The most who serve in one, as in a town; one in so many of the town's grown at most; the share of a town's effect they have on the map. */
  most: 6, per: 5, share: 0.5,
};

/** Who would serve in a Monastery in a town of these people. */
export function servingIn(f: Pick<Folk, 'men' | 'women'>): { monks: number; nuns: number } {
  const men = Math.max(0, f.men), women = Math.max(0, f.women), all = men + women;
  const n = Math.min(CLOISTER.most, Math.floor(all / CLOISTER.per));
  if (n <= 0) return { monks: 0, nuns: 0 };
  // In the town's own proportion, the odd one to whichever the town has the more of.
  const exact = (n * women) / all, nuns = women > men ? Math.ceil(exact) : Math.floor(exact);
  return { monks: n - nuns, nuns };
}

/** Once a season: who serves in each town's Monastery or Convent. Returns how many serve in all. */
export function cloisterSeason(c: Campaign): number {
  let all = 0;
  for (const t of c.territories) {
    const f = t.folk;
    if (!f) continue;
    const k = standing(c, t.id, 'monastery') ? servingIn(f) : { monks: 0, nuns: 0 };
    if (k.monks + k.nuns) { f.cloister = k; all += k.monks + k.nuns; } else delete f.cloister;
  }
  return all;
}

/** Those who serve in this town's Monastery as the record has them: nobody where none stands. */
export function cloisterOf(c: Campaign, tid: number): { monks: number; nuns: number } {
  const k = c.territories[tid]?.folk?.cloister;
  if (!k || !standing(c, tid, 'monastery')) return { monks: 0, nuns: 0 };
  return { monks: Math.max(0, Math.round(Number(k.monks) || 0)), nuns: Math.max(0, Math.round(Number(k.nuns) || 0)) };
}

/** How much of what plague would take in this town it takes, for its nuns nursing: 1 with none, or no Infirmary to nurse in. */
export const nunsNurseMap = (c: Campaign, tid: number): number =>
  standing(c, tid, 'infirmary') ? 1 - CLOISTER.share * Math.min(NUNS.most, NUNS.each * cloisterOf(c, tid).nuns) : 1;

/** How much faster a study learned in this town goes, for its monks: 1 with none. */
export const monksTeachMap = (c: Campaign, tid: number): number => 1 + CLOISTER.share * Math.min(MONKS.most, MONKS.each * cloisterOf(c, tid).monks);

/** A study's cost learned in this town: as if it went the faster for its monks (each kind rounded up). */
export function taughtCost<T extends Partial<Record<string, number>>>(c: Campaign, tid: number, cost: T): T {
  const k = monksTeachMap(c, tid);
  if (k === 1) return cost;
  const out: Partial<Record<string, number>> = {};
  for (const [r, v] of Object.entries(cost)) if (v !== undefined) out[r] = Math.ceil(v / k);
  return out as T;
}
