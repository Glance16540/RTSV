/**
 * Going to marry (docs/DESIGN.md, "People persist"). War takes men and raids take women, so a town can be left
 * with grown people of one sex only, or with very few of one, and such a town raises no children and dies with
 * its last old woman. Where its own people have towns that can spare them, the unmarried go to it to marry:
 * young men to a town of women, young women to a town of men. They go by road as a convoy does (convoys.ts), a
 * season on the way, through the people's own lands, and are of the town they come to from then on.
 *
 * Who is unmarried: the grown men a town has beyond its women, counting its men away with the armies as
 * husbands still, or the women it has beyond all its men. They are asked first, so no town is left short by its
 * own giving. To a town with no men at all, where no town of its people has an unmarried man, a town sends one
 * of the men it could have spared to an army (armytown.ts): war had made unmarried men too rare to be the rule. The numbers are small: `SUIT.go` at a time to a town, and
 * `SUIT.season` parties a people a season. Every nation's towns do it, the player's and a rival's; the player is
 * told. A town never draws while people are already on the road to it.
 */
import type { Campaign } from './campaign';
import { awayFrom, sparedMen } from './armytown';
import { roadBetween, sendConvoy } from './convoys';
import { folkOf, TOWN_SCALE } from './township';

export const SUIT = {
  /** A town is badly short of one sex when the other outnumbers it this many to one. */
  short: 3,
  /** The most who set out for one town at a time, and the most parties a people sends in a season. */
  go: 2 * TOWN_SCALE, season: 2,
  /** To a town with no men at all a town with no unmarried man sends this many of the men it could spare to an army (armytown.ts keeps it two men, and one for every other woman). */
  spared: 1 * TOWN_SCALE,
};
export type Sex = 'men' | 'women';
/** A town's grown men, those away with its armies among them, and its grown women. */
const both = (c: Campaign, tid: number): { men: number; women: number; home: number } => { const f = folkOf(c, tid); return { men: f.men + awayFrom(c, tid), women: f.women, home: f.men }; };
/** The sex a town wants for, and how many would go to it; nothing if it wants for neither. */
export function wantOf(c: Campaign, tid: number): { sex: Sex; n: number; none: boolean } | null {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return null;
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
  if (!t || t.owner < 0 || t.horde) return 0;
  const k = both(c, tid);
  return sex === 'men' ? Math.max(0, Math.min(k.men - k.women, k.home - 1)) : Math.max(0, Math.min(k.women - k.men, k.women - 1));
}
/** Whom a town could send to one that wants for this sex: its unmarried, or, to a town with no men at all, a man it could spare to an army. */
export function couldSend(c: Campaign, tid: number, sex: Sex, none: boolean): number {
  const free = unmarried(c, tid, sex);
  if (free > 0 || sex !== 'men' || !none) return free;
  const t = c.territories[tid];
  return t && t.owner >= 0 && !t.horde ? Math.min(SUIT.spared, sparedMen(c, tid)) : 0;
}
export interface Party { from: number; to: number; sex: Sex; n: number }
/**
 * A season of it for one people: its towns that want for men or women, the emptiest of them first, each draw
 * from the town with most unmarried to spare that has a road to it. Returns the parties that set out.
 */
export function suitorsOf(c: Campaign, f: number): Party[] {
  const out: Party[] = [];
  if (!c.factions[f]?.alive) return out;
  const own = c.territories.filter((t) => t.owner === f && !t.horde); // a town nobody has asked after yet is founded as it is asked (township.ts): one just taken is reached too
  if (own.length < 2) return out;
  const coming = new Set((c.convoys ?? []).filter((x) => x.owner === f && (x.cargo.men.length || x.cargo.women.length)).map((x) => x.to));
  const wants = own.map((t) => ({ t, w: wantOf(c, t.id) })).filter((x): x is { t: typeof own[number]; w: NonNullable<ReturnType<typeof wantOf>> } => !!x.w && !coming.has(x.t.id))
    .sort((a, b) => Number(b.w.none) - Number(a.w.none) || a.t.id - b.t.id);
  for (const { t, w } of wants) {
    if (out.length >= SUIT.season) break;
    const from = own.filter((d) => d.id !== t.id && couldSend(c, d.id, w.sex, w.none) > 0 && !wantOf(c, d.id) && roadBetween(c, f, d.id, t.id))
      .sort((a, b) => couldSend(c, b.id, w.sex, w.none) - couldSend(c, a.id, w.sex, w.none) || a.id - b.id)[0];
    if (!from) continue;
    const n = Math.min(w.n, couldSend(c, from.id, w.sex, w.none)), logged = c.log.length;
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
