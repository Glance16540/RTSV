// Getting out of a Work Camp as a scene: who is marked, how, and for how long (src/sim/campout.ts; drawn by src/client/campscene.ts outLook).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { OUT, cameOut, outNow, outScene } from '../src/sim/campout';
import { breakOut, campNight } from '../src/sim/captivity';
import { REVOLT_MEN } from '../src/sim/creed';
import { outLook } from '../src/client/campscene';
import { run } from './helpers';

/** A decadent town with a Work Camp holding people of the other side, and no guard posted. */
const camped = (held: number, gender: 'm' | 'f' = 'm') => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth', team: 1 }]);
  g.players[0].age = 2; g.players[0].virtue = -80;
  for (const q of g.players) q.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
  camp.captives = Array.from({ length: held }, (_, i) => ({ from: 1, name: 'Held' + i, family: '', gender, trait: '', trait2: '', age: 0, lifespan: 9999 }));
  return { g, camp };
};
const freed = (g: Game) => g.units.filter((u) => u.owner === 1 && /^Held/.test(u.name ?? ''));

describe('how someone came out of a camp', () => {
  it('one who slips away is marked so, and nobody else is', () => {
    const { g, camp } = camped(3);
    breakOut(g, camp, 2, 'slip');
    const out = freed(g);
    expect(out).toHaveLength(1);
    expect(outScene(g, out[0])).toBe('slip');
    expect(outNow(g)).toEqual([{ u: out[0], how: 'slip' }]);
    expect(camp.captives).toHaveLength(2);
  });
  it('one let out at the gate by soldiers is no scene', () => {
    const { g, camp } = camped(2);
    g.breakOut(camp, 0);
    expect(freed(g)).toHaveLength(1);
    expect(outNow(g)).toEqual([]);
  });
  it('a camp that rises in the night: everyone who breaks out is marked as risen, and the rest stay held', () => {
    const { g, camp } = camped(REVOLT_MEN + 4);
    const was = camp.captives!.length;
    for (let t = 0; t < 4000 && camp.burnT <= 0; t++) { g.time += 1; campNight(g, g.players[0], camp); }
    expect(camp.burnT).toBeGreaterThan(0); // it rose
    const scene = outNow(g).filter((x) => x.how === 'rise');
    expect(scene.length).toBeGreaterThanOrEqual(2);
    expect(scene.length + outNow(g).filter((x) => x.how === 'slip').length + camp.captives!.length).toBeLessThanOrEqual(was);
    expect(camp.captives!.length).toBeGreaterThan(0);
  });
  it('the scene is short, and over it they are as anyone', () => {
    const { g, camp } = camped(2);
    breakOut(g, camp, 0, 'slip'); breakOut(g, camp, 0, 'rise');
    const [a, b] = freed(g);
    g.time += Math.min(OUT.slip, OUT.rise);
    expect(outScene(g, a)).toBe('slip');
    expect(outScene(g, b)).toBe('rise');
    g.time += Math.max(OUT.slip, OUT.rise);
    expect(outScene(g, a)).toBe('');
    expect(outScene(g, b)).toBe('');
    expect(outNow(g)).toEqual([]);
  });
  it('it changes nothing but the mark: the same person, at the same pace, making for home', () => {
    const plain = camped(1), marked = camped(1);
    breakOut(plain.g, plain.camp, 0);
    breakOut(marked.g, marked.camp, 0, 'slip');
    run(plain.g, 6); run(marked.g, 6);
    const p = freed(plain.g)[0], m = freed(marked.g)[0];
    expect(m.x).toBeCloseTo(p.x, 6);
    expect(m.y).toBeCloseTo(p.y, 6);
    expect(m.hp).toBe(p.hp);
    expect(m.def.speed).toBe(p.def.speed);
  });
  it('only grown people are ever on the field for it: the camp\'s children are records on their mothers', () => {
    const { g, camp } = camped(3, 'f');
    camp.captives![0].young = [{ id: -1, name: 'Small', family: '', gender: 'f', trait: '', trait2: '', lifespan: 9999, left: 100, bornAt: 0 } as never];
    camp.captives![0].born = 1;
    const before = g.units.length;
    breakOut(g, camp, 0, 'rise');
    expect(g.units.length).toBe(before + 1); // the mother, and no child set on the field
    const u = freed(g)[0];
    expect(u.type).toBe('villager');
    expect(u.growT ?? 0).toBeLessThanOrEqual(0);
    expect(outNow(g).every((x) => x.u.type === 'villager' && (x.u.growT ?? 0) <= 0)).toBe(true);
  });
  it('the dead are no scene', () => {
    const { g, camp } = camped(1);
    breakOut(g, camp, 0, 'rise');
    const u = freed(g)[0];
    u.dead = true;
    expect(outScene(g, u)).toBe('');
    cameOut(g, u, 'slip');
    expect(outScene(g, u)).toBe('');
  });
});

describe('how it is drawn', () => {
  it('one who slipped away goes crouched, moving or still, and carries no light', () => {
    expect(outLook('slip', true)).toEqual({ clip: 'Crouch_Fwd_Loop', rate: 1, brand: false });
    expect(outLook('slip', false)).toEqual({ clip: 'Crouch_Idle_Loop', rate: 1, brand: false });
  });
  it('those who rose run as anyone runs, with a brand held up', () => {
    expect(outLook('rise', true)).toEqual({ clip: '', rate: 1, brand: true });
  });
  it('anyone else is drawn as they always were', () => {
    expect(outLook('', true)).toBeNull();
  });
});
