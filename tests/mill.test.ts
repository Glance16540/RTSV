// The Mill (src/sim/mill.ts): a farmed land yields more on the map, and farms are worked faster in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { SITES } from '../src/sim/campaignbase';
import { BUILDINGS, BUILD_PAGES } from '../src/sim/data';
import { yieldShares } from '../src/sim/harvest';
import { governTown } from '../src/sim/governor';
import { MILL, millPace, millWanted, millYield } from '../src/sim/mill';
import { Game } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { run, setups, spot, villagers } from './helpers';

function town(buildings: string[], food = 2000) {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  t.owner = 0; t.buildings = buildings;
  const f = folkOf(c, t.id);
  f.men = 6; f.women = 6; f.elders = 1; f.children = 4;
  delete f.ages; delete f.drift;
  f.stores = { food, wood: 900, gold: 900, stone: 900 };
  return { c, t, f };
}

describe('the Mill on the map', () => {
  it('is a building of the map and of the town', () => {
    expect(SITES.mill.name).toBe('Mill');
    expect(BUILDINGS.mill.name).toBe('Mill');
    expect(BUILD_PAGES[0]).toContain('mill');
  });

  it('a land with Farmland and a Mill yields MILL.yield times the food; without Farmland it grinds nothing', () => {
    const farm = town(['farm']), milled = town(['farm', 'mill']), bare = town(['mill']);
    expect(millYield(farm.c, farm.t.id)).toBe(1);
    expect(millYield(milled.c, milled.t.id)).toBe(MILL.yield);
    expect(millYield(bare.c, bare.t.id)).toBe(1);
    const a = yieldShares(farm.c, farm.t.id), b = yieldShares(milled.c, milled.t.id);
    expect(b.food).toBeCloseTo(a.food * MILL.yield, 6);
    expect(b.wood).toBeCloseTo(a.wood, 6); // only food
  });

  it('the governor raises one where food is short and the town already has its Farmland', () => {
    const short = town(['farm'], 0);
    expect(millWanted(short.c, short.t.id, true)).toBe(true);
    governTown(short.c, short.t.id);
    expect(short.t.buildings).toContain('mill');
    const plenty = town(['farm']);
    governTown(plenty.c, plenty.t.id);
    expect(plenty.t.buildings).not.toContain('mill');
    const noFields = town([], 0);
    governTown(noFields.c, noFields.t.id);
    expect(noFields.t.buildings).toContain('farm'); // the Farm comes first
    expect(noFields.t.buildings).not.toContain('mill');
  });
});

describe('the Mill in a town', () => {
  it('a people with a finished Mill works its farms MILL.yield times as fast', () => {
    const farmed = (mill: boolean): number => {
      const g = new Game(3, setups);
      const [, b] = villagers(g, 0);
      const fs = spot(g, 'farm', 0);
      g.cmdPlace(0, 'farm', fs.cx, fs.cy, [b.id]);
      if (mill) { const ms = spot(g, 'mill', 0); g.spawnBuilding('mill', 0, ms.cx, ms.cy, true); }
      expect(millPace(g, 0)).toBe(mill ? MILL.yield : 1);
      run(g, 40);
      const food = g.players[0].res.food;
      run(g, 120);
      return g.players[0].res.food - food;
    };
    const without = farmed(false), within = farmed(true);
    expect(without).toBeGreaterThan(0);
    expect(within).toBeGreaterThan(without);
  });
});
