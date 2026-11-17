// Plenty: what a town or a nation may spend on a building or a study, and what it must keep (one rule for every governor's
// and rival's purchase of a work or a study: governor.ts, townworks.ts's raisers, rule.ts, watchhouse.ts, inn.ts,
// studies.ts).
//
// A town buys bread with its goods when it is hungry (decrees.ts, alms), and its goods above a working stock are its
// nation's supplies (stores.ts): every work or study bought is bread and armies it cannot have later. Bought freely,
// they left towns hungry and the player short of armies (192 campaigns: a farmed town hungry 2% of its seasons; the
// player's wins 116 to 98). So a town spends on them only out of plenty:
//   - it lives by its fields (it has Farmland) and is not short of bread (under PLENTY.short a head in store);
//   - it wants for nothing more pressing that the caller knows of (a roof, a wall);
//   - after paying, it still holds `times` (PLENTY.works unless told) times what a town keeps, PLENTY.floor, in goods
//     other than its bread.
// A study is paid from the nation's towns, the teaching town first (studies.ts): the teaching town must pass the first
// two, and the nation hold `times` (PLENTY.studies) times the floor for each of its towns, in goods other than bread,
// after paying.
//
// Not under it: what answers a town's own want, the Farmland a hungry town raises and the Fortress a raided one does
// (governor.ts). Those are needs, not plenty: under this rule, the Fortress went up in a fifth fewer towns and raids got
// through more (192 campaigns: walled towns besieged 3405 to 2650, raids taken 14% to 16%).
//
// It imports nothing that imports it back: the governor reads its floor and its measure of short bread from here.
import type { Campaign } from './campaign';
import { STORE_KINDS, folkOf, headcount } from './township';
import type { Stores } from './township';

export const PLENTY = {
  /** What a town keeps in store whatever is bought (the governor's floor). */
  floor: 300,
  /** Food a head under which a town is short of bread (the governor's measure). */
  short: 32,
  /** How many floors a town keeps, after paying for a work, in goods other than bread. */
  works: 4,
  /** How many floors a town keeps after paying for a work of rule or faith, a rival's (rule.ts: a Hall, a Manor, a Monastery). */
  rule: 1,
  /** How many floors a nation keeps for each of its towns, after paying for a study. */
  studies: 2,
  /**
   * How many floors a nation keeps for each of its towns, after buying grain abroad for a hungry town (grain.ts): none. It
   * answers a want, as a town's Farmland does: the nation buys whenever it has the gold. At 1 floor a town, 57% of hungry
   * towns whose nation had the gold were refused (192 campaigns), and deaths from hunger were 1.1 a nation in twenty years;
   * at none, 0.6.
   */
  grain: 0,
};

/** A town's goods other than its bread. */
export const breadless = (s: Stores): number => STORE_KINDS.reduce((n, k) => n + (k === 'food' ? 0 : Math.max(0, s[k])), 0);
/** What a cost comes to, all kinds together. */
export const costOf = (cost: Partial<Record<string, number>>): number => STORE_KINDS.reduce((n, k) => n + (cost[k] ?? 0), 0);
/** Is a town short of bread: under PLENTY.short a head in store? */
export function shortOfBread(c: Campaign, tid: number): boolean {
  const f = folkOf(c, tid);
  return f.stores.food / Math.max(1, headcount(f)) < PLENTY.short;
}

/**
 * May a town spend this on a work? `wants`: anything more pressing the caller knows of (a roof, a wall); `times`: floors to
 * keep; `fields: false` and `bread: false` for a work that answers a want of the town's own, which waits for neither.
 */
export function canSpare(c: Campaign, tid: number, cost: Partial<Record<string, number>>, o: { wants?: { roof?: boolean; wall?: boolean }; times?: number; fields?: boolean; bread?: boolean } = {}): boolean {
  const t = c.territories[tid];
  if (!t || t.horde || t.owner < 0 || ((o.fields ?? true) && !t.buildings.includes('farm')) || ((o.bread ?? true) && shortOfBread(c, tid))) return false;
  if (o.wants?.roof || o.wants?.wall) return false;
  return breadless(folkOf(c, tid).stores) - costOf(cost) >= (o.times ?? PLENTY.works) * PLENTY.floor;
}

/**
 * May a nation learn a study taught at this town? The town lives by its fields and has bread; the nation keeps `times`
 * floors a town after paying. `town: false` for what answers a want of the town's own (grain bought for a hungry town,
 * grain.ts), which waits for neither its fields nor its bread.
 */
export function nationCanSpare(c: Campaign, f: number, at: number, cost: Partial<Record<string, number>>, times = PLENTY.studies, o: { town?: boolean } = {}): boolean {
  const t = c.territories[at];
  if (!t || t.owner !== f) return false;
  if ((o.town ?? true) && (!t.buildings.includes('farm') || shortOfBread(c, at))) return false;
  const mine = c.territories.filter((x) => x.owner === f && !x.horde);
  const goods = mine.reduce((n, x) => n + breadless(folkOf(c, x.id).stores), 0);
  return goods - costOf(cost) >= times * PLENTY.floor * mine.length;
}
