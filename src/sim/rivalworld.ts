/**
 * A rival that thinks as a people: the world it lives in (docs/DESIGN.md, "Rivals live by the same rules"). A
 * computer-led nation chose its wars and its treaties as if the map were bare. It now takes account of:
 * - a named place (places.ts): a land that holds one is the more worth having as a war aim (rivalplan.ts);
 * - plague: a land with plague in it is not worth setting its heart on while it lasts (aiplague.ts marches on
 *   such a land last already);
 * - creed: the towns of a people that stands far from where it stands are the more readily warred on, and it is
 *   readier to treat with a people of like standing than with one far off (campaign.ts offerTruce,
 *   rivalweary.ts wouldAgree);
 * - winter: it wants better odds to march into a land where winter sits, since an army that marches in winter
 *   lies snowbound the season after (winter.ts);
 * - what is befalling the world (story.ts): in the Long Winter it wants better odds everywhere, and in the
 *   Season of Iron, when companies come cheap, it will take worse.
 * Figures only: this module decides nothing by itself.
 */
import type { Campaign } from './campaign';
import { biomeOf } from './campaignbase';
import { sickAt } from './aiplague';
import { placeAt, worldNow } from './places';
import { nationVirtue } from './townfaith';
import { wintersIn } from './winter';

export const WORLD = {
  /** What a named place adds to a land's worth as a war aim, and what plague in it takes off. */
  place: 4, plague: 8,
  /** What it adds to wanting a town that its people stands at the far end of faith (a gap of 100 between the two peoples). */
  creed: 2,
  /** Points of odds more it wants to march into a land where winter sits; more in the Long Winter, anywhere; fewer in the Season of Iron. */
  winter: 1.5, longWinter: 1, iron: 1,
  /** Two peoples no further apart in standing than `near` are readier to treat by `kin`; `apart` or more, less ready by `stranger`. */
  near: 30, apart: 100, kin: 0.15, stranger: 0.15,
};
/** How far two peoples stand from one another in faith, 0 to 200. A tribe or nobody stands with everyone. */
export function creedGap(c: Campaign, a: number, b: number): number {
  if (a < 0 || b < 0 || a === b || !c.factions[a] || !c.factions[b]) return 0;
  return Math.abs(nationVirtue(c, a) - nationVirtue(c, b));
}
/** What the world adds to or takes from a land's worth as a war aim for a people. */
export function worldWorth(c: Campaign, f: number, tid: number): number {
  const t = c.territories[tid];
  return (placeAt(c, tid) ? WORLD.place : 0) - (sickAt(c, tid) ? WORLD.plague : 0) + WORLD.creed * (creedGap(c, f, t.owner) / 100);
}
/** The better (or worse) odds a people wants to march into a land, for the season and for what is befalling the world. */
export function worldMargin(c: Campaign, to: number): number {
  const world = worldNow(c);
  return (wintersIn(c, biomeOf(c, to)) ? WORLD.winter : 0) + (world === 'winter' ? WORLD.longWinter : 0) - (world === 'iron' ? WORLD.iron : 0);
}
/** How much readier (over 0) or less ready (under 0) two peoples are to treat, for where each stands. */
export function creedLean(c: Campaign, a: number, b: number): number {
  const gap = creedGap(c, a, b);
  return gap <= WORLD.near ? WORLD.kin : gap >= WORLD.apart ? -WORLD.stranger : 0;
}
/** The world as a people weighs it, in words, for whoever shows a rival's mind. */
export function worldText(c: Campaign, f: number, tid: number): string {
  const t = c.territories[tid], said: string[] = [];
  if (placeAt(c, tid)) said.push(`${placeAt(c, tid)!.name} lies there`);
  if (sickAt(c, tid)) said.push('there is plague in it');
  if (wintersIn(c, biomeOf(c, tid))) said.push('winter sits on it');
  if (creedGap(c, f, t.owner) >= WORLD.apart) said.push('its people keep a faith far from theirs');
  return said.join(', ');
}
