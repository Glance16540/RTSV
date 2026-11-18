/**
 * What a town's own men lose in a battle nobody watched (docs/DESIGN.md, "A town defends itself").
 *
 * The town's men are in the fight against a nation (militia.ts): where no army stands there they are its
 * companies on foot, and where one does they man the works behind it. The men who died of it used to be taken by
 * rule all the same: fifteen in a hundred of the town's men if it held and thirty if it fell (township.ts,
 * `TOLL`), whatever the fight had been. Here they follow the fight (mapbattle.ts):
 *
 *   - `menStood`: the men of the town who were in it. A wall has only so much room (`MILITIA.most`), so in a
 *     large town that is its first bands and the rest never came to blows.
 *   - `militiaFell`: of those, the share that fell. Where they were the town's companies, it is the share of the
 *     companies' strength lost in the fighting and in the rout (`SideOut.body`); where they manned the works
 *     behind an army, the share of the works beaten down (`SideOut.works`). A lost band is not all dead men:
 *     townsmen who break run for their own doors, so `FELL.dead` of a band lost is dead and the rest get home.
 *
 * So a town that drove the attack off at the first rush buries few, one that stood to the last round buries
 * many, one taken after its bands were ridden down buries most, and a town whose army did the fighting in front
 * of whole walls buries hardly any. A tribe's town, and a battle that was summed and not fought, are counted by
 * the old rule: `militiaFell` answers nothing for them.
 */
import type { Campaign } from './campaign';
import { armyAt } from './campaignbase';
import { MILITIA, militiaBands } from './militia';
import type { Outcome } from './mapbattle';
import { bandMen } from './tribes';
import { folkOf } from './township';

export const FELL = {
  /** Of the men of a band lost, the share who are dead; the rest ran for their own doors. */
  dead: 0.5,
};

/** The men of a town who are in its defence against a nation: its bands, as many as the walls have room for. */
export function menStood(c: Campaign, tid: number): number {
  const bands = militiaBands(c, tid);
  if (bands <= 0) return 0;
  return Math.min(Math.max(0, folkOf(c, tid).men), Math.round(Math.min(bands, MILITIA.most / MILITIA.worth) * bandMen()));
}

/**
 * The men of the town who fell in a battle fought out on the map, before anything is moved or changes hands.
 * Nothing (undefined) where the rule has no fight to follow: no battle was fought, or the land is no nation's.
 */
export function militiaFell(c: Campaign, tid: number, out: Outcome | null | undefined): number | undefined {
  const t = c.territories[tid];
  if (!out || !t || t.owner < 0 || t.horde) return undefined;
  const held = armyAt(c, tid), army = !!held && held.owner === t.owner;
  const asCompanies = !army && militiaBands(c, tid) >= 1; // as mapbattle.ts sets the sides out
  const share = asCompanies ? out.d.body ?? 0 : out.d.works;
  return Math.round(menStood(c, tid) * share * FELL.dead);
}
