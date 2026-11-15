/**
 * Where a rival marches (docs/DESIGN.md, "The map is the game"). A computer-led nation used to march on the
 * softest land in reach and nothing more. It still wants a land it can take, but it now weighs what it is
 * marching into and what it would be taking:
 * - the country's march: an army attacking into marsh or desert fights weaker, and onto steppe stronger
 *   (country.ts), so the same walls are harder or easier than they look;
 * - the country's yield: thin country is worth less than good ploughland, and less again for what it costs to hold;
 * - the town's faith: a town that stands far from where the nation stands (townfaith.ts) pulls the nation's own
 *   standing apart and is slow to settle, so it is the less wanted the further off it is. A tribe's town, which
 *   stands in the middle, is weighed the same way.
 * The lower the figure the more the land is wanted. Whether the army dares the march is still decided on its
 * strength against the defence (campaign.ts), with the country's march now counted there too.
 */
import type { Campaign } from './campaign';
import { countryOf, countryYield } from './country';
import { faithAt, nationVirtue } from './townfaith';

export const AIM = {
  /** Points of defence a supply of the country's yield each turn is worth to the one who takes it. */
  yield: 1,
  /** Points of defence it costs to want a town at the far end of faith from one's own (a gap of 100). */
  faith: 1.5,
};
/** How an army fares attacking into this country: under 1 weaker, over 1 stronger. */
export const marchInto = (c: Campaign, tid: number): number => countryOf(c, tid).march;
/** How far a town stands from where this nation stands, 0 to 200. */
export const faithGap = (c: Campaign, f: number, tid: number): number => Math.abs(faithAt(c, tid) - nationVirtue(c, f));
/** What a land is to a nation thinking of marching on it, given its defence: the lower, the more it is wanted. */
export function aimAt(c: Campaign, f: number, tid: number, defence: number): number {
  return defence / Math.max(0.5, marchInto(c, tid)) - AIM.yield * countryYield(c, tid) + AIM.faith * (faithGap(c, f, tid) / 100);
}
/** The lands a nation could march on, the most wanted first. `defenceOf` is the defence the army would meet at each. */
export function aimOrder(c: Campaign, f: number, lands: readonly number[], defenceOf: (tid: number) => number): number[] {
  return lands.map((id, i) => ({ id, i, aim: aimAt(c, f, id, defenceOf(id)) })).sort((a, b) => a.aim - b.aim || a.i - b.i).map((x) => x.id);
}
/** Why a land is weighed as it is, in words: for whoever shows a rival's mind. */
export function aimText(c: Campaign, f: number, tid: number): string {
  const m = marchInto(c, tid), y = countryYield(c, tid), gap = faithGap(c, f, tid);
  const said = [m < 1 ? 'a hard march' : m > 1 ? 'open ground' : '', y > 0 ? 'good country' : y < 0 ? 'thin country' : '', gap >= 60 ? 'a faith far from theirs' : gap <= 15 ? 'a faith like theirs' : ''].filter(Boolean);
  return said.join(', ');
}

/**
 * An army stands on a border with nothing in reach it dares to march on. Somewhere else along its people's own
 * lands there may be a border where it would dare: it goes there, a land a season. Returns the first step of the
 * shortest way through its own lands to such a place, or -1 if there is none within `REDEPLOY` lands (or it
 * stands in one already). `daresFrom`: would this army dare any march from that land? `reachOf`: the lands an
 * army can go to from a land.
 */
export const REDEPLOY = 6;
export function redeploy(c: Campaign, f: number, from: number, daresFrom: (land: number) => boolean, reachOf: (land: number) => number[]): number {
  if (daresFrom(from)) return -1;
  const first = new Map<number, number>([[from, -1]]), depth = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if ((depth.get(cur) ?? 0) >= REDEPLOY) continue;
    for (const n of reachOf(cur)) {
      if (first.has(n) || c.territories[n]?.owner !== f) continue;
      first.set(n, cur === from ? n : first.get(cur)!);
      depth.set(n, (depth.get(cur) ?? 0) + 1);
      if (daresFrom(n)) return first.get(n)!;
      queue.push(n);
    }
  }
  return -1;
}
