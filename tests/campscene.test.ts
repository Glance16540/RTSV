// What is drawn at a Work Camp's gate (src/client/campscene.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { RESCUE_TIME } from '../src/sim/rescue';
import { CampScenes, campChange, gateOf } from '../src/client/campscene';
import { run } from './helpers';

describe('telling what has happened at a camp', () => {
  it('knows a rescue, a rising and a night escape apart, and ignores the rest', () => {
    expect(campChange(undefined, { held: 3, working: false, burning: false })).toBe(null);
    expect(campChange({ held: 3, working: false, burning: false }, { held: 4, working: false, burning: false })).toBe(null);
    expect(campChange({ held: 3, working: true, burning: false }, { held: 2, working: true, burning: false })).toEqual({ what: 'rescue', out: 1 });
    expect(campChange({ held: 8, working: false, burning: false }, { held: 4, working: false, burning: true })).toEqual({ what: 'rising', out: 4 });
    expect(campChange({ held: 3, working: false, burning: false }, { held: 2, working: false, burning: false })).toEqual({ what: 'escape', out: 1 });
  });
});

describe('a rescue drawn at the gate', () => {
  const camped = (guards: number) => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth', team: 1 }]);
    g.players[0].age = 2; g.players[0].virtue = -80;
    for (const q of g.players) q.dilemmaT = 1e9;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
    camp.captives = Array.from({ length: 3 }, (_, i) => ({ from: 1, name: 'Held' + i, family: '', gender: 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999 }));
    const posted = Array.from({ length: guards }, (_, i) => g.spawnUnit('slaver', 0, camp.x - 1 + i * 0.6, camp.y + 3));
    if (guards) { g.cmdTarget(0, posted.map((s) => s.id), camp.id); run(g, 8); }
    const man = g.spawnUnit('swordsman', 1, camp.x + 1.2, camp.y + camp.size / 2 + 1.4);
    man.stance = 'hold';
    const seen = { chips: 0, dust: 0, signs: [] as string[] };
    const fx = { chips: () => { seen.chips++; }, dust: () => { seen.dust++; }, sign: (_x: number, _y: number, text: string) => { seen.signs.push(text); }, height: () => 0, seen: () => true };
    const scenes = new CampScenes();
    const through = (seconds: number) => run(g, seconds, () => scenes.update(g, 1 / 20, fx));
    return { g, camp, man, seen, scenes, through };
  };
  it('turns the soldier to the gate and sets him hacking, with chips flying, and marks each one let out', () => {
    const { camp, man, seen, scenes, through } = camped(0);
    through(2);
    const at = scenes.at(man.id)!, gate = gateOf(camp);
    expect(at.working).toBe(true);
    expect(at.yaw).toBeCloseTo(Math.atan2(gate.x - man.x, gate.y - man.y), 5);
    expect(seen.chips).toBeGreaterThan(0);
    expect(seen.signs).toEqual([]);
    through(RESCUE_TIME + 1);
    expect(seen.signs).toEqual(['🔓']);
    expect(seen.dust).toBeGreaterThan(0);
  });
  it('has him stand facing the gate, not hacking, while the guards hold him off', () => {
    const { man, seen, scenes, through } = camped(1);
    through(3);
    expect(scenes.at(man.id)?.working).toBe(false);
    expect(seen.chips).toBe(0);
    expect(seen.signs).toEqual([]);
  });
  it('lets him go about his business once no one is left to free', () => {
    const { camp, man, scenes, through } = camped(0);
    through(RESCUE_TIME * 3 + 4);
    expect(camp.captives!.length).toBe(0);
    expect(scenes.at(man.id)).toBe(undefined);
  });
});
