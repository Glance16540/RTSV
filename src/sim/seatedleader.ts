// A leader alone in an ungarrisoned town is counted when the battle for it is settled on the map (docs/DESIGN.md, "The
// leader is one person in one place": in a town or with an army, and steadies the town he is in; docs/CLOSING.md).
//
// A battle fought in person already puts the leader on the field where they sit in a town with no army of their own
// there (campaign.ts battleConfig, the leader in an ungarrisoned town), and the map's tale already says they led it
// (mapbattle.ts whoLed). But the fight settled on the map counted a leader only riding with the defending army, so a
// leader holding a town alone was not in it: the town held no longer for them. Now the defender's side is led by them,
// at their rank, as an army's is (mapbattle.ts CLASH.led and CLASH.rank: a side with its leader breaks later).
// Only the defender: an attacker's leader is with the army that marched, or not there at all.
// Plain data: it reads where the court is (court.ts) and writes the defender's force.
import type { Campaign, Pending } from './campaign';
import { leaderAt } from './court';

/** The part of a side's force a leader changes: whether one leads it, and their rank. */
export interface Led { led?: boolean; rank?: number }

/** Is the defender's leader sitting in the town fought over, with no army of theirs there to ride with? */
export const seatedAlone = (c: Campaign, p: Pick<Pending, 'defender' | 'to'>): boolean =>
  p.defender >= 0 && leaderAt(c, p.defender, p.to) && !c.armies.some((a) => a.owner === p.defender && a.at === p.to && a.hero);

/** The defender's side as it fights on the map: led by its leader, at their rank, where they sit in the town alone. Returns whether it changed. */
export function seatLeader(c: Campaign, p: Pick<Pending, 'defender' | 'to'>, d: Led): boolean {
  if (d.led || !seatedAlone(c, p)) return false;
  d.led = true;
  d.rank = c.factions[p.defender]?.heroRank ?? 0;
  return true;
}
