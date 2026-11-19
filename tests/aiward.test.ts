// A computer-played town and the marauders: it hides its women from a raiding party and sends a rider to find the camp
// (src/sim/aiward.ts; marauders.ts partyNear, hideWomen, scoutSpots).
import { describe, expect, it } from 'vitest';
import { Game, LAIR_AT } from '../src/sim/game';
import type { Unit } from '../src/sim/game';
import { AIController } from '../src/sim/ai';
import { WARD, WardState, wardScout, wardWomen } from '../src/sim/aiward';
import { PARTY_NEAR, partyNear, scoutSpots, womenAtRisk } from '../src/sim/marauders';
import { run } from './helpers';

const two = [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }];
/** A battle with a camp just made. */
const withCamp = (seed = 3) => {
  const g = new Game(seed, two);
  g.marauders = true;
  for (const p of g.players) p.dilemmaT = 1e9;
  run(g, LAIR_AT + 2);
  const lair = () => g.buildings.find((b) => b.type === 'lair');
  const band = () => g.units.filter((u) => u.def.marauder && !u.dead);
  const kill = (e: Unit) => (g as unknown as { kill(e: Unit): void }).kill(e);
  return { g, lair, band, kill };
};

describe('the women are got indoors from a raiding party', () => {
  it('nothing is done while no party is near; when one comes for them they are sent in; when it is gone they come out', () => {
    const { g, band, kill } = withCamp();
    const w: WardState = {}, tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    expect(wardWomen(g, 0, w)).toBe(0);
    expect(w.hid).toBeFalsy();
    const out = womenAtRisk(g, 0), man = band()[0];
    expect(out.length).toBeGreaterThan(0);
    g.cmdTarget(g.wild, [man.id], out[0].id);
    man.x = tc.x + PARTY_NEAR - 3; man.y = tc.y;
    expect(partyNear(g, 0)).toEqual([man]);
    expect(wardWomen(g, 0, w)).toBe(Math.min(out.length, 12));
    expect(w.hid).toBe(true);
    expect(out.every((v) => v.order?.t === 'shelter' || v.inside)).toBe(out.length <= 12);
    expect(wardWomen(g, 0, w)).toBe(0); // not sent twice
    expect(wardWomen(g, 1, {})).toBe(0); // not the other town's trouble
    // The men work on, and no bell is rung for it.
    expect(g.units.filter((v) => v.owner === 0 && v.type === 'villager' && v.gender === 'm' && v.order?.t === 'shelter')).toHaveLength(0);
    expect(g.players[0].bell).toBeFalsy();
    run(g, 20);
    kill(man);
    expect(partyNear(g, 0)).toEqual([]);
    wardWomen(g, 0, w);
    expect(w.hid).toBe(false);
    run(g, 3);
    expect(g.units.filter((v) => v.owner === 0 && v.type === 'villager' && v.gender === 'f' && !v.dead && (v.inside || v.order?.t === 'shelter'))).toHaveLength(0);
  });

  it('a bell rung for an attack is not rung off by the party\'s going: that is the attack\'s own rule', () => {
    const { g, band, kill } = withCamp();
    const w: WardState = {}, tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!, man = band()[0];
    g.cmdTarget(g.wild, [man.id], womenAtRisk(g, 0)[0].id);
    man.x = tc.x + PARTY_NEAR - 3; man.y = tc.y;
    wardWomen(g, 0, w);
    g.cmdBell(0, true);
    kill(man);
    wardWomen(g, 0, w);
    expect(w.hid).toBe(false);
    expect(g.players[0].bell).toBe(true);
  });
});

describe('a rider looks for the camp', () => {
  const fighters = (g: Game, n: number): Unit[] => { const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!; return Array.from({ length: n }, (_, i) => g.spawnUnit('clubman', 0, tc.x + 3 + i, tc.y + 4)); };

  it('not with too few fighters to spare, nor when it may not; with enough, the fastest goes to the first place a camp could be, then the next', () => {
    const { g } = withCamp();
    const w: WardState = {}, spots = scoutSpots(g, 0);
    expect(spots.length).toBeGreaterThan(1);
    expect(wardScout(g, 0, w, fighters(g, WARD.least - 1), true)).toBeNull();
    expect(w.scout).toBeUndefined();
    const men = fighters(g, WARD.least);
    expect(wardScout(g, 0, w, men, false)).toBeNull();
    const first = wardScout(g, 0, w, men, true)!;
    expect(first).toEqual(spots[0]);
    const rider = g.units.find((u) => u.id === w.scout)!;
    expect(men).toContain(rider);
    expect(rider.order).toBeTruthy();
    expect(wardScout(g, 0, w, men, true)).toBeNull(); // on his way: not sent again
    rider.order = null;
    expect(wardScout(g, 0, w, men, true)).toEqual(spots[1]);
    // The rider killed, another is sent.
    (g as unknown as { kill(e: Unit): void }).kill(rider);
    const again = wardScout(g, 0, w, men.filter((u) => u !== rider && !u.dead).concat(fighters(g, 1)), true);
    expect(again).toBeTruthy();
    expect(w.scout).not.toBe(rider.id);
  });

  it('once one of the town\'s own has the camp in sight nobody rides', () => {
    const { g, lair } = withCamp();
    const w: WardState = {}, men = fighters(g, WARD.least);
    g.spawnUnit('swordsman', 0, lair()!.x + 4, lair()!.y).stance = 'hold';
    expect(scoutSpots(g, 0)).toEqual([]);
    expect(wardScout(g, 0, w, men, true)).toBeNull();
    expect(w.scout).toBeUndefined();
  });
});

describe('the computer player does both', () => {
  it('a computer-played town finds the camp by its own scout in a battle with marauders, where it used to learn of it only by losing someone or by chance', () => {
    let found = 0, rode = 0;
    for (const seed of [3, 5, 8, 11]) {
      const g = new Game(seed, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'england' }]);
      g.marauders = true;
      for (const p of g.players) p.dilemmaT = 1e9;
      const ais = g.players.slice(0, 2).map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
      for (let s = 0; s < LAIR_AT + 420; s++) { for (const a of ais) a.update(); run(g, 1); }
      const saved = ais.map((a) => a.save() as { knowsLair?: boolean; ward?: WardState });
      if (saved.some((x) => x.ward?.scoutI)) rode++;
      if (saved.some((x) => x.knowsLair)) found++;
    }
    expect(rode).toBeGreaterThan(0);
    expect(found).toBeGreaterThan(0);
  });
});
