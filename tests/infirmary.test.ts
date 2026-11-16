// The Infirmary (src/sim/infirmary.ts): plague takes fewer and grief passes sooner, on the map and in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { BUILDINGS } from '../src/sim/data';
import { sicken } from '../src/sim/acts';
import { governTown } from '../src/sim/governor';
import { GRIEF_SEASONS, griefSecond, griefSeason } from '../src/sim/grief';
import { driftTown } from '../src/sim/drift';
import { INFIRMARY, griefEase, infirmaryWanted, sickCare } from '../src/sim/infirmary';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';
import { begun, town as foodTown } from './foodtown';

const town = (buildings: string[], people = 30) => foodTown(buildings, { people });

describe('the Infirmary on the map', () => {
  it('is a building of the town, raised from the map too', () => {
    expect(BUILDINGS.infirmary.onMap).toBe(true);
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
    const quiet = town(['farm', 'mill']);
    governTown(quiet.c, quiet.t.id);
    expect(begun(quiet.c, quiet.t.id, 'infirmary')).toBe(false);
    const sad = town(['farm', 'mill']);
    sad.f.grief = 2;
    sad.c.factions[0].age = 1; // the Infirmary is of the Bronze Age
    expect(infirmaryWanted(sad.c, sad.t.id)).toBe(true);
    governTown(sad.c, sad.t.id);
    expect(begun(sad.c, sad.t.id, 'infirmary')).toBe(true);
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
