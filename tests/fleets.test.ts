// Each people's own fleet (src/sim/fleets.ts): its own warship in the War Galley's place, its own gunpowder ship in the Frigate's.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { CIV_IDS, TECHS, UNITS } from '../src/sim/data';
import { FLEETS, RAM, hullOf, ramBlow } from '../src/sim/fleets';
import { T_WATER } from '../src/sim/map';
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

describe('ships fight by their kind', () => {
  it('a ram-ship rams a ship close by: only the Trireme and the Galleass, only a ship, only close', () => {
    const ship = (type: string, x: number) => ({ kind: 'unit', def: UNITS[type], x, y: 10 });
    expect(ramBlow(ship('trireme', 10), ship('galley', 11.5))).toBe(RAM.mult);
    expect(ramBlow(ship('galleass', 10), ship('dhow', 11.5))).toBe(RAM.mult);
    expect(ramBlow(ship('trireme', 10), ship('galley', 16))).toBe(1); // too far: it shoots
    expect(ramBlow(ship('trireme', 10), { kind: 'unit', def: UNITS.clubman, x: 11, y: 10 })).toBe(1); // not a ship
    expect(ramBlow(ship('dhow', 10), ship('galley', 11))).toBe(1); // not a ram-ship
    expect(UNITS.junk.armor).toBeGreaterThan(UNITS.galley.armor); // a junk's armour
    expect(UNITS.dhow.range).toBeGreaterThan(UNITS.galley.range); // a dhow's reach
  });

  it('on the water a trireme close to an enemy ship rams it, hard and at once, where farther off it shoots', () => {
    const g = new Game(5, sides('greece'), 96, false, true);
    let at: { x: number; y: number } | null = null;
    for (let y = 6; y < 90 && !at; y++) for (let x = 6; x < 84 && !at; x++) { let ok = true; for (let k = 0; k < 10 && ok; k++) for (const dy of [-1, 0, 1]) if (g.terrain[(y + dy) * 96 + x + k] !== T_WATER) ok = false; if (ok) at = { x: x + 0.5, y: y + 0.5 }; }
    expect(at).not.toBeNull();
    const tri = g.spawnUnit('trireme', 0, at!.x, at!.y), foe = g.spawnUnit('galley', 1, at!.x + 1.6, at!.y);
    const hp = foe.hp;
    g.cmdTarget(0, [tri.id], foe.id);
    for (let i = 0; i < 20 && foe.hp === hp; i++) g.step();
    expect(hp - foe.hp).toBeGreaterThan(UNITS.trireme.atk * RAM.mult - UNITS.galley.armor - 1);
    expect(g.projectiles.some((p) => p.from === tri.id)).toBe(false);
    // Farther off, it shoots.
    const far = g.spawnUnit('galley', 1, at!.x + 7, at!.y);
    foe.hp = 0; foe.dead = true;
    g.cmdTarget(0, [tri.id], far.id);
    for (let i = 0; i < 80 && !g.projectiles.some((p) => p.from === tri.id); i++) g.step();
    expect(g.projectiles.some((p) => p.from === tri.id)).toBe(true);
  }, 60_000);
});
