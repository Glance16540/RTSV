// How the governor raises the food and health works (governor.ts with granary.ts, mill.ts, well.ts, infirmary.ts):
// only once a town has Farmland, only out of plenty, and leaving a place for a wall.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { slots } from '../src/sim/campaignbase';
import { governTown } from '../src/sim/governor';
import { folkOf } from '../src/sim/township';

function town(buildings: string[], goods = 900) {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  t.owner = 0; t.buildings = buildings;
  const f = folkOf(c, t.id);
  f.men = 11; f.women = 11; f.elders = 2; f.children = 6;
  delete f.ages; delete f.drift;
  f.stores = { food: 2000, wood: goods, gold: goods, stone: goods };
  f.grief = 3; // a grieving town of thirty: an Infirmary is wanted
  return { c, t, f };
}
const WORKS = ['granary', 'mill', 'well', 'infirmary'];

describe('the governor and the food and health works', () => {
  it('raises one once the town has Farmland, and none before', () => {
    const fed = town(['farm']);
    governTown(fed.c, fed.t.id);
    expect(fed.t.buildings.some((b) => WORKS.includes(b))).toBe(true);
    const bare = town([]);
    bare.f.stores.food = 2000;
    governTown(bare.c, bare.t.id);
    expect(bare.t.buildings.some((b) => WORKS.includes(b))).toBe(false);
  });

  it('leaves a place for a wall until there is one, and buys only out of plenty', () => {
    const full = town(['farm']);
    full.t.buildings.push(...Array.from({ length: slots(full.t) - 2 }, (_, i) => `stand${i}`));
    governTown(full.c, full.t.id);
    expect(full.t.buildings, `slots ${slots(full.t)}`).toEqual(full.t.buildings.filter((b) => !WORKS.includes(b))); // one place left: the wall's
    const poor = town(['farm'], 150);
    governTown(poor.c, poor.t.id);
    expect(poor.t.buildings, 'poor').toEqual(['farm']);
  });
});
