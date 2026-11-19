// Bands from the far wilds (docs/DESIGN.md: "bands come from the far wilds", the owner's word, 17 November 2026).
//
// Some bands are born in the wild lands at the map's edge and march in from afar toward rich or weak towns, so
// that a people can see them coming.
//
//   Where. The far wilds are the lands that began wild and are still empty (wilds.ts, founding.ts; bandmarch.ts
//     `farWilds`): far or poor ground, snow, desert, the map's edge, with no tribe and no town. When
//     a new camp of raiders or slavers is to appear and there are such lands with a way in from them, WILDS.share
//     of the time it is born there instead of beside a town.
//   The march. It picks its mark as any camp weighs where to go (bandroam.ts: soft walls, full stores, the seasons'
//     march), but looking as far as MARCH.long lands, and sets out at once. It goes a land a season over wild
//     country and farther along a road, and strikes nobody until it is there.
//   Seen coming. Nobody is told when it gathers. Armies and towns in or beside the lands it passes see it and
//     their peoples are told where it is and where it is bound (bandroam.ts `marchOn`); a people who keep Heralds
//     hear of its mark seasons ahead (raidnews.ts).
//   Met on the way. An army at its place or beside it can be ordered against it as against any band; a computer
//     people's army goes out to meet a band on the march as soon as it comes beside their land (bandfight.ts).
//
// A record of each march is kept (bandmarch.ts `March`): where from, where bound, when first seen, when it
// arrived, whether an army met it before it struck anyone. The health report reads it.
import type { Campaign } from './campaign';
import type { Band, BandKind } from './threats';
import { chance, defenceOf, note, softest, reachOf } from './threats';
import { MARCH, WILDS, farWilds, marched, townsThatSee, warnBound } from './bandmarch';
import { marksFrom, wayTo } from './bandroam';

/** The way in a camp born at this land would take: its mark's place, how far, and how soft; null if there is none. */
export function wayIn(c: Campaign, at: number, kind: BandKind = 'raiders'): { bound: number; steps: number } | null {
  const probe: Band = { id: -1, kind, name: '', at, strength: 1, since: c.turn, held: [] };
  const way = wayTo(c, probe, MARCH.long);
  return way && way.steps > 1 ? { bound: way.bound, steps: way.steps } : null;
}

/**
 * The way in a host out of the wilds would take, weighing its marks as such a host does (WILDS.near, WILDS.deep): the
 * softest and richest town it can come within reach of in MARCH.long lands, with no reckoning of the march; and of the
 * places nearly as good, the farthest, some of the time. Never a place it need not march to (one land off). `salt`
 * draws the chance.
 */
export function deepWay(c: Campaign, at: number, kind: BandKind = 'raiders', salt = 0): { bound: number; steps: number } | null {
  const probe: Band = { id: -1, kind, name: '', at, strength: 1, since: c.turn, held: [] };
  const all = marksFrom(c, probe, MARCH.long).filter((w) => w.steps > 1).sort((x, y) => y.lure - x.lure || x.steps - y.steps || x.bound - y.bound);
  if (!all.length) return null;
  const good = all.filter((w) => w.lure >= all[0].lure * WILDS.near);
  const far = [...good].sort((x, y) => y.steps - x.steps || y.lure - x.lure || x.bound - y.bound)[0];
  const pick = chance(c, salt, 67) < WILDS.deep ? far : all[0];
  return { bound: pick.bound, steps: pick.steps };
}

/**
 * The way a host born at this land would come in, or null if none is born there. A land is somewhere to come FROM where
 * the host has a long way in (WILDS.far lands or more, by `deepWay`), or where even the nearest soft town is a march away
 * (`wayIn`, as it always was). A rim land with a town to rob one land off and nothing deep worth the march breeds no
 * host: a camp there would only step over the border. (Without this, every rim land with any town two lands off bred
 * them: 6.5 a campaign at 384, and two marches in three still of two lands.)
 */
