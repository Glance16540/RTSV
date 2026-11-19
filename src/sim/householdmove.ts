// A household leaves a town together (the board's "People move between towns": only the youngest couple went, and never
// the old; a whole household with its old did not move). migration.ts decides that a family goes and where; this says who
// goes with them and keeps their record through the move:
//   - who: the couple of working age, their children (as counts on the roll: a child is never a figure on the map), up
//     to HOUSEHOLD.children, and one of the town's old, its youngest, where the town has any and keeps MIGRATE.keep;
//   - a known family (a woman the town knows by name, migration.ts) goes as her house: her record goes with her
//     (convoys.ts sendFamily), and so does the record of her house's men at war (warhouse.ts `Folk.houses`), so that its
//     name, its fallen and what its men have won are kept in the town it goes to;
//   - a man at war is still of his house (docs/DESIGN.md, household.ts): where the man of the house is away with an army,
//     his wife and children go without him, and his place on the army's roll is moved to the house's new town as it comes
//     in, so that he comes home to it. Nothing is moved while they are on the road: the old town keeps the house and his
//     place on the roll until the household is in (warhouse.ts levels the two town by town each season).
// Plain data; it reads the town's record and the armies' rolls and moves entries between towns.
import type { Campaign } from './campaign';
import type { Folk, Notable } from './township';
import { folkOf } from './township';

export const HOUSEHOLD = {
  /** Children who go with a household, at most. */
  children: 3,
  /** Old people who go with it, at most. */
  old: 1,
};

/** The record of a house's men at war, as warhouse.ts keeps it (only what is read here). */
interface HouseRec { family: string; away?: { name: string; as: string; army?: number }[] }
const housesOf = (f: Folk): HouseRec[] => (Array.isArray((f as { houses?: unknown }).houses) ? (f as unknown as { houses: HouseRec[] }).houses : []);

/**
 * Who of a town goes as a household: a couple, their children, an old one, and the house's name where it is a known one.
 * `known`: the town's known person going with them, if any. `keep`: grown people the town keeps whatever goes. Null if
 * the town cannot spare a couple.
 */
export function householdOf(c: Campaign, tid: number, o: { known?: Notable; keep: number }): { men: number; women: number; children: number; old: number; family?: string } | null {
  const f = folkOf(c, tid), family = o.known?.family;
  const house = family ? housesOf(f).find((h) => h.family === family) : undefined;
  const away = !!house?.away?.some((s) => s.as === 'husband'); // the man of the house is with an army: he stays of it, and comes home to where it is
  const men = away ? 0 : 1, women = 1;
  if (f.women < women + 1 || f.men < men + 1 || f.men + f.women + f.elders - men - women < o.keep) return null;
  const old = f.elders > 0 && f.men + f.women + f.elders - men - women - 1 >= o.keep ? Math.min(HOUSEHOLD.old, f.elders) : 0;
  const kids = Math.min(f.children, Math.max(HOUSEHOLD.children - (o.known ? 0 : 1), o.known?.kids ? Math.min(HOUSEHOLD.children, o.known.kids) : 0));
  return { men, women, children: kids, old, ...(house ? { family: house.family } : {}) };
}

/**
 * A household has come in from `from` to `at`: its house's record of its men at war goes from the town it left to this
 * one, and each of its men away has his place on his army's roll moved with it. Returns how many men's places moved.
 */
export function houseArrives(c: Campaign, from: number, at: number, family: string): number {
  if (from === at) return 0;
  const was = c.territories[from]?.folk, now = folkOf(c, at);
  if (!was) return 0;
  const list = housesOf(was), i = list.findIndex((h) => h.family === family);
  if (i < 0) return 0;
  const [house] = list.splice(i, 1);
  const here = ((now as { houses?: HouseRec[] }).houses ??= []);
  const same = here.find((h) => h.family === family);
  if (same) { // a house of the same name there already: one house, its lists and what its men have won taken together
    const a = same as unknown as Record<string, unknown>, b = house as unknown as Record<string, unknown>;
    for (const k of Object.keys(b)) if (Array.isArray(b[k])) a[k] = [...((a[k] as unknown[]) ?? []), ...(b[k] as unknown[])]; else if (typeof b[k] === 'number') a[k] = ((a[k] as number) ?? 0) + (b[k] as number);
  } else here.push(house);
  let moved = 0;
  for (const s of house.away ?? []) {
    const roll = s.army !== undefined ? c.musters?.[s.army] : undefined;
    const ages = roll?.men[from];
    if (!roll || !ages?.length) continue;
    const age = ages.pop()!;
    if (!ages.length) delete roll.men[from];
    (roll.men[at] ??= []).push(age);
    moved++;
  }
  return moved;
}
