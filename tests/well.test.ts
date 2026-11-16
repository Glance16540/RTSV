// The Well (src/sim/well.ts): a crowded town counts as less crowded for plague on the map, and plague passes less
// readily among a people's own in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { SITES } from '../src/sim/campaignbase';
import { BUILDINGS } from '../src/sim/data';
import { ACTS, crowding, sicken } from '../src/sim/acts';
import { governTown } from '../src/sim/governor';
import { WELL, wellGuard, wellWanted } from '../src/sim/well';
import { Game } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { run, setups, spot, villagers } from './helpers';

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

describe('the Well on the map', () => {
  it('is a building of the map and of the town', () => {
    expect(SITES.well.name).toBe('Well');
    expect(BUILDINGS.well.name).toBe('Well');
  });

  it('a crowded town with a Well counts WELL.crowd as crowded for plague, and loses fewer to it', () => {
    const a = town([]), b = town(['well']);
    expect(crowding(a.c, a.t.id)).toBe(1);
    expect(crowding(b.c, b.t.id)).toBeCloseTo(WELL.crowd, 6);
    let without = 0, within = 0;
    for (let turn = 1; turn <= 40; turn++) {
      const x = town([]), y = town(['well']);
      x.c.turn = y.c.turn = turn;
      without += sicken(x.c, x.t); within += sicken(y.c, y.t);
    }
    expect(within).toBeLessThan(without);
  });

  it('the governor raises one in a crowded town where plague has lately been, there or next door', () => {
    const quiet = town([]);
    governTown(quiet.c, quiet.t.id);
    expect(quiet.t.buildings).not.toContain('well');
    const near = town([]);
    (near.c.events ??= []).push({ kind: 'plague', at: near.t.adj[0], turn: near.c.turn, until: near.c.turn + 1 });
    expect(wellWanted(near.c, near.t.id, 1)).toBe(true);
    governTown(near.c, near.t.id);
    expect(near.t.buildings).toContain('well');
    const hamlet = town([], 6);
    (hamlet.c.events ??= []).push({ kind: 'plague', at: hamlet.t.id, turn: hamlet.c.turn, until: hamlet.c.turn + 1 });
    governTown(hamlet.c, hamlet.t.id);
    expect(hamlet.t.buildings).not.toContain('well'); // plague seldom troubles a hamlet
    expect(ACTS.crowd).toBeGreaterThan(6);
  });
});

describe('the Well in a town', () => {
  it('plague passes among a people\'s own WELL.pass as readily with a finished Well', () => {
    const passed = (well: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const g = new Game(seed, setups);
        if (well) { const at = spot(g, 'well', 0); g.spawnBuilding('well', 0, at.cx, at.cy, true); }
        expect(wellGuard(g, 0)).toBe(well ? WELL.pass : 1);
        const vs = villagers(g, 0), [first] = vs;
        for (const v of vs) { v.x = first.x + (v.id % 3) * 0.3; v.y = first.y + 0.2; v.hp = 1e6; }
        first.plagueT = 60;
        run(g, 4);
        n += vs.filter((v) => v !== first && v.plagueT > 0).length;
      }
      return n;
    };
    expect(passed(true)).toBeLessThan(passed(false));
  });
});
