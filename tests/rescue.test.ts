// Captives got back by soldiers at the stockade, and the keeper's guards (src/sim/rescue.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import type { Building } from '../src/sim/game';
import { RESCUE_GUARD, RESCUE_TIME, guardsShort, heldAt, postGuards, rescueForce, rescuers } from '../src/sim/rescue';
import { run } from './helpers';

/** A decadent town (0) with a Work Camp holding people taken from its rival (1). Player 2, if asked for, is the rival's ally. */
const camped = (held: number, guards: number, ally = false) => {
  const setups = [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth', team: 1 }];
  if (ally) setups.push({ name: 'C', color: 3, isAI: false, civ: 'hearth', team: 1 });
  const g = new Game(5, setups);
  const p = g.players[0];
  p.age = 2; p.virtue = -80; p.popCap = 40;
  for (const q of g.players) q.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
  camp.captives = Array.from({ length: held }, (_, i) => ({ from: 1, name: 'Held' + i, family: '', gender: i % 2 ? 'f' as const : 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999 }));
  const posted = Array.from({ length: guards }, (_, i) => g.spawnUnit('slaver', 0, camp.x - 1 + i * 0.6, camp.y + 3));
  if (guards) { g.cmdTarget(0, posted.map((s) => s.id), camp.id); run(g, 8); }
  const said: string[][] = g.players.map(() => []);
  const through = (seconds: number) => run(g, seconds, () => { for (const e of g.events) if (e.t === 'msg') said[e.player]?.push(e.text); g.events.length = 0; });
  /** Soldiers told to stand their ground at the gate: this is about the gate, not about what they do to the wall. */
  const send = (owner: number, n: number) => {
    const us = Array.from({ length: n }, (_, i) => g.spawnUnit('swordsman', owner, camp.x - 1.5 + (i % 6) * 0.6, camp.y + camp.size / 2 + 1 + Math.floor(i / 6) * 0.6));
    for (const u of us) u.stance = 'hold';
    return us;
  };
  const home = () => g.units.filter((u) => u.owner === 1 && u.name.startsWith('Held'));
  return { g, camp, said, through, send, home };
};
const intact = (camp: Building) => !camp.dead && camp.hp === camp.maxHp;

describe('rescuing captives from a work camp', () => {
  it('one soldier at an unguarded camp lets the town\'s people out one at a time, and they run for home as themselves', () => {
    const { g, camp, said, through, send, home } = camped(4, 0);
    expect(rescueForce(camp)).toBe(1);
    send(1, 1);
    through(RESCUE_TIME - 2);
    expect(camp.captives!.length).toBe(4); // not at once
    through(4);
    expect(camp.captives!.length).toBe(3);
    expect(home().map((u) => u.name)).toEqual(['Held3']); // the last brought in is first out
    through(RESCUE_TIME * 3 + 2);
    expect(camp.captives!.length).toBe(0);
    expect(home().length).toBe(4);
    expect(home().every((u) => u.type === 'villager')).toBe(true);
    expect(intact(camp)).toBe(true); // got out by the gate, not by burning the place
    expect(said[1].filter((t) => t.includes('running for home')).length).toBe(4);
    expect(said[0].some((t) => t.includes('let a captive out') && t.includes('More guards'))).toBe(true);
    // They do run: a while later they are nearer their own Town Center than the camp is.
    const tc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    const far = (x: number, y: number) => Math.hypot(x - tc.x, y - tc.y);
    through(20);
    expect(home().some((u) => far(u.x, u.y) < far(camp.x, camp.y) - 5)).toBe(true);
  });

  it('more soldiers work faster', () => {
    const one = camped(8, 0), four = camped(8, 0);
    one.send(1, 1); four.send(1, 4);
    one.through(RESCUE_TIME * 2 + 1); four.through(RESCUE_TIME * 2 + 1);
    expect(one.camp.captives!.length).toBe(6);
    expect(four.camp.captives!.length).toBe(0);
  });

  it('each guard holds off two soldiers: too few get no one out, one more than that does', () => {
    const few = camped(6, 2);
    expect(few.camp.staff!.length).toBe(2);
    expect(rescueForce(few.camp)).toBe(RESCUE_GUARD * 2 + 1);
    const us = few.send(1, 4);
    few.through(60);
    expect(rescuers(few.g, few.camp, 1).length).toBe(4);
    expect(few.camp.captives!.length).toBe(6);
    expect(us.every((u) => !u.dead)).toBe(true);
    few.send(1, 1);
    few.through(RESCUE_TIME + 2);
    expect(few.camp.captives!.length).toBe(5);
    expect(few.said[0].some((t) => t.includes('let a captive out'))).toBe(true);
  });

  it('no one is let out with no soldier there, by soldiers who stand off, or by the keeper\'s own men', () => {
    const empty = camped(3, 0);
    empty.through(60);
    expect(empty.camp.captives!.length).toBe(3);
    const off = camped(3, 0);
    const far = off.g.spawnUnit('swordsman', 1, off.camp.x, off.camp.y + off.camp.size / 2 + 6);
    far.stance = 'hold';
    off.through(60);
    expect(rescuers(off.g, off.camp, 1).length).toBe(0);
    expect(off.camp.captives!.length).toBe(3);
    const own = camped(3, 0);
    own.send(0, 3);
    own.through(60);
    expect(own.camp.captives!.length).toBe(3);
  });

  it('soldiers driven off lose the work they had done at the gate', () => {
    const { g, camp, through, send } = camped(3, 0);
    const [u] = send(1, 1);
    through(RESCUE_TIME - 2);
    expect(camp.rescueT).toBeGreaterThan(0);
    g.cmdMove(1, [u.id], camp.x, camp.y + 14);
    through(10);
    expect(camp.rescueT).toBe(0);
    expect(camp.captives!.length).toBe(3);
  });

  it('an ally\'s soldiers can do it, and the people still go to their own town', () => {
    const { camp, through, send, home, g } = camped(2, 0, true);
    send(2, 1);
    through(RESCUE_TIME * 2 + 2);
    expect(camp.captives!.length).toBe(0);
    expect(home().length).toBe(2);
    expect(g.units.some((u) => u.owner === 2 && u.name.startsWith('Held'))).toBe(false);
  });

  it('a villager or a Slaver at the gate rescues no one', () => {
    const { g, camp, through } = camped(2, 0);
    g.spawnUnit('villager', 1, camp.x, camp.y + camp.size / 2 + 1, 'm');
    g.spawnUnit('slaver', 1, camp.x + 1, camp.y + camp.size / 2 + 1).stance = 'hold';
    through(30);
    expect(rescuers(g, camp, 1).length).toBe(0);
    expect(camp.captives!.length).toBe(2);
  });
});

describe('what the keeper of a camp can be told to do', () => {
  it('heldAt names the camps holding a town\'s people and the force each needs', () => {
    const { g, camp } = camped(5, 2);
    expect(heldAt(g, 1)).toEqual([{ camp, held: 5, force: 5 }]);
    expect(heldAt(g, 0)).toEqual([]);
  });

  it('guardsShort counts the Slavers still to be trained, and postGuards sends the idle ones to their posts', () => {
    const { g, camp } = camped(7, 0);
    expect(guardsShort(g, 0)).toBe(3); // seven held, three to a guard
    expect(postGuards(g, 0)).toBe(0); // no one to send
    const idle = [0, 1].map((i) => g.spawnUnit('slaver', 0, camp.x - 6 + i, camp.y + 5));
    expect(guardsShort(g, 0)).toBe(1);
    expect(postGuards(g, 0)).toBe(2);
    expect(postGuards(g, 0)).toBe(0); // already on their way: not sent twice
    expect(guardsShort(g, 0)).toBe(1);
    run(g, 10);
    expect(camp.staff!.length).toBe(2);
    expect(idle.every((u) => u.inside === camp.id)).toBe(true);
    expect(g.unwatched(camp)).toBe(1);
    // A Slaver leading a captive, or one already sent after someone, is left to his work.
    const busy = g.spawnUnit('slaver', 0, camp.x - 6, camp.y + 5);
    busy.captive = { from: 1, name: 'Led', family: '', gender: 'm', trait: '', trait2: '', age: 0, lifespan: 9999 };
    expect(postGuards(g, 0)).toBe(0);
    // An empty camp wants no guard.
    const none = camped(0, 0);
    none.g.spawnUnit('slaver', 0, none.camp.x - 6, none.camp.y + 5);
    expect(guardsShort(none.g, 0)).toBe(0);
    expect(postGuards(none.g, 0)).toBe(0);
  });
});
