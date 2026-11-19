// Each people's own fleet (src/sim/fleets.ts): its own warship in the War Galley's place, its own gunpowder ship in the Frigate's.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { CIV_IDS, TECHS, UNITS } from '../src/sim/data';
import { FLEETS, hullOf } from '../src/sim/fleets';
import { spot } from './helpers';

const sides = (civ: string) => [{ name: 'A', color: 0x3366ff, isAI: false, civ }, { name: 'B', color: 0xff3333, isAI: true, civ: 'hearth' }];

describe('each people\'s fleet', () => {
  it('every people has one, of two kinds standing for the two hulls, and the kinds differ modestly from them', () => {
    for (const civ of CIV_IDS) {
      const f = FLEETS[civ];
      expect(f, civ).toBeDefined();
      expect(hullOf(f.galley)).toBe('galley');
      expect(hullOf(f.frigate)).toBe('frigate');
      for (const id of [f.galley, f.frigate]) {
        const u = UNITS[id], base = UNITS[hullOf(id)];
        expect(u.naval).toBe(true);
        expect(u.cls).toBe(base.cls);
        for (const k of ['hp', 'atk', 'range', 'speed'] as const) expect(Math.abs(u[k] - base[k]) / base[k], `${id} ${k}`).toBeLessThanOrEqual(1 / 6 + 1e-9);
        expect(Math.abs(u.armor - base.armor), `${id} armor`).toBeLessThanOrEqual(1);
      }
    }
    expect(new Set(Object.values(FLEETS).map((f) => f.family)).size).toBe(4);
  });

  it('a people\'s Dock builds its own warship, and Ships of the Line turns its warships into its own gunpowder ship', () => {
    const g = new Game(7, sides('wild'), 96, false, true);
    expect(g.trainedAs(0, 'galley')).toBe('longship');
    expect(g.trainedAs(1, 'galley')).toBe('longship'); // the Franks are of the North too
    const ship = g.spawnUnit(g.trainedAs(0, 'galley'), 0, 48, 48); // the Norse begin as a band, with no hall to measure from
    const plain = g.spawnUnit('galley', 0, 49, 48); // a War Galley met in a set piece
    expect(ship.def.name).toBe('Longship');
    // Ships of the Line, researched.
    const p = g.players[0];
    p.upgrades.galley = 'frigate';
    const tech = TECHS.up_frigate;
    expect(tech.upgrade).toEqual(['galley', 'frigate']);
    expect(g.trainedAs(0, 'galley')).toBe('galleon');
    expect(plain.type).toBe('galley');
  });

  it('the study, finished at the Dock, refits the people\'s own warships as their own gunpowder ships', () => {
    const g = new Game(7, sides('forge'), 96, false, true);
    const p = g.players[0];
    p.age = 4; p.res.wood = p.res.gold = p.res.food = p.res.stone = 9999;
    const at = spot(g, 'dock', 0);
    const dock = g.spawnBuilding('dock', 0, at.cx, at.cy, true);
    const junk = g.spawnUnit(g.trainedAs(0, 'galley'), 0, at.cx, at.cy - 2);
    expect(junk.type).toBe('junk');
    expect(g.cmdResearch(0, dock.id, 'up_frigate')).toBeTruthy();
    for (let i = 0; i < 20 * 120 && p.pending.has('up_frigate'); i++) g.step();
    expect(p.techs.has('up_frigate')).toBe(true);
    expect(junk.type).toBe('towership');
    expect(g.trainedAs(0, 'galley')).toBe('towership');
  }, 60_000);
});
