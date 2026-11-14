// The Far Shore's walled causeway, and the missions The Stockade and The Mountain King (src/sim/scenario.ts).
import { describe, expect, it } from 'vitest';
import { Building, Game } from '../src/sim/game';
import { ABILITIES } from '../src/sim/data';
import { RESCUE_TIME, rescueForce } from '../src/sim/rescue';
import { MISSIONS, barLand, landWay, missionById, runMission } from '../src/sim/scenario';
import { T_SAND, T_SNOW } from '../src/sim/map';
import { run } from './helpers';

const start = (id: string) => { const m = missionById(id)!; const g = new Game(m.seed, m.setups, m.size, false, !!m.sea, false, m.climate ?? ''); m.init(g); return { m, g }; };
const LONG = 60_000; // these play minutes of a match; the suite is slower together than alone

describe('The Far Shore: no way round by land', () => {
  it('the pirates have walled every way to them, and the wall stands well clear of both towns', () => {
    const { g } = start('shore');
    const me = g.spec.starts[0];
    const hold = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    const mine = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    expect(landWay(g, me.x, me.y + 4, hold)).toBe(null);
    const walls = g.buildings.filter((b) => b.owner === 1 && b.type === 'stonewall');
    expect(walls.length).toBeGreaterThan(8);
    expect(walls.length).toBeLessThan(120); // a causeway, not a country
    for (const w of walls) { expect(Math.hypot(w.x - hold.x, w.y - hold.y)).toBeGreaterThan(12); expect(Math.hypot(w.x - mine.x, w.y - mine.y)).toBeGreaterThan(12); }
    // Without the wall there was a way: this is what was wrong before.
    const m = missionById('shore')!;
    const bare = new Game(m.seed, m.setups, m.size, false, true);
    const there = bare.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    expect(landWay(bare, me.x, me.y + 4, there)).not.toBe(null);
    expect(barLand(bare, me.x, me.y + 4, there, 1)).toBe(walls.length);
    // It comes back from a saved game with the wall still across the way.
    const again = Game.restore(g.serialize());
    expect(landWay(again, me.x, me.y + 4, again.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!)).toBe(null);
  }, LONG);

  it('ships still reach them: there is water at both shores', () => {
    const { g } = start('shore');
    const hold = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!, me = g.spec.starts[0];
    const a = g.shoreSpot(me.x, me.y, 30, 0), b = g.shoreSpot(hold.x, hold.y, 30, 0);
    expect(a && b).toBeTruthy();
  });
});

describe('The Stockade', () => {
  it('is fought in the desert by a people no other mission plays, against a decadent town that holds six of theirs', () => {
    const { m, g } = start('stockade');
    expect(m.climate).toBe('desert');
    expect(g.terrain.includes(T_SAND)).toBe(true);
    expect(MISSIONS.filter((x) => x.setups[0].civ === 'egypt').length).toBe(1);
    expect(g.creed(1).id).toBe('decadent');
    const camp = g.entities.get(g.scenario!.ids[0]) as Building;
    expect(camp.type).toBe('workcamp');
    expect(camp.captives!.length).toBe(6);
    expect(camp.captives!.every((c) => c.from === 0)).toBe(true);
    run(g, 10);
    expect(camp.staff!.length).toBe(2);
    expect(rescueForce(camp)).toBe(5);
    const st = runMission(g, m);
    expect(st.result).toBe(null);
    expect(st.objectives.map((o) => o.done)).toEqual([false, false, false, false]);
    expect(st.objectives[1].text).toContain('Stand 5 soldiers');
  }, LONG);

  it('is won by standing soldiers at the gate until everyone is out, with the camp unburnt', () => {
    const { m, g } = start('stockade');
    const camp = g.entities.get(g.scenario!.ids[0]) as Building;
    run(g, 10);
    // Their garrison is not what this is about.
    for (const u of g.units.filter((x) => x.owner === 1 && g.isMilitary(x) && !x.def.slaver)) (g as any).kill(u);
    const men = Array.from({ length: 8 }, (_, i) => g.spawnUnit('swordsman', 0, camp.x - 1.5 + (i % 6) * 0.6, camp.y + camp.size / 2 + 1 + Math.floor(i / 6) * 0.6));
    for (const u of men) u.stance = 'hold';
    let result: string | null = null, seen = false;
    run(g, RESCUE_TIME * 6 + 30, () => { const st = runMission(g, m); if (st.objectives[1].done) seen = true; result ??= st.result; });
    expect(seen).toBe(true);
    expect(camp.captives!.length).toBe(0);
    expect(camp.dead).toBe(false);
    expect(result).toBe('win');
    const names = g.units.filter((u) => u.owner === 0).map((u) => u.name);
    for (const who of ['Neferu', 'Khay', 'Merit', 'Sennu', 'Tiye', 'Ipy']) expect(names).toContain(who);
    expect(runMission(g, m).objectives.every((o) => o.done)).toBe(true);
  }, LONG);

  it('burning the camp also frees them, but the last objective is not met; losing the town loses', () => {
    const { m, g } = start('stockade');
    const camp = g.entities.get(g.scenario!.ids[0]) as Building;
    (g as any).kill(camp);
    const st = runMission(g, m);
    expect(st.result).toBe('win');
    expect(st.objectives[3].done).toBe(false);
    const lost = start('stockade');
    for (const b of lost.g.buildings.filter((b) => b.owner === 0)) (lost.g as any).kill(b);
    expect(runMission(lost.g, lost.m).result).toBe('lose');
  });

  it('a Slaver comes once for one more of the town\'s people', () => {
    const { m, g } = start('stockade');
    const before = g.units.filter((u) => u.owner === 1 && u.def.slaver).length;
    let warned = false;
    run(g, 155, () => { runMission(g, m); for (const e of g.events) if (e.t === 'msg' && e.player === 0 && e.text.includes('Slaver is on the road')) warned = true; g.events.length = 0; });
    expect(warned).toBe(true);
    expect(g.units.filter((u) => u.def.slaver).length + (g.units.filter((u) => u.owner === 1 && u.def.slaver).length < before ? 1 : 0)).toBeGreaterThanOrEqual(before);
    expect(g.scenario!.n & 2).toBe(2);
  }, LONG);
});

