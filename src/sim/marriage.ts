// Marriages on the map (docs/DESIGN.md, "People persist": the Widows row's "the map knows no marriages but these").
//
// A town keeps how many of its grown men and women are married (`Folk.wed`, couples). Births come of couples
// (seasonfolk.ts, `couplesOf`): a man and a woman under a roof who are married, no longer any man and woman.
//   - A town first asked after counts as married every pair it can make (as the map always reckoned it).
//   - When a husband or a wife dies, is carried off or goes to war for good, the couple is gone: the count is never more
//     than the town's men or its women at home.
//   - Each season the unmarried of a town (its grown men and women beyond those married: the young come of age, the
//     widowed after their mourning) marry: MARRY.rate of the pairs they make, one at least.
//   - Where a town has unmarried men and no unmarried woman, and a town of its people beside it, by a road of their
//     own, has unmarried women and no unmarried man (or the other way about), the youngest of them goes to the other to
//     marry, with their age, at most MARRY.across a people a season. A town never gives its last of a sex. (Sent as a
//     convoy, a season on the road, the campaigns ruined or left undecided read 12.5% at 192, against 4.2% without; gone
//     at once by the road, 5.2% and 4.7%.) Where a town wants badly for one sex, suitors.ts sends more.
//   - The player is told, a line a season at most, of the couples wed in their towns, by the name of a known house of
//     the town where it has one.
// Never a child: only the grown marry, and children are not moved.
import type { Campaign } from './campaign';
import type { Folk } from './township';
import { folkOf, living } from './township';
import { roadBetween } from './convoys';
import { agesOf, countFrom } from './ageing';

declare module './township' {
  interface Folk {
    /** How many of the town's grown men and women are married couples (marriage.ts). */
    wed?: number;
  }
}

export const MARRY = {
  /** The share of the pairs the unmarried of a town make that marry in a season (one at least). */
  rate: 0.5,
  /** The most who go to a town beside to marry, for a people in a season. */
  across: 2,
};

/** The married couples of a town: as reckoned from the start, never more than its men or its women at home. */
export function wedOf(f: Folk): number {
  const most = Math.min(f.men, f.women);
  if (f.wed === undefined) f.wed = most;
  if (f.wed > most) f.wed = most;
  return f.wed;
}
/** A town's unmarried grown men and women. */
export const singles = (f: Folk): { men: number; women: number } => { const w = wedOf(f); return { men: f.men - w, women: f.women - w }; };

const roll = (c: Campaign, tid: number, salt: number): number => {
  let h = Math.imul(c.seed ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(c.turn + tid * 131, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** A season of marrying in one town. Returns how many couples wed. */
export function marryIn(c: Campaign, tid: number): number {
  const f = folkOf(c, tid), s = singles(f), pairs = Math.min(s.men, s.women);
  if (pairs <= 0) return 0;
  const n = Math.max(1, Math.floor(pairs * MARRY.rate));
  f.wed = wedOf(f) + n;
  return n;
}

/** A season of a people's unmarried going to a town beside to marry. Returns the parties that set out. */
export function marryAcross(c: Campaign, p: number): { from: number; to: number; sex: 'men' | 'women' }[] {
  const out: { from: number; to: number; sex: 'men' | 'women' }[] = [];
  const own = c.territories.filter((t) => t.owner === p && !t.horde);
  const coming = new Set((c.convoys ?? []).filter((x) => x.owner === p && (x.cargo.men.length || x.cargo.women.length)).map((x) => x.to));
  for (const t of own) {
    if (out.length >= MARRY.across) break;
    const a = singles(folkOf(c, t.id));
    if (coming.has(t.id) || !((a.men > 0 && a.women === 0) || (a.women > 0 && a.men === 0))) continue;
    const sex: 'men' | 'women' = a.men > 0 ? 'women' : 'men'; // what this town wants
    const from = own.filter((d) => d.id !== t.id && t.adj.includes(d.id) && !coming.has(d.id)).find((d) => {
      const k = folkOf(c, d.id), b = singles(k);
      return b[sex] > 0 && b[sex === 'men' ? 'women' : 'men'] === 0 && k[sex] > 1 && roadBetween(c, p, d.id, t.id);
    });
    if (!from) continue;
    { const fa = folkOf(c, from.id), ta = folkOf(c, t.id), A = agesOf(c, from.id, fa), B = agesOf(c, t.id, ta), k = sex === 'men' ? 'm' : 'f'; if (!A[k].length) continue; A[k].sort((x, y) => x - y); B[k].push(A[k].shift()!); countFrom(fa, A); countFrom(ta, B); }
    if (p === 0) { c.log.push(`A young ${sex === 'men' ? 'man' : 'woman'} of ${from.name} has gone to ${t.name} to marry there.`); }
    out.push({ from: from.id, to: t.id, sex });
    coming.add(t.id);
  }
  return out;
}

/** A season of marriages in every held town, and of the unmarried going to marry. The player is told in a line. */
export function marriageSeason(c: Campaign): void {
  const told: { name: string; n: number; house?: string }[] = [];
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive) continue;
    const n = marryIn(c, t.id);
    if (n && t.owner === 0) {
      const known = living(folkOf(c, t.id)).map((x) => x.family).filter((x): x is string => !!x);
      told.push({ name: t.name, n, ...(known.length ? { house: known[Math.floor(roll(c, t.id, 7) * known.length)] } : {}) });
    }
  }
  for (const x of c.factions) if (x.alive) marryAcross(c, x.id);
  if (told.length) {
    const first = told.find((x) => x.house) ?? told[0], all = told.reduce((k, x) => k + x.n, 0);
    c.log.push(`${all === 1 ? 'A couple has' : `${all} couples have`} wed in your towns this season${first.house ? `, a son or daughter of the house of ${first.house} at ${first.name} among them` : ''}.`);
  }
}
