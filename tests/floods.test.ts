// Flood, an act of God on the map (src/sim/floods.ts): where a river runs, by the town's own standing.
import { describe, expect, it } from 'vitest';
import { newCampaign, terrainOf } from '../src/sim/campaign';
import { ACTS } from '../src/sim/acts';
import { FLOOD, flood, floodSeason, riverBy } from '../src/sim/floods';
import { waterOf } from '../src/sim/townwater';
import { folkOf } from '../src/sim/township';

const world = () => {
  const c = newCampaign(7, 2, 1, 'hearth');
  c.turn = ACTS.from + 1;
  return c;
};
const held = (c: ReturnType<typeof newCampaign>) => c.territories.filter((t) => t.owner >= 0 && !t.horde);

describe('floods', () => {
  it('fall only where a river runs, and in a fair share of seasons there', () => {
    const c = world();
    for (const t of c.territories) if (!t.horde && t.owner < 0) t.owner = 0; // every land held, so that some stand by a river
    const river = (tid: number) => riverBy(c, tid, () => !!waterOf(c, tid, terrainOf(c))?.river);
    const wet = held(c).filter((t) => river(t.id));
    expect(wet.length).toBeGreaterThan(0); // some held towns stand by a river
    let n = 0, seasons = 0;
    for (let turn = ACTS.from; turn < ACTS.from + 200; turn++) {
      c.turn = turn;
      for (const t of held(c)) { const s = folkOf(c, t.id).stores; s.food = Math.max(s.food, 100); }
      const out = floodSeason(c, river);
      for (const x of out) expect(river(x.at)).toBe(true);
      n += out.length; seasons += wet.length;
    }
    expect(n / seasons).toBeGreaterThan(FLOOD.chance * 0.2);
    expect(n / seasons).toBeLessThan(FLOOD.chance * 4);
  });

  it('never where no river runs, nor in a land another act struck this season', () => {
    const c = world();
    for (let turn = ACTS.from; turn < ACTS.from + 200; turn++) { c.turn = turn; expect(floodSeason(c, () => false)).toEqual([]); }
    const all = new Set(c.territories.map((t) => t.id));
    for (let turn = ACTS.from; turn < ACTS.from + 200; turn++) { c.turn = turn; expect(floodSeason(c, () => true, all)).toEqual([]); }
  });

  it('spoils food in store and wears the town by the standing; hard, it washes the farm away; nobody drowns', () => {
    const c = world();
    const t = held(c)[0], f = folkOf(c, t.id);
    f.stores.food = 1000;
    const people = f.men + f.women + f.elders + f.children;
    if (!t.buildings.includes('farm')) t.buildings.push('farm');
    const soft = flood(c, t.id, 1, false);
    expect(soft.food).toBe(Math.floor(1000 * FLOOD.food));
    expect(f.stores.food).toBe(1000 - soft.food);
    expect(t.buildings).toContain('farm');
    const hard = flood(c, t.id, 1, true);
    expect(hard.farm).toBe(true);
    expect(t.buildings).not.toContain('farm');
    expect(f.men + f.women + f.elders + f.children).toBe(people);
    expect(c.events?.some((e) => e.kind === 'flood' && e.at === t.id)).toBe(true);
  });

  it('a holy town loses less than a decadent one', () => {
    const c = world(), t = held(c)[0], f = folkOf(c, t.id);
    f.stores.food = 1000; const holy = flood(c, t.id, 1 / 3, false).food;
    f.stores.food = 1000; const low = flood(c, t.id, 1.5, false).food;
    expect(holy).toBeLessThan(low);
  });
});
