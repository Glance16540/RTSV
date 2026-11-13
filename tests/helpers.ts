// What every test file needs to set a battle going. New tests go in a file of their own beside this one
// (tests/<feature>.test.ts) and take these from here, so that two branches never add to the same file.
import { Game } from '../src/sim/game';

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
