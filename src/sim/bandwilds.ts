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
import { chance, note, softest, reachOf } from './threats';
import { MARCH, WILDS, farWilds, marched, townsThatSee, warnBound } from './bandmarch';
import { wayTo } from './bandroam';

/** The way in a camp born at this land would take: its mark's place, how far, and how soft; null if there is none. */
export function wayIn(c: Campaign, at: number, kind: BandKind = 'raiders'): { bound: number; steps: number } | null {
  const probe: Band = { id: -1, kind, name: '', at, strength: 1, since: c.turn, held: [] };
  const way = wayTo(c, probe, MARCH.long);
  return way && way.steps > 1 ? { bound: way.bound, steps: way.steps } : null;
}

/** Where in the far wilds a new camp of this kind is born this season, if it is to be: [land], or null for the common places. */
export function farPlace(c: Campaign, kind: BandKind): [number] | null {
  if (kind !== 'raiders' && kind !== 'slavers') return null;
  const salt = 701 + (c.bandSeq ?? 0);
  if (chance(c, salt, 53) >= WILDS.share) return null;
  const wilds = farWilds(c).filter((id) => wayIn(c, id, kind));
  if (!wilds.length) return null;
  return [wilds[Math.floor(chance(c, salt, 59) * wilds.length)]];
}

/** A band just born: if it stands in the far wilds with a way in, it sets out. Returns whether it did. */
export function setOutFromAfar(c: Campaign, b: Band): boolean {
  if ((b.kind !== 'raiders' && b.kind !== 'slavers') || c.territories[b.at].owner >= 0 || !c.territories[b.at].wild) return false;
  const way = wayIn(c, b.at, b.kind);
  if (!way) return false;
  b.bound = way.bound; b.afar = true; b.moved = c.turn;
  if (c.territories[b.at].rim) b.gathers = c.turn + WILDS.gather; // in the rim it gathers a season first, and is seen (`seenGathering`)
  (c.marches ??= []).push({ band: b.id, born: c.turn, from: b.at, bound: way.bound, lands: way.steps });
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
