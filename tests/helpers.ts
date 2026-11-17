// What every test file needs to set a battle going. New tests go in a file of their own beside this one
// (tests/<feature>.test.ts) and take these from here, so that two branches never add to the same file.
import { Building, Game } from '../src/sim/game';

export const setups = [
  { name: 'A', color: 0x3366ff, isAI: false },
  { name: 'B', color: 0xff3333, isAI: true, civ: 'hearth' }, // a settled people: the raiders have tests of their own
];
export const run = (g: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds * 20; i++) { g.step(); if (each && i % 20 === 0) each(); }
};
export const villagers = (g: Game, owner: number) => g.units.filter((u) => u.owner === owner && u.type === 'villager');
/** Find a free spot for a building near the player's town center. */
export const spot = (g: Game, type: string, owner: number) => {
  const tc = g.buildings.find((b) => b.owner === owner)!;
  for (let r = 4; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (g.canPlace(type, tc.cx + dx, tc.cy + dy)) return { cx: tc.cx + dx, cy: tc.cy + dy };
  throw new Error('no spot');
};
/**
 * A soldier is made of a villager (src/sim/muster.ts): stand `n` men at a building's door, ready to be trained there.
 * For tests that are about something else and only need soldiers to come out of a building.
 */
export const menAt = (g: Game, owner: number, n: number, by: Building) =>
  Array.from({ length: n }, (_, i) => g.spawnUnit('villager', owner, by.x - (n - 1) * 0.3 + i * 0.6, by.y + by.size / 2 + 0.8, 'm'));

import { newCampaign } from '../src/sim/campaign';
/**
 * A campaign whose first armies have no roll, as every campaign began before the army a people begins with was
 * made its chief town's own men (src/sim/armytown.ts, foundingMuster; tests/foundingarmy.test.ts is about that).
 * For tests written about something else, which raise into the first army or sweep it away and count the town's
 * men: with it they would be counting six founding men as well.
 */
export const bareCampaign = (...args: Parameters<typeof newCampaign>): ReturnType<typeof newCampaign> => {
  const c = newCampaign(...args);
  c.musters = {};
  for (const t of c.territories) if (t.folk) delete t.folk.houses;
  return c;
};

import { MEN } from '../src/sim/armytown';
/**
 * Let a people send every man it can spare, as it did before it sent a quarter at the most (src/sim/armytown.ts,
 * MEN.share; tests/levyshare.test.ts is about that). For a test file written about something else, which raises
 * several companies out of one small town and counts two men gone for each. Call it once at the top of the file:
 * each test file has its own copy of the rules.
 */
export const everyManSent = (): void => { MEN.share = 1; };

/**
 * The rules a town's men went to war by before towns were made larger (docs/DESIGN.md, "Towns big enough to raise
 * armies"): two men a company, a town keeps two men and a husband for half its women, a company its towns cannot
 * man is filled with hired men, and no share is asked. For a test file about how men go to an army and come home,
 * written with towns of ten men: the workings are the same at any size, and such a file sets the figures it was
 * written with. Call it once at the top of the file (each test file has its own copy of the rules).
 */
export const smallTownRules = (): void => { MEN.company = 2; MEN.floor = 2; MEN.couples = 0.5; MEN.least = 0; MEN.share = 1; };
