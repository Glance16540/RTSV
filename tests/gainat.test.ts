// A gain that belongs to a place goes into that town's stores (src/sim/stores.ts gainAt).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { SUPPLY_UNITS, gainAt, settleStores } from '../src/sim/stores';
import { STORE_KINDS, folkOf } from '../src/sim/township';

const goods = (c: ReturnType<typeof newCampaign>, tid: number) => STORE_KINDS.reduce((n, k) => n + folkOf(c, tid).stores[k], 0);

describe('a gain in its own town', () => {
  it('goes into the town named, not shared among the nation\'s towns; a land not the people\'s sends it to the chief town', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const land = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id))!;
    land.owner = 0;
    settleStores(c);
    const at = { home: goods(c, home.id), land: goods(c, land.id) }, had = c.factions[0].supplies;
    gainAt(c, 0, land.id, 3);
    expect(goods(c, land.id)).toBe(at.land + 3 * SUPPLY_UNITS);
    expect(goods(c, home.id)).toBe(at.home);
    expect(c.factions[0].supplies).toBeGreaterThanOrEqual(had + 2); // the figure follows the towns (a town below its stock counts so)
    const tribe = c.territories.find((t) => t.owner < 0)!;
    gainAt(c, 0, tribe.id, 2);
    expect(goods(c, home.id)).toBe(at.home + 2 * SUPPLY_UNITS);
  });
});
