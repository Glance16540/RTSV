// A rival people marches to hunt a band (docs/DESIGN.md, "Threats of men never stop": there is always order to keep and
// something to fight; docs/CLOSING.md: "rival peoples hunt a band only with an army already beside it, and never march
// to one, even to get their own back before the time runs out. Rival leaders ignore the marauders on the map").
//
// Until now a computer people fought a band only if an army of its own already stood at the band's place or beside it
// (bandfight.ts `huntBands`). An army two lands off sat still while the band held its people until they were past
// getting back, or robbed the same town season after season. Here it marches:
//
//   The cause. A band is this people's business if it holds their people (threats.ts `held`), or has its place in a land
//     of theirs (highwaymen: either end of their road).
//   The army. One that is theirs to order this season (not marched, not holding a town that wants its garrison:
//     rivalrule.ts has pinned those already), standing in their own land, and strong enough to go after the band by the
//     odds `huntBands` will ask when it gets there (FIGHT.theirs, shortening as their people's seasons run out,
//     rivalcaptives.ts; FIGHT.hunt for a band that only sits in their land). For a band that only sits in their land,
//     never an army at the front: the war comes first. For their own people, any army.
//   The march. By the people's own lands, a land a season, to the nearest land of theirs at the band's place or beside
//     it, where `huntBands` gives battle as the season turns. For their own people it sets out only if it can be there
//     before their time is up, and from no farther than HUNT.far lands; for a band in their land, from no farther than
//     HUNT.near. The nearest army goes, the stronger of two as near; one army to a band, one band to an army.
//
//   The marauders are not fought this way: they hold a land and are fought by marching into it (bandhorde.ts). A rival
//     already weighs such a land with the others it could march on (rivalaim.ts). `maraudersFirst` puts first, of the lands
//     it could march on, a camp that holds its people in their last seasons (as rivalcaptives.ts does for a nation that
//     carried them off), and next a camp that has struck a town of its own within HUNT.grudge seasons. Whether it dares
//     the march is still decided by the fight.
//
// Nobody is conjured: the army is one the people has, and what it loses it loses (bandfight.ts). It reads the campaign's
// record and moves an army through the hub's own rule for a march (campaignbase.ts HUB).
import type { Army, Campaign } from './campaign';
import { HUB, armyStrength } from './campaignbase';
import { FIGHT } from './bandfight';
import { outOf } from './rim';
import { onFrontier } from './reckon';
import { bandOdds, RIVAL_CLOCK } from './rivalcaptives';
import type { Band } from './threats';
import { THREATS } from './threatsbase';

export const HUNT = {
  /** How many lands off an army will set out from to get its own people back, and to clear a band out of its people's land. */
  far: 4, near: 2,
  /** A camp of the marauders that has struck a town of this people within so many seasons is marched on before other lands. */
  grudge: 8,
};

const placeOf = (b: Band): number[] => (b.to === undefined ? [b.at] : [b.at, b.to]);
/** The fewest seasons left to those of this people a band holds; Infinity if it holds none of theirs. */
export function heldBy(c: Campaign, b: Band, f: number): number {
  let least = Infinity;
  for (const h of b.held) if (h.owner === f && h.men.length + h.women.length > 0) least = Math.min(least, Math.max(0, THREATS.holdFor - (c.turn - h.since)));
  return least;
}
/** Why a band is this people's business: it holds their people ('theirs'), or has its place in their land ('land'); '' if it is not. */
export function causeOf(c: Campaign, b: Band, f: number): '' | 'theirs' | 'land' {
  if (b.kind === 'marauders') return '';
  if (Number.isFinite(heldBy(c, b, f))) return 'theirs';
  return placeOf(b).some((id) => c.territories[id]?.owner === f) ? 'land' : '';
}
/** The lands of this people from which the band can be given battle: its place or beside it, and theirs (bandfight.ts huntBands). */
export function huntFrom(c: Campaign, b: Band, f: number): number[] {
  const near = new Set(placeOf(b).flatMap((id) => [id, ...outOf(c, id)]));
  return [...near].filter((id) => c.territories[id]?.owner === f).sort((x, y) => x - y);
}
/** The way through a people's own lands from one of them to the nearest of `goals`: how many lands, and the first step; null if there is none within `most`. */
export function wayThrough(c: Campaign, f: number, from: number, goals: readonly number[], most: number): { steps: number; next: number } | null {
  if (goals.includes(from)) return { steps: 0, next: from };
  const seen = new Map<number, number>([[from, from]]); // a land, and the first step that led to it
  let edge = [from];
  for (let d = 1; d <= most && edge.length; d++) {
    const next: number[] = [];
    for (const at of edge) for (const n of [...c.territories[at].adj].sort((x, y) => x - y)) {
      if (seen.has(n) || c.territories[n].owner !== f) continue;
      seen.set(n, at === from ? n : seen.get(at)!);
      if (goals.includes(n)) return { steps: d, next: seen.get(n)! };
      next.push(n);
    }
    edge = next;
  }
  return null;
}
/** The odds this people's army must have to go after the band when it gets there, as `huntBands` asks them. */
const oddsFor = (c: Campaign, b: Band, f: number, cause: 'theirs' | 'land'): number => (cause === 'theirs' ? bandOdds(c, b.held.filter((h) => h.owner === f), FIGHT.theirs) : FIGHT.hunt);

