/**
 * A rival that thinks as a people: what war costs its towns (docs/DESIGN.md, "Rivals live by the same rules").
 * A computer-led nation chose war by its armies alone. It now weighs how its towns are:
 * - their losses: those who fell with its armies or starved in the last year (ledger.ts), as a share of its people;
 * - their hunger: the share of its towns that are hungry (drift.ts);
 * - their unrest: the share that are resentful, near rising or beset by a band (rivalrule.ts, threatened).
 * Each is measured against the figure at which it alone makes a people weary (`WEARY`), and the three are added:
 * at 1 the people is weary of war.
 * - A people wants better odds the wearier it is (`wearyMargin`), so it begins fewer fights it might lose.
 * - A weary people sues for peace with the peoples it borders (`suePeace`). Another rival agrees if it is half
 *   as weary itself or is not clearly the stronger; the peace is a pact like a marriage's (pacts.ts), read by
 *   atTruce, and lasts `WEARY.peace` seasons. To the player it is an offer: for `WEARY.open` seasons a truce is
 *   theirs for the asking, at no price and sure (campaign.ts, offerTruce).
 * Plain data on the campaign. The computer plays by it for whoever it plays, but only a rival sues.
 */
import type { Campaign } from './campaign';
import { armyStrength, atTruce } from './campaignbase';
import { driftOf } from './drift';
import { atWarWith } from './feudwar';
import { swornPeace } from './pacts';
import { threatened } from './rivalrule';
import { creedLean } from './rivalworld';
import { headcount } from './township';

export const WEARY = {
  /** The share of its people lost to war and hunger in a year that alone makes a people weary. */
  losses: 0.04,
  /** The share of its towns hungry, and the share restless, that each alone makes it weary. */
  hungry: 0.5, restless: 0.6,
  /** Points of odds a weary people wants over what it wanted, for each point of weariness, and at most. */
  margin: 2, most: 4,
  /** Seasons a peace between two rivals lasts; seasons an offer to the player stands; seasons before a people sues the same people again. */
  peace: 8, open: 3, again: 10,
  /** A rival sued for peace agrees if it is this weary itself, or is not this many times as strong as the one suing. */
  agrees: 0.5, winning: 1.3,
  /** No people is weary, or sues, before this season. */
  from: 8,
};
declare module './campaign' {
  interface Campaign {
    /** Whom each people last sued for peace, and when (rivalweary.ts): keyed "suer:sued". */
    sued?: Record<string, number>;
  }
}
const towns = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f && !t.horde);

/** What makes up a people's weariness: the share of its people lost in the year, of its towns hungry, and of its towns restless. */
export function wearyOf(c: Campaign, f: number): { losses: number; hungry: number; restless: number } {
  const own = towns(c, f);
  if (!own.length) return { losses: 0, hungry: 0, restless: 0 };
  const people = own.reduce((n, t) => n + (t.folk ? headcount(t.folk) : 0), 0);
  const lost = (c.ledger ?? []).filter((e) => e.owner === f && (e.kind === 'fell' || e.kind === 'starved')).reduce((n, e) => n + e.n, 0);
  return {
    losses: people + lost > 0 ? lost / (people + lost) : 0,
    hungry: own.filter((t) => driftOf(c, t.id).hungry).length / own.length,
    restless: own.filter((t) => threatened(c, t.id)).length / own.length,
  };
}
/** How weary of war a people is: 1 and over is weary. */
export function weariness(c: Campaign, f: number): number {
  if (c.turn < WEARY.from) return 0;
  const w = wearyOf(c, f);
  return w.losses / WEARY.losses + w.hungry / WEARY.hungry + w.restless / WEARY.restless;
}
export const isWeary = (c: Campaign, f: number): boolean => weariness(c, f) >= 1;
/** The better odds a people wants before it marches, for what its towns have borne. */
export const wearyMargin = (c: Campaign, f: number): number => Math.min(WEARY.most, Math.round(WEARY.margin * weariness(c, f) * 10) / 10);

/** Are two rivals at peace by a peace one of them sued for? */
export const suedPeace = swornPeace;
/** Does this rival stand ready to give the player a truce for the asking? */
export const suesPlayer = (c: Campaign, f: number): boolean => { const at = c.sued?.[`${f}:0`]; return at !== undefined && c.turn - at <= WEARY.open && isWeary(c, f); };
const strength = (c: Campaign, f: number): number => c.armies.filter((a) => a.owner === f).reduce((n, a) => n + armyStrength(a), 0);
/** The peoples a people borders and is not at peace with. */
export function foesOf(c: Campaign, f: number): number[] {
  const seen = new Set<number>();
  for (const t of towns(c, f)) for (const n of t.adj) {
    const o = c.territories[n].owner;
    if (o >= 0 && o !== f && c.factions[o]?.alive && !atTruce(c, f, o)) seen.add(o);
  }
  return [...seen].sort((a, b) => a - b);
}
/** Would a rival sued for peace by another agree: weary enough itself, or not clearly the stronger; and where the two stand in faith counts. */
export function wouldAgree(c: Campaign, sued: number, suer: number): boolean {
  const lean = creedLean(c, sued, suer); // readier with a people of like standing, less ready with one far off (rivalworld.ts)
  return weariness(c, sued) >= WEARY.agrees * (1 - lean) || strength(c, sued) < strength(c, suer) * WEARY.winning * (1 + lean);
}
/**
 * A weary rival sues for peace with each people it borders, not oftener than every `WEARY.again` seasons each.
 * Returns the peoples it is now at peace with, and whether it made the player its offer.
 */
export function suePeace(c: Campaign, f: number): { peace: number[]; offered: boolean } {
  const out = { peace: [] as number[], offered: false };
  const me = c.factions[f];
  if (f <= 0 || !me?.isAI || !me.alive || !isWeary(c, f)) return out;
  const sued = (c.sued ??= {});
  for (const o of foesOf(c, f)) {
    const key = `${f}:${o}`;
    if (sued[key] !== undefined && c.turn - sued[key] < WEARY.again) continue;
    if (o === 0) {
      if (atWarWith(c, f) || c.honor < 0) continue; // a king at feud will not ask (feudwar.ts), and nobody asks an oathbreaker
      sued[key] = c.turn;
      out.offered = true;
      c.log.push(`${me.name} are weary of war and sue for peace: a truce is yours for the asking until turn ${c.turn + WEARY.open}.`);
      continue;
    }
    sued[key] = c.turn;
    if (!c.factions[o].isAI || !wouldAgree(c, o, f)) continue;
    (c.pacts ??= []).push({ kind: 'peace', a: f, b: o, since: c.turn, until: c.turn + WEARY.peace });
    out.peace.push(o);
    c.log.push(`${me.name}, weary of war, make peace with ${c.factions[o].name} until turn ${c.turn + WEARY.peace}.`);
  }
  for (const k of Object.keys(sued)) if (c.turn - sued[k] > WEARY.again) delete sued[k];
  return out;
}
/** A people's weariness in words, for whoever shows a rival's mind. */
export function wearyText(c: Campaign, f: number): string {
  if (!isWeary(c, f)) return '';
  const w = wearyOf(c, f);
  const most = [['their dead', w.losses / WEARY.losses], ['hunger', w.hungry / WEARY.hungry], ['unrest at home', w.restless / WEARY.restless]].sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
  return `They are weary of war: ${most} weighs on them.`;
}
