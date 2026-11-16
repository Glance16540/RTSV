// The Infirmary (src/sim/infirmary.ts): plague takes fewer and grief passes sooner, on the map and in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { SITES } from '../src/sim/campaignbase';
import { BUILDINGS } from '../src/sim/data';
import { sicken } from '../src/sim/acts';
import { governTown } from '../src/sim/governor';
import { GRIEF_SEASONS, griefSecond, griefSeason } from '../src/sim/grief';
import { driftTown } from '../src/sim/drift';
import { INFIRMARY, griefEase, infirmaryWanted, sickCare } from '../src/sim/infirmary';
import { Game } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { setups, spot } from './helpers';

function town(buildings: string[], people = 30) {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  t.owner = 0; t.buildings = buildings;
  const f = folkOf(c, t.id);
  f.men = Math.round(people * 0.35); f.women = Math.round(people * 0.35); f.elders = 2; f.children = people - f.men - f.women - 2;
  delete f.ages; delete f.drift;
  f.stores = { food: 2000, wood: 900, gold: 900, stone: 900 };
  return { c, t, f };
}

describe('the Infirmary on the map', () => {
  it('is a building of the map and of the town', () => {
    expect(SITES.infirmary.name).toBe('Infirmary');
    expect(BUILDINGS.infirmary.name).toBe('Infirmary');
  });

  it('plague takes fewer where the sick are nursed', () => {
    let without = 0, within = 0;
    for (let turn = 1; turn <= 40; turn++) {
      const x = town([]), y = town(['infirmary']);
      x.c.turn = y.c.turn = turn;
      without += sicken(x.c, x.t); within += sicken(y.c, y.t);
    }
    expect(within).toBeLessThan(without);
    expect(within).toBeGreaterThan(0);
  });

  it('a grieving town grieves INFIRMARY.grief seasons less each season', () => {
    const f = { grief: GRIEF_SEASONS } as Parameters<typeof griefSeason>[0];
    griefSeason(f, false);
    expect(f.grief).toBe(GRIEF_SEASONS - 1);
    griefSeason(f, false, { ease: INFIRMARY.grief });
    expect(f.grief).toBe(Math.max(0, GRIEF_SEASONS - 1 - INFIRMARY.grief));
    const a = town([]), b = town(['infirmary']);
    a.f.grief = b.f.grief = GRIEF_SEASONS;
    driftTown(a.c, a.t.id); driftTown(b.c, b.t.id);
    expect(b.f.grief ?? 0).toBeLessThan(a.f.grief ?? 0);
  });

  it('the governor raises one in a town of some size that has had plague or is grieving', () => {
    const quiet = town([]);
    governTown(quiet.c, quiet.t.id);
    expect(quiet.t.buildings).not.toContain('infirmary');
    const sad = town([]);
    sad.f.grief = 2;
    expect(infirmaryWanted(sad.c, sad.t.id)).toBe(true);
    governTown(sad.c, sad.t.id);
    expect(sad.t.buildings).toContain('infirmary');
    const small = town([], 8);
    small.f.grief = 2;
    expect(infirmaryWanted(small.c, small.t.id)).toBe(false);
  });
});

describe('the Infirmary in a town', () => {
  it('plague wears its people down INFIRMARY.sick as fast, and a grieving house mourns INFIRMARY.grief seconds a second', () => {
    const g = new Game(3, setups);
    expect(sickCare(g, 0)).toBe(1);
    const house = g.spawnBuilding('house', 0, spot(g, 'house', 0).cx, spot(g, 'house', 0).cy, true);
    house.griefT = 100;
    griefSecond(g);
    expect(house.griefT).toBe(99);
    const at = spot(g, 'infirmary', 0);
    g.spawnBuilding('infirmary', 0, at.cx, at.cy, true);
    g.tick++; // what is known of the town is read afresh each tick
    expect(sickCare(g, 0)).toBe(INFIRMARY.sick);
    expect(griefEase(g, 0)).toBe(INFIRMARY.grief);
    griefSecond(g);
    expect(house.griefT).toBe(99 - INFIRMARY.grief);
  });
});
