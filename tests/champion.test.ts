import { describe, expect, it } from 'vitest';
import { armyAt, finishBattle, heroFor, moveArmy, newCampaign } from '../src/sim/campaign';
import { CHAMPION_KILLS, championName, rankForKills } from '../src/sim/champion';
import { UNITS } from '../src/sim/data';
import { HEIR_AGE, claimants, houseOf, succeed } from '../src/sim/dynasty';
import { Game } from '../src/sim/game';
import { RANK_XP } from '../src/sim/hero';
import { run } from './helpers';

const two = () => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: { name: 'Edric' } }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  return g;
};
/** Let a soldier cut down a number of villagers set beside him. */
const blood = (g: Game, x: number, y: number, n: number) => {
  const s = g.spawnUnit('swordsman', 0, x, y);
  for (let i = 0; i < n; i++) g.spawnUnit('villager', 1, x + 0.7 + (i % 3) * 0.4, y - 0.3 + Math.floor(i / 3) * 0.4);
  run(g, 10 + n * 5);
  return s;
};

describe('soldiers who make a name', () => {
  it('one who has felled three is known by name; only when the leader has fallen can they be raised', () => {
    expect([0, 2, 3, 5, 6, 15, 99].map(rankForKills)).toEqual([0, 0, 1, 1, 2, 5, 5]);
    const g = two();
    const w = g.spawnUnit('warlord', 0, 20.5, 20.5);
    const s = blood(g, 46.5, 46.5, 6);
    expect(s.kills).toBe(6);
    expect(s.name).toBe(championName(s.id));
    expect(g.champion(0)).toEqual({ name: s.name, kills: 6, unit: UNITS.swordsman.name });
    expect(g.canAcclaim(0, s)).toBe(false); // the leader lives
    expect(g.cmdAcclaim(0, s.id)).toBe(false);
    const green = g.spawnUnit('swordsman', 0, 40.5, 40.5);
    // The leader falls.
    const foe = g.spawnUnit('knight', 1, 21.3, 20.5);
    w.hp = 1; w.stance = 'hold';
    g.cmdTarget(1, [foe.id], w.id);
    run(g, 6);
    expect(w.dead).toBe(true);
    expect(g.players[0].heroFell).toBe(true);
    expect(g.canAcclaim(0, green)).toBe(false); // he has done nothing yet
    expect(g.canAcclaim(1, s)).toBe(false); // not theirs to raise
    const pop = g.players[0].pop, hurt = (s.hp = s.maxHp / 2) / s.maxHp;
    expect(g.cmdAcclaim(0, s.id)).toBe(true);
    expect(s.type).toBe('warlord');
    expect(s.hero).toEqual({ xp: RANK_XP[2], rank: 2 });
    expect(g.heroOf(0)).toMatchObject({ name: s.name, calling: 'warlord', bent: 'strength' });
    expect(g.players[0]).toMatchObject({ heroRank: 2, acclaimed: true });
    expect(g.players[0].pop).toBe(pop + UNITS.warlord.pop - UNITS.swordsman.pop);
    expect(s.hp / s.maxHp).toBeCloseTo(hurt); // as wounded as he was
    expect(s.def.aura).toBe(1.35); // Battle cry, a fighter's power, come into at Blooded
    expect(g.canAcclaim(0, s)).toBe(false);
    expect(g.champion(0)).toBeNull(); // the leader is not counted among the soldiers
    run(g, 1);
    expect(g.auraAt(0, s.x + 1, s.y)).toBeGreaterThan(1); // and he leads as a Warlord does
  });

  it('engines, hired swords and the unblooded are never raised', () => {
    const g = two();
    g.players[0].heroFell = true;
    const ram = g.spawnUnit('ram', 0, 40.5, 40.5), merc = g.spawnUnit('swordsman', 0, 41.5, 40.5), raw = g.spawnUnit('swordsman', 0, 42.5, 40.5), ok = g.spawnUnit('bowman', 0, 43.5, 40.5);
    for (const u of [ram, merc, ok]) u.kills = CHAMPION_KILLS;
    merc.merc = true;
    expect([ram, merc, raw, ok].map((u) => g.canAcclaim(0, u))).toEqual([false, false, false, true]);
  });
});

describe('a soldier remembered on the campaign map', () => {
  const start = () => {
    const c = newCampaign(3);
    c.factions[0].hero = { name: 'Brunhild', female: true };
    c.factions[0].heroRank = 2;
    houseOf(c, 0);
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    expect(moveArmy(c, army.id, home.adj[0])).toBe('battle');
    return { c, army };
  };

  it('the best of them who lived is the captain a succession can turn to', () => {
    const { c, army } = start();
    finishBattle(c, true, { clubman: 6 }, { fell: true, champion: { name: 'Garrick', kills: 7, unit: 'Clubman' } });
    expect(c.factions[0].heroAlive).toBe(false);
    expect(army.champion).toEqual({ name: 'Garrick', kills: 7, unit: 'Clubman' });
    const captain = claimants(c, 0).find((x) => x.kind === 'captain')!;
    expect(captain).toMatchObject({ name: 'Garrick', rank: 2, i: army.id });
    expect(captain.what).toContain('A clubman who felled 7');
    expect(succeed(c, 0, captain)).toBe(true);
    expect(heroFor(c, 0)).toMatchObject({ name: 'Garrick', rank: 2 });
    expect(army.champion).toBeUndefined();
  });

  it('a leader who fell counts as fallen even if another hero was raised after, unless a soldier was acclaimed there', () => {
    const a = start();
    finishBattle(a.c, true, { clubman: 6, warlord: 1 }, { fell: true, heroRank: 1 });
    expect(a.c.factions[0].heroAlive).toBe(false);
    expect(a.army.hero).toBe(false);
    expect(a.c.factions[0].heroRank).toBe(1);
    const b = start();
    b.c.turn += HEIR_AGE;
    finishBattle(b.c, true, { clubman: 5, warlord: 1 }, { fell: true, heroRank: 2, acclaimed: { name: 'Holt', calling: 'warlord', bent: 'strength', might: 3, guard: 2, vigour: 1 } });
    expect(b.c.factions[0].heroAlive).toBe(true);
    expect(b.army.hero).toBe(true);
    expect(heroFor(b.c, 0)).toMatchObject({ name: 'Holt', rank: 2, might: 3 });
    expect(houseOf(b.c, 0)).toMatchObject({ heirs: [], line: 2 });
    expect(b.c.log.at(-1)).toContain('Holt was raised on the shields');
  });
});
