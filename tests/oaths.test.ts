// Oaths of Fealty (src/sim/oaths.ts): nobles' moods swing less.
import { describe, expect, it } from 'vitest';
import { OATHS } from '../src/sim/oaths';
import { NOBLES, heardDecree, noblesAt, noblesSeason } from '../src/sim/nobles';
import { folkOf } from '../src/sim/township';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Oaths of Fealty', () => {
  it('a decree moves a sworn noble less, and a hungry season sours him less', () => {
    const { c, tid } = ruleWorld();
    const f = folkOf(c, tid); f.men = 8; f.women = 8; delete f.ages;
    delete c.factions[0].nobles; noblesSeason(c, 0);
    const lord = noblesAt(c, tid).find((n) => n.rank === 'lord')!;
    lord.leaning = 'pious'; lord.mood = 0;
    knowing(c, 0, 'oaths');
    heardDecree(c, 0, tid, 'tavernWomen', 1);
    expect(lord.mood).toBe(Math.round(-NOBLES.sway * OATHS.steady));
    lord.mood = 0; f.hungry = 1;
    noblesSeason(c, 0);
    expect(noblesAt(c, tid).find((n) => n.rank === 'lord')!.mood).toBe(Math.round(NOBLES.hungry * OATHS.steady));
  });
});