export function comesFrom(c: Campaign, at: number, kind: BandKind = 'raiders', salt = 0): { bound: number; steps: number } | null {
  const deep = deepWay(c, at, kind, salt);
  if (!deep) return null;
  return deep.steps >= WILDS.far || wayIn(c, at, kind) ? deep : null;
}

/** For a march's record: how deep the town it means to strike lies from where it was born, and what that town has to meet it with. */
export function markOf(c: Campaign, from: number, way: { bound: number; steps: number }, kind: BandKind): { depth: number; meets: number } {
  const probe: Band = { id: -1, kind, name: '', at: way.bound, strength: 1, since: c.turn, held: [] };
  const mark = softest(c, probe, reachOf(c, probe))?.id;
  if (mark === undefined) return { depth: way.steps, meets: 0 };
  return { depth: way.steps + (mark === way.bound ? 0 : 1), meets: defenceOf(c, mark).total };
}

/** Where in the far wilds a new camp of this kind is born this season, if it is to be: [land], or null for the common places. */
export function farPlace(c: Campaign, kind: BandKind): [number] | null {
  if (kind !== 'raiders' && kind !== 'slavers') return null;
  const salt = 701 + (c.bandSeq ?? 0);
  if (chance(c, salt, 53) >= WILDS.share) return null;
  // A host out of the wilds weighs its marks its own way (`deepWay`); the band about to be born will be the next in number.
  const next = (c.bandSeq ?? 0) + 1, ways = farWilds(c).map((id) => ({ id, way: comesFrom(c, id, kind, next) })).filter((x) => x.way);
  if (!ways.length) return null;
  // Those with a long way in are taken first (WILDS.far): there is the country, and a host should come out of the depth of it.
  const far = ways.filter((x) => x.way!.steps >= WILDS.far), wilds = (far.length ? far : ways).map((x) => x.id);
  return [wilds[Math.floor(chance(c, salt, 59) * wilds.length)]];
}

/** A band just born: if it stands in the far wilds with a way in, it sets out. Returns whether it did. */
export function setOutFromAfar(c: Campaign, b: Band): boolean {
  if ((b.kind !== 'raiders' && b.kind !== 'slavers') || c.territories[b.at].owner >= 0 || !c.territories[b.at].wild) return false;
  const way = comesFrom(c, b.at, b.kind, b.id); // drawn by the richest mark, not the nearest
  if (!way) return false;
  b.bound = way.bound; b.afar = true; b.moved = c.turn;
  if (c.territories[b.at].rim) b.gathers = c.turn + WILDS.gather; // in the rim it gathers a season first, and is seen (`seenGathering`)
  const deep = wayIn(c, b.at, b.kind); // report only, kept for a release: the march the old weighing (the nearest soft mark) would have made
  (c.marches ??= []).push({ band: b.id, born: c.turn, from: b.at, bound: way.bound, lands: way.steps, ...markOf(c, b.at, way, b.kind), ...(deep ? { would: { lands: deep.steps, ...markOf(c, b.at, deep, b.kind) } } : {}) });
  return true;
}

/**
 * A camp gathering in the rim of wilderness is seen by the towns within two lands of it: their peoples are told where
 * it is and where it is bound, and a people whose town is its mark warns that town. Returns how many peoples saw it.
 */
export function seenGathering(c: Campaign, b: Band, out: string[]): number {
  if (b.gathers === undefined || !c.territories[b.at]?.rim) return 0;
  const mark = softest(c, b, reachOf(c, { ...b, at: b.bound ?? b.at }))?.id, see = townsThatSee(c, [b.at]);
  for (const t of see) {
    const theirs = warnBound(c, t.owner, mark);
    note(c, out, 'seen', b, b.at, `${t.owner === 0 ? 'Your people' : 'The people'} at ${c.territories[t.at].name} have seen fires in ${c.territories[b.at].name}: ${b.name} are gathering there${b.bound !== undefined ? `, and will make for ${c.territories[b.bound].name}` : ''}${theirs && mark !== undefined ? `. Word is sent to ${c.territories[mark].name}` : ''}.`, [t.owner]);
    marched(c, b.id, 'seen');
  }
  return see.length;
}