describe('The Mountain King', () => {
  it('is fought in the snow against a keep behind stone, with two Prophets full of faith', () => {
    const { m, g } = start('mountain');
    expect(g.terrain.includes(T_SNOW)).toBe(true);
    const keep = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!, me = g.spec.starts[0];
    expect(g.buildings.filter((b) => b.owner === 1 && b.type === 'stonewall').length).toBeGreaterThan(40);
    expect(g.buildings.filter((b) => b.owner === 1 && b.type === 'gate').length).toBe(1);
    expect(landWay(g, me.x, me.y + 4, keep)).toBe(null); // no way in but through the wall
    const prophets = g.units.filter((u) => u.owner === 0 && u.type === 'prophet');
    expect(prophets.length).toBe(2);
    for (const p of prophets) expect(p.mana).toBeGreaterThanOrEqual(ABILITIES.quake.cost);
    expect(g.buildings.filter((b) => b.owner === 1 && b.type === 'farm').length).toBe(3);
    // The garrison is inside.
    for (const u of g.units.filter((x) => x.owner === 1 && g.isMilitary(x))) expect(Math.max(Math.abs(u.x - keep.x), Math.abs(u.y - keep.y))).toBeLessThan(8);
    expect(runMission(g, m).objectives.map((o) => o.done)).toEqual([false, false, false, false]);
    // The cracked wall is still cracked in a saved game.
    const again = Game.restore(g.serialize());
    expect(again.buildings.filter((b) => b.type === 'stonewall').every((b) => b.maxHp === 290)).toBe(true);
    expect(again.climate).toBe('snow');
  });

  it('each calamity is counted when it falls on him, and the keep\'s fall wins it', () => {
    const { m, g } = start('mountain');
    const keep = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    const wall = g.buildings.filter((b) => b.owner === 1 && b.type === 'stonewall').sort((a, b) => a.y - b.y)[0];
    const [p, q] = g.units.filter((u) => u.owner === 0 && u.type === 'prophet');
    const done = () => runMission(g, m).objectives.map((o) => o.done);
    for (const u of [p, q]) u.hp = u.maxHp = 9999; // this is about what is counted, not about keeping them alive
    // An earthquake on the wall: stone falls, and a way in is opened.
    const at = g.pf.nearestFree(wall.x, wall.y - 5);
    p.x = at.x; p.y = at.y; q.x = at.x + 1; q.y = at.y;
    const hp = wall.hp;
    expect(g.cmdCast(0, [p.id], 'quake', wall.x, wall.y)).toBe(true);
    let quake = false;
    run(g, 8, () => { if (done()[0]) quake = true; });
    expect(quake).toBe(true);
    expect(hp).toBeLessThan(300);
    expect(wall.dead).toBe(true); // one Earthquake is enough for the old stone
    expect(landWay(g, g.spec.starts[0].x, g.spec.starts[0].y + 4, keep)).not.toBe(null);
    // Plague among the garrison, then blight on his fields.
    const man = g.units.find((u) => u.owner === 1 && g.isMilitary(u))!;
    q.x = man.x; q.y = man.y - 6;
    expect(g.cmdCast(0, [q.id], 'plague', man.x, man.y)).toBe(true);
    run(g, 4, () => done());
    expect(done()[1]).toBe(true);
    const farm = g.buildings.find((b) => b.owner === 1 && b.type === 'farm')!;
    q.mana = 100; q.x = farm.x; q.y = farm.y - 4;
    expect(g.cmdCast(0, [q.id], 'blight', farm.x, farm.y)).toBe(true);
    run(g, 4, () => done());
    expect(done().slice(0, 3)).toEqual([true, true, true]);
    expect(runMission(g, m).result).toBe(null);
    (g as any).kill(keep);
    expect(runMission(g, m).result).toBe('win');
    const lost = start('mountain');
    for (const b of lost.g.buildings.filter((b) => b.owner === 0)) (lost.g as any).kill(b);
    expect(runMission(lost.g, lost.m).result).toBe('lose');
  }, LONG);
});

describe('the missions as a set', () => {
  it('each says what it teaches, and between them they are played in three kinds of country by eight peoples', () => {
    for (const m of MISSIONS) expect(m.about?.length, m.id).toBeGreaterThan(10);
    expect(new Set(MISSIONS.map((m) => m.climate ?? 'temperate')).size).toBe(3);
    expect(new Set(MISSIONS.map((m) => m.setups[0].civ)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });
});
