// The church's tending and grain bought abroad, inside a town (src/sim/tendintown.ts, src/sim/driftintown.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { townStrain } from '../src/sim/driftintown';
import { TEND_EASE, TEND_PLAGUE, issueDecree } from '../src/sim/decrees';
import { tendHere, tendSick } from '../src/sim/tendintown';
import { folkOf, musterFolk } from '../src/sim/township';
import { withDrift } from '../src/sim/driftintown';
import { run, setups } from './helpers';

/** A campaign town under these decrees, with some villagers, all sick. */
const town = (decrees?: { kind: 'tend' | 'alms'; strength: number }[]) => {
  const s = decrees ? [{ ...setups[0], bonus: { people: { men: 0, women: 0, elders: 0, children: 0, decrees } } }, setups[1]] : setups;
  const g = new Game(7, s);
  g.bornOnly = true;
  const p = g.players[0];
  Object.assign(p.res, { food: 2000, wood: 2000, gold: 500, stone: 500 });
  p.popCap = 200;
  const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  for (let k = 0; k < 6; k++) g.spawnUnit('villager', 0, tc.x + 3 + (k % 3), tc.y + 3 + Math.floor(k / 3), k % 2 ? 'm' : 'f');
  for (const u of g.units) if (u.owner === 0 && u.type === 'villager') u.plagueT = 600;
  return { g, p };
};

describe('the church\'s tending, in a town', () => {
  it('the decree is felt in the town at its strength', () => {
    expect(tendHere(town().g, 0)).toBe(0);
    expect(tendHere(town([{ kind: 'tend', strength: 0.5 }]).g, 0)).toBe(0.5);
    expect(tendSick(town([{ kind: 'tend', strength: 1 }]).g, 0)).toBeCloseTo(1 - TEND_PLAGUE, 5);
  });

  it('the sick weigh TEND_EASE less on the town\'s strain', () => {
    const plain = town(), tended = town([{ kind: 'tend', strength: 1 }]);
    const a = townStrain(plain.g, plain.p).strain, b = townStrain(tended.g, tended.p).strain;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeCloseTo(a * (1 - TEND_EASE), 5);
  });

  it('plague wears the tended sick down the slower', () => {
    const hp = (g: Game) => g.units.filter((u) => u.owner === 0 && u.type === 'villager').reduce((k, u) => k + u.hp, 0);
    const plain = town(), tended = town([{ kind: 'tend', strength: 1 }]);
    const a0 = hp(plain.g), b0 = hp(tended.g);
    run(plain.g, 5); run(tended.g, 5);
    expect(b0 - hp(tended.g)).toBeLessThan(a0 - hp(plain.g));
  });
});

describe('grain bought abroad, in a town', () => {
  it('is in the town\'s stores when it turns out, and goes with its decrees', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), tid = c.territories.find((t) => t.capital === 0)!.id, f = folkOf(c, tid);
    f.stores.food = 0; f.hungry = 1 as never; f.stores.gold = 5000; // short of food, with gold to buy grain with
    c.factions[0].supplies = 500;
    const before = musterFolk(c, tid).stores.food;
    const said = issueDecree(c, 0, tid, 'alms');
    if (said) throw new Error(said);
    expect(said).toBe(''); // the town is hungry and the nation can spare the gold (grain.ts)
    const m = withDrift(c, tid, musterFolk(c, tid));
    expect(m.stores.food).toBeGreaterThan(before);
    expect(m.people.decrees?.some((d) => d.kind === 'alms')).toBe(true);
  });
});
