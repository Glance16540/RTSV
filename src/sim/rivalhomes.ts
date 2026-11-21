// A rival's notable homes, by which house did most (docs/CLOSING.md, "A woman whose home produces most": a rival's
// notable homes were named by rule, one to a town, not by which house did most). Nobody visits a rival's town, so no
// house of it is ever seen carrying in its goods; so the map keeps the count for it. Each season the food a rival's town
// reaped (harvest.ts, noted by larderwatch.ts) is shared among its working houses, each by its own share of the work (the
// same for that town every season, by the world's seed), and counted to them as notableweight.ts counts a house's output:
// food from the fields at FIELD_WEIGHT. A house whose count comes to MADE_RENOWN, in a town with children enough, is a
// notable home: the house that has done most first, up to RIVAL_HOMES.most known homes to a town.
// Plain data: a count by house on the town's record (`Folk.made`).
import type { Campaign } from './campaign';
import { MADE_RENOWN, madeWorth } from './notableweight';
import { houseNames, townPeople } from './peoplenames';
import type { Notable } from './township';
import { folkOf } from './township';

declare module './township' {
  interface Folk {
    /** What each working house of a rival's town has carried in, by its family name, and the turn last counted (rivalhomes.ts). */
    made?: Record<string, number>; madeAt?: number;
  }
}

export const RIVAL_HOMES = {
  /** Working houses a town's harvest is shared among. */
  houses: 5,
  /** Known homes a rival's town may have. */
  most: 3,
};

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

/** A town's working houses and each one's share of the work: the same for the town every season. */
export function workingHouses(c: Campaign, tid: number): { family: string; share: number }[] {
  const all = houseNames(townPeople(c, tid));
  if (!all.length) return [];
  const start = Math.floor(hash(c.seed * 7 + tid, 3) * all.length), n = Math.min(RIVAL_HOMES.houses, all.length);
  const picked = Array.from({ length: n }, (_, i) => all[(start + i) % all.length]);
  const weight = picked.map((_, i) => 0.5 + hash(c.seed * 11 + tid, 17 + i));
  const sum = weight.reduce((a, b) => a + b, 0);
  return picked.map((family, i) => ({ family, share: weight[i] / sum }));
}

/** Count this season's harvest to the town's houses, once a season. Returns the goods counted. */
export function creditHouses(c: Campaign, tid: number): number {
  const f = folkOf(c, tid), r = f.reaped;
  if (!r || r.turn < c.turn - 1 || f.madeAt === r.turn || r.food <= 0) return 0;
  const made = (f.made ??= {});
  for (const h of workingHouses(c, tid)) made[h.family] = (made[h.family] ?? 0) + madeWorth(r.food * h.share, true);
  f.madeAt = r.turn;
  return r.food;
}

/** The house next to be a known home: the one that has done most of those not known yet, if it has done enough. */
export function homeDue(c: Campaign, tid: number): { family: string; made: number } | undefined {
  const f = folkOf(c, tid), known = new Set(f.notables.filter((n: Notable) => n.kind === 'mother' && !n.lost && n.family).map((n) => n.family!));
  if (f.notables.filter((n) => n.kind === 'mother' && !n.lost).length >= RIVAL_HOMES.most) return undefined;
  const best = Object.entries(f.made ?? {}).filter(([fam, m]) => !known.has(fam) && m >= MADE_RENOWN).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? { family: best[0], made: Math.round(best[1]) } : undefined;
}
