import { describe, expect, it } from 'vitest';
import { HERO_RANK_STRENGTH, HERO_STRENGTH, armyAt, armyStrength, defence, heroFor, newCampaign, strengthVs } from '../src/sim/campaign';
import { CIV_IDS, UNITS } from '../src/sim/data';
import { HEIR_AGE, autoSucceed, houseOf, rulerName } from '../src/sim/dynasty';
import { Game } from '../src/sim/game';
import { HERO_POINTS, HeroSpec, RANK_XP, cleanHero } from '../src/sim/hero';
import { LEADERS } from '../src/sim/leaders';
import { POWERS, POWER_RANKS, leaderDef, powersHeld, rivalHero } from '../src/sim/powers';
import { run } from './helpers';

const made = (over: Partial<HeroSpec>): HeroSpec => cleanHero({ name: 'Edric', might: 2, guard: 2, vigour: 2, ...over }, 'hearth');

describe('what a leader learns', () => {
  it('one power of two is come into at each of three ranks, by the choice made for them', () => {
    expect(POWER_RANKS).toEqual([1, 3, 5]);
    for (const calling of ['warlord', 'strategist'] as const) {
      expect(POWERS[calling].length).toBe(3);
      for (const pair of POWERS[calling]) for (const p of pair) { expect(p.name.length).toBeGreaterThan(3); expect(p.desc.length).toBeGreaterThan(15); }
    }
    const h = made({ powers: [1, 0, 1] });
    expect(powersHeld(h, 0)).toEqual([]);
    expect(powersHeld(h, 2).map((p) => p.name)).toEqual(['The long banner']);
    expect(powersHeld(h, 5).map((p) => p.name)).toEqual(['The long banner', 'Drinker of blood', 'Fury']);
    expect(cleanHero({ powers: [7, 1] as number[] }, 'hearth').powers).toEqual([0, 1, 0]); // anything but a plain choice is the first
    const w = UNITS.warlord;
    expect(leaderDef(w, h, 0)).toBe(w);
    expect(leaderDef(w, h, 5)).toMatchObject({ auraRange: w.auraRange! + 3, drain: 6, frenzy: true, aura: w.aura });
    expect(leaderDef(w, made({ powers: [0, 1, 0] }), 5)).toMatchObject({ aura: 1.35, rangedResist: 0.4, weaken: 0.88 });
    const s = UNITS.strategist, sage = made({ calling: 'strategist', powers: [0, 0, 1] });
    expect(leaderDef(s, sage, 5)).toMatchObject({ heal: s.heal! * 1.6, weaken: 0.7, range: s.range + 2 });
    expect(UNITS.warlord.drain).toBeUndefined(); // the plain hero is left as it was
  });

  it('on the field the power comes with the rank, tells, and outlives a save', () => {
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: made({ powers: [1, 0, 0], rank: 0 }) }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
    g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    expect(w.def.auraRange).toBe(UNITS.warlord.auraRange);
    const far = g.spawnUnit('clubman', 0, 46.5 + UNITS.warlord.auraRange! + 2, 46.5);
    expect(g.auraAt(0, far.x, far.y)).toBe(1);
    for (let i = 0; i < RANK_XP[1]; i++) g.spawnUnit('villager', 1, 47.2 + (i % 3) * 0.4, 46.2 + Math.floor(i / 3) * 0.4);
    run(g, 40);
    expect(w.hero!.rank).toBe(1);
    expect(w.def.auraRange).toBe(UNITS.warlord.auraRange! + 3);
    run(g, 1);
    far.x = w.x + UNITS.warlord.auraRange! + 2; far.y = w.y;
    run(g, 0.1);
    expect(g.auraAt(0, far.x, far.y)).toBe(UNITS.warlord.aura);
    const back = Game.restore(g.serialize());
    const again = back.units.find((u) => u.hero)!;
    expect(again.def.auraRange).toBe(UNITS.warlord.auraRange! + 3);
    // A leader who comes to the field already a veteran has what a veteran has.
    const h = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: made({ powers: [0, 0, 0], rank: 3 }) }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
    expect(h.spawnUnit('warlord', 0, 46.5, 46.5).def).toMatchObject({ aura: 1.35, drain: 6 });
  });
});

describe('rival leaders', () => {
  it('each people\'s leader is made to suit how they live, with every point spent', () => {
    const builds = new Set<string>();
    for (const civ of CIV_IDS) {
      const h = rivalHero(civ);
      expect(h.name).toBe(LEADERS[civ].name);
      expect(h.might + h.guard + h.vigour, civ).toBe(HERO_POINTS);
      builds.add([h.bent, h.might, h.guard, h.vigour, h.powers!.join('')].join());
    }
    expect(builds.size).toBeGreaterThanOrEqual(6);
    expect(rivalHero('steppe')).toMatchObject({ bent: 'strength', might: 4 });
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'steppe' }]);
    expect(g.heroOf(1)).toMatchObject({ might: 4, powers: [0, 0, 1] });
    expect(g.heroOf(0)).toMatchObject({ might: 2, guard: 2, vigour: 2 }); // yours, unmade, is still as written
    const c = newCampaign(3);
    expect(heroFor(c, 1)).toMatchObject(rivalHero(c.factions[1].civ));
  });

  it('a rival\'s successor is named wherever their leader is, and the news reaches you', () => {
    const c = newCampaign(3);
    const rival = c.factions[1], seat = c.territories.find((t) => t.capital === 1)!;
    expect(rulerName(c, 1)).toBe(LEADERS[rival.civ].name);
    houseOf(c, 1);
    armyAt(c, seat.id)!.hero = false; rival.heroAlive = false;
    c.turn += HEIR_AGE;
    const log = c.log.length;
    expect(autoSucceed(c, 1)).toBe(true);
    expect(rulerName(c, 1)).toBe(heroFor(c, 1).name);
    expect(rulerName(c, 1)).not.toBe(LEADERS[rival.civ].name);
    expect(c.log.slice(log).join(' ')).toContain(`${LEADERS[rival.civ].name} of the ${rival.name} is dead`);
    expect(heroFor(c, 1)).toMatchObject({ might: rivalHero(rival.civ).might, powers: rivalHero(rival.civ).powers }); // the heir has the parent's making
  });
});

describe('a veteran leader on the campaign map', () => {
  it('adds half a point of strength for each rank to the army they march with', () => {
    const c = newCampaign(3);
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    const plain = armyStrength(army);
    expect(armyStrength(army, c)).toBe(plain);
    expect(strengthVs(army, {}, 4)).toBe(plain + 4 * HERO_RANK_STRENGTH);
    const held = defence(c, home.id);
    c.factions[0].heroRank = 4;
    expect(armyStrength(army, c)).toBe(plain + 2);
    expect(defence(c, home.id)).toBeGreaterThan(held);
    army.hero = false;
    expect(armyStrength(army, c)).toBe(plain - HERO_STRENGTH); // their name counts for nothing where they are not
  });
});
