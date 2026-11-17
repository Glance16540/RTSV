// What a town or a nation may spend on a work or a study (src/sim/plenty.ts): one rule for every purchase.
import { describe, expect, it } from 'vitest';
import { PLENTY, breadless, canSpare, nationCanSpare, shortOfBread } from '../src/sim/plenty';
import { GOVERN } from '../src/sim/governor';
import { town } from './foodtown';

describe('plenty', () => {
  it('is the governor\'s own measure: the same floor and the same short bread', () => {
    expect(GOVERN.floor).toBe(PLENTY.floor);
    expect(GOVERN.short).toBe(PLENTY.short);
  });

  it('a town spends on a work only if it has its Farmland, has bread, wants nothing more pressing, and keeps PLENTY.works floors in goods other than bread', () => {
    const cost = { wood: 150 };
    const rich = town(['farm'], { goods: 1000 }); // 3000 goods other than bread
    expect(breadless(rich.f.stores)).toBe(3000);
    expect(canSpare(rich.c, rich.t.id, cost)).toBe(true); // 3000 - 150 >= 4 x 300
    expect(canSpare(rich.c, rich.t.id, cost, { wants: { roof: true } })).toBe(false);
    expect(canSpare(rich.c, rich.t.id, cost, { wants: { wall: true } })).toBe(false);
    const fieldless = town([], { goods: 1000 });
    expect(canSpare(fieldless.c, fieldless.t.id, cost)).toBe(false);
    const hungry = town(['farm'], { goods: 1000, food: 0 });
    expect(shortOfBread(hungry.c, hungry.t.id)).toBe(true);
    expect(canSpare(hungry.c, hungry.t.id, cost)).toBe(false);
    const bread = town(['farm'], { goods: 400, food: 99999 }); // a full granary is not goods to spend
    expect(canSpare(bread.c, bread.t.id, cost)).toBe(false);
    expect(canSpare(bread.c, bread.t.id, cost, { times: 1 })).toBe(true); // 1200 - 150 >= 300
  });

  it('a nation learns a study only where the teaching town has fields and bread, keeping PLENTY.studies floors a town', () => {
    const { c, t, f } = town(['farm'], { goods: 1000 });
    const mine = c.territories.filter((x) => x.owner === 0 && !x.horde).length;
    expect(nationCanSpare(c, 0, t.id, { gold: 100 })).toBe(breadless(f.stores) + c.territories.filter((x) => x.owner === 0 && x.id !== t.id).reduce((n, x) => n + breadless(c.territories[x.id].folk!.stores), 0) - 100 >= PLENTY.studies * PLENTY.floor * mine);
    f.stores.food = 0;
    expect(nationCanSpare(c, 0, t.id, { gold: 100 })).toBe(false);
    // Grain for a hungry town answers its own want: with `town: false` it waits for neither its fields nor its bread, only the nation's floors.
    expect(nationCanSpare(c, 0, t.id, { gold: 100 }, PLENTY.grain, { town: false })).toBe(breadless(f.stores) + c.territories.filter((x) => x.owner === 0 && x.id !== t.id).reduce((n, x) => n + breadless(c.territories[x.id].folk!.stores), 0) - 100 >= PLENTY.grain * PLENTY.floor * mine);
    expect(nationCanSpare(c, 0, t.id, { gold: 1e9 }, PLENTY.grain, { town: false })).toBe(false);
  });
});
