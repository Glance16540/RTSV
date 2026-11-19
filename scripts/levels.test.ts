// The computer's levels against each other, as the systems board's figures were measured (docs/systems-board,
// "Country and ground"): Hard against Easy and Normal against Easy, a game for each seed, the stronger side
// changing places every other seed, up to an hour each.
//
//   LEVELS=1 npx vitest run scripts/levels.test.ts
//   LEVELS=1 SEEDS=12 FIRST=1 OUT=levels.txt npx vitest run scripts/levels.test.ts
import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { setups, run } from '../tests/helpers';

const SEEDS = +(process.env.SEEDS ?? 12), FIRST = +(process.env.FIRST ?? 1), OUT = process.env.OUT ?? 'levels.txt';
const NAMES = ['Easy', 'Normal', 'Hard'];

it.skipIf(!process.env.LEVELS)('the computer\'s levels against each other', () => {
  for (const strong of [2, 1]) {
    let won = 0, lost = 0, none = 0;
    const games: string[] = [];
    for (let seed = FIRST; seed < FIRST + SEEDS; seed++) {
      const at = seed % 2; // where the stronger side starts
      const g = new Game(seed, [{ ...setups[0], isAI: true }, { ...setups[1], isAI: true }]);
      const ais = [0, 1].map((i) => { const c = new AIController(g, i); c.setLevel(i === at ? strong : 0); return c; });
      run(g, 60 * 60, () => { if (g.winner < 0) ais.forEach((a) => a.update()); });
      const how = g.winner < 0 ? 'none' : g.winner === at ? 'won' : 'lost';
      if (how === 'won') won++; else if (how === 'lost') lost++; else none++;
      games.push(`seed ${seed}: ${how}${g.winner >= 0 ? ` at ${(g.time / 60).toFixed(0)}m` : ''}`);
    }
    appendFileSync(OUT, `${NAMES[strong]} v Easy, seeds ${FIRST} to ${FIRST + SEEDS - 1}: ${won}-${lost}, ${none} undecided\n  ${games.join('; ')}\n`);
  }
}, 7200000);
