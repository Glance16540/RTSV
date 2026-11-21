// The leader's call, and the leader's road (docs/DESIGN.md, "The leader is one person in one place": he can call armies
// to meet him and move with them as one; docs/CLOSING.md: "calling the armies calls all of them, strips every garrison
// on the way, and will not cross land not their own. A leader travels a land a turn with no cost or risk").
//
// court.ts keeps where the leader is and marches the armies that are called. It cannot ask who threatens a town, who is
// an ally or where the bands are without a ring of imports, so it takes those answers from here (court.ts `CALLING`):
//
//   Which armies. The leader may call armies by name (court.ts `callArmies(c, f, ids)`): those and no others. With none
//     named, every army is called but one that holds a town which needs it (`keepsGarrison`): the only army in a town of
//     its people's that would rise if left bare, or that a band has come upon (rivalrule.ts `wantsGarrison`, the same
//     rule by which a rival keeps its garrisons). Called by name, such an army comes all the same: that is the leader's
//     to decide.
//   Garrisons on the way. A called army no longer joins an army that is not called when it passes through its town (it
//     used to, and went no farther, or carried the garrison off with it): it goes through that land to the next in the
//     one march (court.ts `marchToward`).
//   Allied land. A called army may cross the land of its people's sworn ally the same way, without stopping in it
//     (`crossesAllied`): the player's armies an ally's, and the ally's the player's. A truce is not an alliance, and
//     nobody crosses on a truce.
//   The road's risk. A leader who travels alone, with no army, by a road highwaymen sit on (their road is the two lands
//     it joins) may be set upon (`LEADER_ROAD.met`): he is turned back to where he started with the season's travel
//     spent, and one time in `LEADER_ROAD.hurt` he is wounded getting away and is a rank the less for it. He is never
//     killed or taken on the road. Riding with an army he is in no danger from them: an army is met as an army is
//     (bandfight.ts).
//
// It registers itself with court.ts when it is loaded (campaign.ts imports it), and reads only the campaign's record.
import type { Army, Campaign } from './campaign';
import { CALLING } from './court';
import { wantsGarrison } from './rivalrule';

export const LEADER_ROAD = {
  /** The chance a leader travelling alone by a road highwaymen sit on is set upon, and, set upon, that he is wounded getting away. */
  met: 0.4, hurt: 0.25,
};

/** Does this army hold a town that needs it: the only army of its people's in a town of theirs that would rise left bare, or that a band is upon? */
export function keepsGarrison(c: Campaign, a: Army): boolean {
  const t = c.territories[a.at];
  if (!t || t.owner !== a.owner) return false;
  if (c.armies.some((x) => x.owner === a.owner && x.at === a.at && x.id !== a.id)) return false;
  return wantsGarrison(c, a.at);
}

/** May this people's armies cross this land without stopping in it? Only the land of their sworn ally. */
export function crossesAllied(c: Campaign, f: number, tid: number): boolean {
  const owner = c.territories[tid]?.owner ?? -1;
  if (owner < 0 || c.ally < 0 || owner === f) return false;
  return (f === 0 && owner === c.ally) || (f === c.ally && owner === 0);
}

/** A chance in [0, 1) from the campaign's seed, its season, a people and a number of its own. */
function draw(c: Campaign, f: number, salt: number): number {
  let h = (Math.imul((c.seed | 0) ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(c.turn + 0x632be5ab, 0x85ebca6b) ^ Math.imul(f * 977 + salt + 0x1b873593, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** The highwaymen who sit on the road between these two lands, if any: the strongest. */
export function roadBand(c: Campaign, from: number, to: number): { id: number; name: string; strength: number } | null {
  const on = (c.bands ?? []).filter((b) => b.kind === 'highwaymen' && b.to !== undefined && ((b.at === from && b.to === to) || (b.at === to && b.to === from)))
    .sort((x, y) => y.strength - x.strength || x.id - y.id)[0];
  return on ? { id: on.id, name: on.name, strength: on.strength } : null;
}
/** The chance a leader of this people travelling alone between these lands is set upon: 0 where no highwaymen sit on that road. */
export const roadRisk = (c: Campaign, from: number, to: number): number => (roadBand(c, from, to) ? LEADER_ROAD.met : 0);

/**
 * A leader travels alone from one land to another. Are they set upon and turned back? If so it is told, and they may be
 * wounded (a rank the less, never below none). Returns whether they were turned back.
 */
export function waylaidOnRoad(c: Campaign, f: number, from: number, to: number): boolean {
  const band = roadBand(c, from, to), fac = c.factions[f];
  if (!band || !fac || draw(c, f, 1) >= LEADER_ROAD.met) return false;
  const name = typeof fac.hero?.name === 'string' && fac.hero.name ? fac.hero.name : f === 0 ? 'Your leader' : `The leader of the ${fac.name}`;
  const hurt = draw(c, f, 2) < LEADER_ROAD.hurt && (fac.heroRank ?? 0) > 0;
  if (hurt) fac.heroRank = Math.max(0, (fac.heroRank ?? 0) - 1);
  const where = `on the road from ${c.territories[from].name} to ${c.territories[to].name}`;
  const Band = band.name[0].toUpperCase() + band.name.slice(1);
  if (f === 0) c.log.push(`🗡️ ${Band} set upon ${name} ${where}, travelling with no army. ${hurt ? 'They got away wounded, and are a rank the less for it' : 'They got away unhurt'}, and are back in ${c.territories[from].name}.`);
  else c.log.push(`${Band} set upon ${name} ${where}.`);
  return true;
}

CALLING.keeps = keepsGarrison;
CALLING.pass = crossesAllied;
CALLING.waylaid = waylaidOnRoad;
