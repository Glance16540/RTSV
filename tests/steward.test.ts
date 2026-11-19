// The Steward, a third calling for the leader (src/sim/steward.ts): villagers near them work faster, and their call
// mans the walls. Nobody is a Steward unless a player makes one.
import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNITS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { cleanHero, defaultHero } from '../src/sim/hero';
import { CALLS, CALL_LASTS, CALL_RANK, POWERS, POWER_RANKS, leaderDef, rivalHero } from '../src/sim/powers';
import { STEWARD, stewardPace } from '../src/sim/steward';
import { run } from './helpers';

const two = (hero = {}) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: { name: 'Aldith', calling: 'steward', ...hero } }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  return g;
};

describe('the Steward', () => {
  it('is a calling like the others: a hero of their own, raised at the Town Center, with a call and three pairs of powers', () => {
    const d = UNITS.steward;
    expect(d.cls).toBe('hero');
    expect(d.limit).toBe(1);
    expect(d.workAura).toBe(STEWARD.work);
    expect(d.weaken ?? 1).toBe(1);
    expect(d.heal ?? 0).toBe(0);
    expect(d.atk).toBeLessThan(UNITS.warlord.atk); // a little weaker in the fight than a Warlord
    expect(BUILDINGS.towncenter.trains).toContain('steward');
    expect(cleanHero({ name: 'Aldith', calling: 'steward' }, 'hearth').calling).toBe('steward');
    expect(cleanHero({ name: 'X', calling: 'nobody' as never }, 'hearth').calling).toBe('warlord');
    expect(POWERS.steward).toHaveLength(POWER_RANKS.length);
    expect(CALLS.steward.desc).toContain(`${CALL_LASTS} seconds`);
    expect(CALLS.steward.ward).toBe(STEWARD.ward);
  });

  it('no people\'s leader as written, nor any rival\'s, is a Steward', () => {
    for (const civ of ['hearth', 'forge', 'wild', 'stonekin', 'steppe', 'babylon', 'greece', 'egypt', 'england', 'arabs', 'mali', 'kush', 'persia', 'japan', 'dawn']) {
      expect(defaultHero(civ).calling).not.toBe('steward');
      expect(rivalHero(civ).calling).not.toBe('steward');
    }
  });

  it('their powers change what they are on the field', () => {
    const h = cleanHero({ name: 'Aldith', calling: 'steward', powers: [0, 1, 1] }, 'hearth');
    const d = leaderDef(UNITS.steward, h, 5);
    expect(d.workAura).toBe(1.4);
    expect(d.armor).toBe(UNITS.steward.armor + 2);
    expect(d.heal).toBeGreaterThan(0);
  });

  it('villagers of theirs within reach gather faster; those out of reach, and soldiers, do not', () => {
    const g = two();
    const l = g.spawnUnit('steward', 0, 46.5, 46.5);
    const near = g.spawnUnit('villager', 0, 48.5, 46.5, 'm'), far = g.spawnUnit('villager', 0, 70.5, 70.5, 'm');
    const soldier = g.spawnUnit('swordsman', 0, 47.5, 46.5), theirs = g.spawnUnit('villager', 1, 47.5, 47.5, 'm');
    for (const u of [l, near, far, soldier, theirs]) u.stance = 'hold';
    g.step(); // the game finds its leaders as a step begins
    expect(g.leaders[0]).toBe(l);
    expect(stewardPace(g, near)).toBe(l.def.workAura);
    expect([stewardPace(g, far), stewardPace(g, soldier), stewardPace(g, theirs)]).toEqual([1, 1, 1]);
    l.dead = true;
    expect(stewardPace(g, near)).toBe(1);
  });

  it('a building goes up faster with the Steward beside its builders', () => {
    const built = (steward: boolean) => {
      const g = two();
      if (steward) g.spawnUnit('steward', 0, 44.5, 50.5).stance = 'hold';
      const b = g.spawnBuilding('house', 0, 46, 50, false);
      const v = g.spawnUnit('villager', 0, 46.5, 52.5, 'm');
      g.cmdTarget(0, [v.id], b.id);
      run(g, 6);
      return b.progress;
    };
    const plain = built(false), near = built(true);
    expect(plain).toBeGreaterThan(0);
    expect(near / plain).toBeGreaterThan(STEWARD.work - 0.1);
  });

  it('their call spares buildings within reach harm', () => {
    const harm = (call: boolean) => {
      const g = two({ rank: CALL_RANK });
      const l = g.spawnUnit('steward', 0, 46.5, 42.5);
      l.stance = 'hold';
      const wall = g.spawnBuilding('stonewall', 0, 46, 46, true);
      const foe = g.spawnUnit('swordsman', 1, 46.5, 48.2);
      g.cmdTarget(1, [foe.id], wall.id);
      run(g, 1);
      if (call) expect(g.cmdCall(0)).toBe(true);
      run(g, CALL_LASTS - 2);
      return wall.maxHp - wall.hp;
    };
    const plain = harm(false);
    expect(plain).toBeGreaterThan(0);
    expect(harm(true)).toBeLessThan(plain * (STEWARD.ward + 0.12));
  });
});
