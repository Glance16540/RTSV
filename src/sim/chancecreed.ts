// The older chance events of a turn go by creed (docs/DESIGN.md, "Acts of God": they fall harder on the decadent than on
// the holy, but spare nobody; docs/CLOSING.md, before the move, 7).
//
// Before famine, plague and fire fell on a town by its own standing (acts.ts `wrathAt`), a turn had its own chance
// events (campaign.ts `turnEvent`), and two of them are acts of God in all but name: fever in an army's camp, which costs
// it a company, and a hard season, which costs its holder supplies. They fell the same on every creed. Here they go by
// the same measure as the rest, the town's own (`wrathAt`: a third for the Righteous, a half for the Devout, 1 for an
// ordinary town, a quarter more for the Worldly, half again for the Decadent), each way it can be applied to them:
//   - How often. Below 1, the event passes the town by that share of the time: a Righteous town has it a third as often.
//     (Above 1 it cannot come oftener than the turn's one roll allows; the decadent have it harder instead.)
//   - How hard. A hard season costs 3 supplies times the measure, rounded: 1 from the Righteous, 2 from the Devout, 3 from an
//     ordinary town, 4 from the Worldly, 5 from the Decadent. A fever takes a second company from an army that can spare it,
//     above 1, that share of the time over: one time in four among the Worldly, one in two among the Decadent.
// An ordinary town is exactly as it was. The fine harvest, the volunteers and the raiders who burn a farm are not acts of
// God and are as they were.
//
// Its chances are a run of their own (the seed, the season, the land), so the campaign's own run of luck is not spent.
import type { Campaign } from './campaign';
import { wrathAt } from './acts';

export const CHANCE_CREED = {
  /** What a hard season costs an ordinary town's holder, in supplies. */
  hard: 3,
};

/** A chance in [0, 1) from the campaign's seed, its season, a land and a number of its own. */
function draw(c: Campaign, tid: number, salt: number): number {
  let h = (Math.imul((c.seed | 0) ^ 0x7ed55d16, 0x9e3779b1) ^ Math.imul(c.turn + 0x165667b1, 0x85ebca6b) ^ Math.imul(tid * 131 + salt + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Does this season's fever or hard season fall on this town at all? Always on an ordinary town or worse; on the holy, by their measure. */
export function befalls(c: Campaign, tid: number): boolean {
  const w = wrathAt(c, tid);
  return w >= 1 || draw(c, tid, 1) < w;
}
/** What a hard season costs this town's holder in supplies: by the town's measure, never nothing. */
export function hardCost(c: Campaign, tid: number): number {
  return Math.max(1, Math.round(CHANCE_CREED.hard * wrathAt(c, tid)));
}
/** The companies a fever in the camp takes from an army standing in this town: one, and among the worldly sometimes a second. */
export function feverToll(c: Campaign, tid: number): number {
  const w = wrathAt(c, tid);
  return w > 1 && draw(c, tid, 2) < w - 1 ? 2 : 1;
}
