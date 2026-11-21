// Those held in the marauders' camp are let out at its gate, once the band there is beaten (src/sim/rescue.ts).
import { describe, expect, it } from 'vitest';
import { Game, LAIR_AT } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/game';
import { LAIR_WATCH, RESCUE_TIME, bandAtCamp, gateWork, gated, rescue } from '../src/sim/rescue';
import { gatePanel, gateSign } from '../src/client/gate';
import { run } from './helpers';

const two = [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }];
/** A battle with the marauders' camp just made, holding `held` people taken from the first town. */
const camp = (held = 3, seed = 3) => {
  const g = new Game(seed, two);
  g.marauders = true;
  for (const p of g.players) p.dilemmaT = 1e9;
  const said: string[][] = g.players.map(() => []);
  const through = (seconds: number) => run(g, seconds, () => { for (const e of g.events) if (e.t === 'msg') said[e.player]?.push(e.text); g.events.length = 0; });
  through(LAIR_AT + 2);
  const lair = g.buildings.find((b) => b.type === 'lair')!;
  lair.captives = Array.from({ length: held }, (_, i) => ({ from: 0, name: 'Held' + i, family: '', gender: i % 2 ? 'f' as const : 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999 }));
  const band = () => g.units.filter((u) => u.def.marauder && !u.dead);
  const kill = (e: Building | Unit) => (g as unknown as { kill(e: Building | Unit): void }).kill(e);
  const send = (owner: number, n: number): Unit[] => {
    const us = Array.from({ length: n }, (_, i) => g.spawnUnit('swordsman', owner, lair.x - 1 + i * 0.6, lair.y + lair.size / 2 + 1));
    for (const u of us) u.stance = 'hold';
    return us;
  };
  const home = () => g.units.filter((u) => u.owner === 0 && u.name.startsWith('Held'));
  return { g, lair, said, through, band, kill, send, home };
};

describe('the gate of the marauders\' camp', () => {
  it('is a gate like a Work Camp\'s, and its guard is the band standing at it', () => {
    const { g, lair, band } = camp();
    expect(gated(lair)).toBe(true);
    expect(gated(g.buildings.find((b) => b.type === 'towncenter')!)).toBe(false);
    expect(bandAtCamp(g, lair)).toBe(band().filter((u) => Math.hypot(u.x - lair.x, u.y - lair.y) <= LAIR_WATCH && !u.captive).length);
    expect(bandAtCamp(g, lair)).toBeGreaterThan(0);
    expect(bandAtCamp(g, g.buildings.find((b) => b.type === 'towncenter')!)).toBe(0);
  });
  it('while any of the band stands at the camp nobody is let out, however many soldiers have come', () => {
    const { g, lair, send } = camp();
    send(0, 8);
    const w = gateWork(g, lair)!;
    expect(w.soldiers).toBe(8);
    expect(w.spare).toBe(0);
    expect(w.band).toBe(bandAtCamp(g, lair));
    expect(rescue(g, lair, { lair: true })).toBe(0);
    expect(lair.captives).toHaveLength(3);
    expect(gateSign(g, lair, 0)).toMatchObject({ working: false, text: `🏴 ${w.band}` });
    expect(gatePanel(g, lair, 0)).toContain('stand guard at the camp');
  });
  it('the band beaten, one soldier at the gate lets those held out one at a time, and they go home as themselves with the camp unburnt', () => {
    const { g, lair, said, through, band, kill, send, home } = camp();
    for (const u of band()) kill(u);
    expect(bandAtCamp(g, lair)).toBe(0);
    send(0, 1);
    expect(gateWork(g, lair)).toMatchObject({ soldiers: 1, spare: 1, band: 0, force: 1 });
    through(RESCUE_TIME + 2);
    expect(home().length).toBe(1);
    expect(lair.captives).toHaveLength(2);
    through(RESCUE_TIME * 2 + 2);
    expect(home().length).toBe(3);
    expect(lair.captives ?? []).toHaveLength(0);
    expect(lair.dead).toBeFalsy();
    expect(said[0].some((t) => t.includes('marauders\' camp have let'))).toBe(true);
    expect(home().every((u) => u.type === 'villager')).toBe(true);
  });
  it('more soldiers work faster, and a marauder come back to the camp stops it', () => {
    const { g, lair, through, band, kill, send, home } = camp(6);
    for (const u of band()) kill(u);
    send(0, 3);
    through(RESCUE_TIME + 1);
    expect(home().length).toBeGreaterThanOrEqual(3);
    const left = lair.captives!.length;
    const back = g.spawnUnit('marauder', g.wild, lair.x, lair.y + 2.4);
    back.hp = back.maxHp = 1e6; // he is not to be cut down in this test
    expect(rescue(g, lair, { lair: true })).toBe(0);
    expect(lair.captives!.length).toBe(left);
  });
  it('the other town\'s soldiers do not let them out for it, and the keeper\'s own second does not work this gate', () => {
    const { g, lair, through, band, kill, send, home } = camp();
    for (const u of band()) kill(u);
    send(1, 4); // no ally of the town they were taken from
    through(RESCUE_TIME + 2);
    expect(home().length).toBe(0);
    send(0, 1);
    expect(rescue(g, lair)).toBe(0); // called as for a Work Camp: nothing
  });
});