/**
 * A computer people's armies march for the bands that are its business. Called in its turn, after its garrisons are
 * set (rivalrule.ts) and before it marches to war. Returns the marches begun, each an army, its band and where it went.
 */
export function rivalHunts(c: Campaign, f: number): { army: number; band: number; to: number; cause: 'theirs' | 'land' }[] {
  const out: { army: number; band: number; to: number; cause: 'theirs' | 'land' }[] = [];
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return out;
  const sent = new Set<number>();
  // Their own people first, the shortest time left first; then the bands that sit in their land, the strongest first.
  const bands = (c.bands ?? []).map((b) => ({ b, cause: causeOf(c, b, f), left: heldBy(c, b, f) })).filter((x) => x.cause)
    .sort((x, y) => (x.cause === y.cause ? 0 : x.cause === 'theirs' ? -1 : 1) || x.left - y.left || y.b.strength - x.b.strength || x.b.id - y.b.id);
  for (const { b, cause, left } of bands) {
    const goals = huntFrom(c, b, f);
    if (!goals.length || cause === '') continue;
    const need = b.strength * oddsFor(c, b, f, cause);
    const able = (a: Army): boolean => a.owner === f && c.territories[a.at]?.owner === f && armyStrength(a, c) >= need;
    if (c.armies.some((a) => able(a) && goals.includes(a.at))) continue; // one is there already: the season's hunt will find the band
    const most = cause === 'theirs' ? Math.min(HUNT.far, left) : HUNT.near;
    const ways = c.armies.filter((a) => able(a) && !a.moved && !sent.has(a.id) && (cause === 'theirs' || !onFrontier(c, f, a.at)))
      .map((a) => ({ a, way: wayThrough(c, f, a.at, goals, most) })).filter((x): x is { a: Army; way: { steps: number; next: number } } => !!x.way && x.way.steps > 0)
      .sort((x, y) => x.way.steps - y.way.steps || armyStrength(y.a, c) - armyStrength(x.a, c) || x.a.id - y.a.id);
    const go = ways[0];
    if (!go || HUB.moveArmy(c, go.a.id, go.way.next) !== 'moved') continue;
    go.a.moved = true;
    sent.add(go.a.id);
    out.push({ army: go.a.id, band: b.id, to: go.way.next, cause });
  }
  return out;
}

/**
 * Of the lands a people could march on, in the order it wants them: a camp of the marauders that holds its people in
 * their last seasons first (the fewest left first), then a camp that has struck a town of its own of late; the rest as
 * they were.
 */
export function maraudersFirst(c: Campaign, f: number, targets: readonly number[]): number[] {
  const rank = (id: number): number => {
    const t = c.territories[id];
    if (!t?.horde) return 2;
    const camp = (c.bands ?? []).find((b) => b.kind === 'marauders' && b.at === id);
    if (!camp) return 2;
    let left = Infinity;
    for (const h of camp.held) if (h.owner === f && h.men.length + h.women.length > 0) left = Math.min(left, Math.max(0, THREATS.holdFor - (c.turn - h.since)));
    if (left <= RIVAL_CLOCK.last) return left / 10; // 0, 0.1, 0.2: before everything, the fewest left first
    const struck = (c.raids ?? []).some((r) => r.band === camp.id && r.owner === f && c.turn - r.turn <= HUNT.grudge);
    return struck ? 1 : 2;
  };
  return targets.map((id, i) => ({ id, i, k: rank(id) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.id);
}
