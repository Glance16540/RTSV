// What a noble remembers (docs/DESIGN.md, "Relationships": nobles), beyond the decrees they hear of (nobles.ts) and
// what the leader does for or to them (nobledeal.ts).
//
// A noble's mood eases a fifth of the way back each season to where it settles (nobles.ts), so a decree they dislike
// is a grievance of a season or two. What happens to them over the years is remembered, and moves where it settles:
// their temper, a bond on the noble (nobles.ts, `bonds`, kind 'temper') that each season keeps all but TEMPER.fade of
// itself and takes in:
//   - War: the nation lost a town this season (TEMPER.lost) or won one (TEMPER.won), a martial noble twice as much.
//   - Their own town: struck by a band, plague or famine in the last season (TEMPER.struck), or a year quiet and fed
//     (TEMPER.quiet).
//   - The leader: at their town (court.ts), TEMPER.present; a lord the leader has neither come to nor dealt with for
//     TEMPER.neglectAfter seasons grows sour from neglect, TEMPER.neglect a season and more each year, up to TEMPER.most.
//     Half as much for the capital's lord, who lives at court (with every capital given a lord and the leader away with
//     the armies, capitals' lords were 70% of the angry and plots came once in 22 years; not at all, 21% were content).
//   - Taxes: a lord whose town's gold was taken for the nation's spending this season beyond TEMPER.taxedOver, not by
//     a band, TEMPER.taxed for each hundred. Not the capital's lord: the nation pays out of its capital first, and that
//     is the court's own purse.
// The temper is held within TEMPER.cap either way. It runs after the nobles' own season (campaign.ts).
// Plain data on the noble and the nation; nothing drawn.
import type { Campaign } from './campaign';
import type { Leaning, Noble } from './nobles';
import { noblesOf } from './nobles';
import { leaderAt } from './court';
import { folkOf } from './township';

declare module './nobles' {
  interface Noble {
    /** The last season the leader came to this noble's town or dealt with them (nobletemper.ts). */
    heeded?: number;
    /** Their town's gold as the last season ended, to see what the nation took from it (nobletemper.ts). */
    gold?: number;
  }
}
declare module './campaign' {
  interface Faction {
    /** The nation's towns as the last season ended (nobletemper.ts). */
    landWas?: number;
  }
}

export const TEMPER = {
  /** The share of a noble's temper that fades each season, and how far it may go either way. */
  fade: 0.05, cap: 80,
  /** A town lost or won this season, and a martial noble's again as much. */
  lost: -16, won: 10,
  /** Their town struck in the last season; quiet and fed for a year. */
  struck: -10, quiet: 3,
  /** The leader at their town, each season. */
  present: 6,
  /** Seasons without the leader's heed before neglect sours a lord; how much a season, growing by `grows` each year after, up to `most`. */
  neglectAfter: 4, neglect: 3, grows: 1, most: 6,
  /** Gold taken from a lord's town for the nation in a season beyond which they are sore; how sore for each hundred. */
  taxedOver: 60, taxed: 3,
};

const towns = (c: Campaign, f: number): number => c.territories.filter((t) => t.owner === f && !t.horde).length;
const struckSince = (c: Campaign, tid: number, since: number): boolean => (c.events ?? []).some((e) => e.at === tid && ['raid', 'carried', 'plague', 'famine'].includes(e.kind) && e.turn >= since);
const warlike = (l: Leaning): number => (l === 'martial' ? 2 : 1);

/** The leader has heeded this noble: come to their town, or dealt with them (nobledeal.ts calls it). */
export const heed = (c: Campaign, n: Noble): void => { n.heeded = c.turn; };

/** The nation's land this season against last: -1 lost, 1 won, 0 neither. Reads and then remembers it. */
export function warTurn(c: Campaign, f: number): number {
  const fac = c.factions[f], now = towns(c, f), was = fac?.landWas ?? now;
  if (fac) fac.landWas = now;
  return now < was ? -1 : now > was ? 1 : 0;
}

/** What a noble takes into their temper this season. `war` from warTurn. */
export function temperOf(c: Campaign, f: number, n: Noble, war: number): number {
  let by = 0;
  if (war < 0) by += TEMPER.lost * warlike(n.leaning);
  if (war > 0) by += TEMPER.won * warlike(n.leaning);
  const folk = folkOf(c, n.town);
  if (struckSince(c, n.town, c.turn - 1)) by += TEMPER.struck;
  else if (!folk.hungry && !struckSince(c, n.town, c.turn - 4)) by += TEMPER.quiet;
  if (leaderAt(c, f, n.town)) { n.heeded = c.turn; by += TEMPER.present; }
  n.heeded ??= c.turn;
  const unheeded = c.turn - n.heeded;
  const atCourt = c.territories[n.town]?.capital === f; // the capital's lord lives at court: neglect tells on him half as much
  if (n.rank === 'lord' && unheeded > TEMPER.neglectAfter) by -= (atCourt ? 0.5 : 1) * Math.min(TEMPER.most, TEMPER.neglect + TEMPER.grows * Math.floor((unheeded - TEMPER.neglectAfter) / 4));
  // Taxes: what the nation took of their town's gold since last season, beyond a band's share.
  const gold = Math.max(0, folk.stores.gold);
  if (n.rank === 'lord' && n.gold !== undefined && !struckSince(c, n.town, c.turn - 1) && c.territories[n.town]?.capital !== f) { // not the capital's: the court spends its own purse there
    const took = n.gold - gold;
    if (took > TEMPER.taxedOver) by -= TEMPER.taxed * (took / 100);
  }
  n.gold = gold;
  return by;
}

/** A noble's temper: what they remember, where it moves their mood's settling (a bond, nobles.ts). */
export const temperAt = (n: Noble): number => (n.bonds ?? []).find((b) => b.kind === 'temper')?.rest ?? 0;

/** A season of one nation's nobles' tempers. */
export function temperSeason(c: Campaign, f: number): void {
  if (!c.factions[f]?.alive) return;
  const war = warTurn(c, f);
  for (const n of noblesOf(c, f)) {
    const by = temperOf(c, f, n, war), bonds = (n.bonds ??= []);
    let b = bonds.find((x) => x.kind === 'temper');
    if (!b) { b = { kind: 'temper', turn: c.turn, rest: 0 }; bonds.push(b); }
    b.rest = Math.max(-TEMPER.cap, Math.min(TEMPER.cap, Math.round((b.rest * (1 - TEMPER.fade) + by) * 10) / 10));
  }
}
/** A season of every living nation's nobles' tempers. */
export function temperSeasons(c: Campaign): void {
  for (const x of c.factions) temperSeason(c, x.id);
}
