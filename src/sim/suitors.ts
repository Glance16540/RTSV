/**
 * Going to marry (docs/DESIGN.md, "People persist"). War takes men and raids take women, so a town can be left
 * with grown people of one sex only, or with very few of one, and such a town raises no children and dies with
 * its last old woman. Where its own people have towns that can spare them, the unmarried go to it to marry:
 * young men to a town of women, young women to a town of men. They go by road as a convoy does (convoys.ts), a
 * season on the way, through the people's own lands, and are of the town they come to from then on.
 *
 * Who is unmarried: the grown men a town has beyond its women, counting its men away with the armies as
 * husbands still, or the women it has beyond all its men. Only they are asked, so no town gives up a husband or a
 * wife and no town is left short by its own giving. The numbers are small: `SUIT.go` at a time to a town, and
 * `SUIT.season` parties a people a season. Every nation's towns do it, the player's and a rival's; the player is
 * told. A town never draws while people are already on the road to it.
 */
import type { Campaign } from './campaign';
import { awayFrom } from './armytown';
import { roadBetween, sendConvoy } from './convoys';
import { folkOf } from './township';

export const SUIT = {
  /** A town is badly short of one sex when the other outnumbers it this many to one. */
  short: 3,
  /** The most who set out for one town at a time, and the most parties a people sends in a season. */
  go: 2, season: 2,
};
export type Sex = 'men' | 'women';
/** A town's grown men, those away with its armies among them, and its grown women. */
const both = (c: Campaign, tid: number): { men: number; women: number; home: number } => { const f = folkOf(c, tid); return { men: f.men + awayFrom(c, tid), women: f.women, home: f.men }; };
/** The sex a town wants for, and how many would go to it; nothing if it wants for neither. */
export function wantOf(c: Campaign, tid: number): { sex: Sex; n: number; none: boolean } | null {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || !t.folk) return null;
  const k = both(c, tid);
  if (k.men + k.women === 0) return null; // nobody there to marry
  if (k.men === 0) return { sex: 'men', n: Math.min(SUIT.go, k.women), none: true };
  if (k.women === 0) return { sex: 'women', n: Math.min(SUIT.go, k.men), none: true };
  if (k.women >= k.men * SUIT.short) return { sex: 'men', n: 1, none: false };
  if (k.men >= k.women * SUIT.short) return { sex: 'women', n: 1, none: false };
  return null;
}
/** The unmarried a town could send of this sex: those beyond the other sex, and never its last at home. */
export function unmarried(c: Campaign, tid: number, sex: Sex): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || !t.folk) return 0;
  const k = both(c, tid);
  return sex === 'men' ? Math.max(0, Math.min(k.men - k.women, k.home - 1)) : Math.max(0, Math.min(k.women - k.men, k.women - 1));
}
export interface Party { from: number; to: number; sex: Sex; n: number }
/**
 * A season of it for one people: its towns that want for men or women, the emptiest of them first, each draw
 * from the town with most unmarried to spare that has a road to it. Returns the parties that set out.
 */
export function suitorsOf(c: Campaign, f: number): Party[] {
  const out: Party[] = [];
  if (!c.factions[f]?.alive) return out;
  const own = c.territories.filter((t) => t.owner === f && !t.horde && t.folk);
  if (own.length < 2) return out;
  const coming = new Set((c.convoys ?? []).filter((x) => x.owner === f && (x.cargo.men.length || x.cargo.women.length)).map((x) => x.to));
  const wants = own.map((t) => ({ t, w: wantOf(c, t.id) })).filter((x): x is { t: typeof own[number]; w: NonNullable<ReturnType<typeof wantOf>> } => !!x.w && !coming.has(x.t.id))
    .sort((a, b) => Number(b.w.none) - Number(a.w.none) || a.t.id - b.t.id);
  for (const { t, w } of wants) {
    if (out.length >= SUIT.season) break;
    const from = own.filter((d) => d.id !== t.id && unmarried(c, d.id, w.sex) > 0 && !wantOf(c, d.id) && roadBetween(c, f, d.id, t.id))
      .sort((a, b) => unmarried(c, b.id, w.sex) - unmarried(c, a.id, w.sex) || a.id - b.id)[0];
    if (!from) continue;
    const n = Math.min(w.n, unmarried(c, from.id, w.sex)), logged = c.log.length;
    if (!sendConvoy(c, f, from.id, t.id, w.sex === 'men' ? { men: n } : { women: n })) continue;
    if (f === 0) { // the player is told why they go, in place of the convoy's plain line
      c.log.length = logged;
      c.log.push(`${n === 1 ? (w.sex === 'men' ? 'A young man' : 'A young woman') : `${n} young ${w.sex}`} of ${from.name} ${n === 1 ? 'has' : 'have'} set out for ${t.name} to marry: ${w.none ? `it has no ${w.sex} at all` : `it has few ${w.sex}`}. ${n === 1 ? (w.sex === 'men' ? 'He' : 'She') : 'They'} will come in next season.`);
    }
    out.push({ from: from.id, to: t.id, sex: w.sex, n });
  }
  return out;
}
/** A season of going to marry for every people. */
export function suitorsSeason(c: Campaign): Party[] {
  return c.factions.flatMap((f) => suitorsOf(c, f.id));
}
/** What a town wants for, in words; nothing if it wants for neither. */
export function wantText(c: Campaign, tid: number): string {
  const w = wantOf(c, tid);
  if (!w) return '';
  return w.none ? `It has no ${w.sex} at all: unmarried ${w.sex} of your other towns will come to marry, where a town can spare them and a road leads here.` : `It has few ${w.sex}: an unmarried ${w.sex === 'men' ? 'man' : 'woman'} of your other towns may come to marry.`;
}
