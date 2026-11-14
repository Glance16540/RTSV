// Round three of the leader on the field: a power chosen at the moment its rank is earned, a soldier raised to lead
// who goes on fighting as what they were (and need not be a man), and rivals who live alike led differently.
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, finishBattle, heroFor, moveArmy, newCampaign } from '../src/sim/campaign';
import { championFemale, championName, championSpec, cleanChampion } from '../src/sim/champion';
import { CIV_IDS, CIV_STYLE, NAMES_F, NAMES_M, UNITS } from '../src/sim/data';
import { claimants, houseOf, succeed } from '../src/sim/dynasty';
import { Game } from '../src/sim/game';
import { HeroSpec, RANK_XP, cleanHero } from '../src/sim/hero';
import { POWERS, leaderDef, leaderType, powerDue, powersHeld, rivalHero } from '../src/sim/powers';
import { run } from './helpers';

const made = (over: Partial<HeroSpec>): HeroSpec => cleanHero({ name: 'Edric', might: 2, guard: 2, vigour: 2, ...over }, 'hearth');
const game = (hero: Partial<HeroSpec>, ai = false) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: ai, civ: 'hearth', hero: made(hero) }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  return g;
};
/** Fell villagers beside the leader until they have this many deeds. */
const deeds = (g: Game, w: { x: number; y: number; hero?: { xp: number } }, xp: number) => {
  for (let guard = 0; w.hero!.xp < xp && guard < 80; guard++) {
    const v = g.spawnUnit('villager', 1, w.x + 0.8, w.y);
    v.hp = 1;
    run(g, 3);
  }
};

describe('a power chosen when its rank is earned', () => {
  it('a leader made with nothing chosen holds no power until the player chooses, and the choice stands', () => {
    expect(made({}).powers).toEqual([-1, -1, -1]);
    expect(powerDue(made({}), 0)).toBe(-1);
    expect(powerDue(made({}), 1)).toBe(0);
    expect(powerDue(made({ powers: [1, -1, -1] }), 2)).toBe(-1); // nothing new at Seasoned
    expect(powerDue(made({ powers: [1, -1, -1] }), 4)).toBe(1);
    expect(powerDue(made({ powers: [0, 1, 0] }), 5)).toBe(-1); // all chosen at the making, as before
    expect(powersHeld(made({ powers: [-1, 1, -1] }), 5).map((p) => p.name)).toEqual(['Shield high']);

    const g = game({});
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    expect(g.powerDue(0)).toBe(-1);
    expect(g.cmdLearn(0, 0)).toBe(false); // nothing earned yet
    deeds(g, w, RANK_XP[1]);
    expect(w.hero!.rank).toBe(1);
    expect(g.powerDue(0)).toBe(0);
    expect(w.def.auraRange).toBe(UNITS.warlord.auraRange); // not theirs until chosen
    expect(g.cmdLearn(0, 2)).toBe(false);
    expect(g.cmdLearn(0, 1)).toBe(true);
    expect(w.def.auraRange).toBe(UNITS.warlord.auraRange! + 3); // The long banner
    expect(g.heroOf(0).powers).toEqual([1, -1, -1]);
    expect(g.powerDue(0)).toBe(-1);
    expect(g.cmdLearn(0, 0)).toBe(false); // and it cannot be chosen again
    // A saved game brings them back as they chose.
    const again = Game.restore(g.serialize());
    expect(again.units.find((u) => u.hero)!.def.auraRange).toBe(UNITS.warlord.auraRange! + 3);
    expect(again.powerDue(0)).toBe(-1);
  });

  it('a leader who comes to the field with ranks behind them chooses each power owed, in order', () => {
    const g = game({ rank: 3 });
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    expect(g.powerDue(0)).toBe(0);
    expect(g.cmdLearn(0, 0)).toBe(true);
    expect(g.powerDue(0)).toBe(1);
    expect(g.cmdLearn(0, 0)).toBe(true);
    expect(g.powerDue(0)).toBe(-1);
    expect(w.def).toMatchObject({ aura: 1.35, drain: 6 });
  });

  it('a rival does not wait to be asked', () => {
    const g = game({}, true);
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    w.stance = 'aggressive';
    deeds(g, w, RANK_XP[1]);
    expect(w.hero!.rank).toBeGreaterThanOrEqual(1);
    expect(g.powerDue(0)).toBe(-1);
    expect(g.heroOf(0).powers![0]).toBe(0);
  });

  it('what was chosen in a campaign battle goes home with the leader', () => {
    const c = newCampaign(3);
    c.factions[0].hero = { name: 'Brunhild', female: true };
    houseOf(c, 0);
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    expect(heroFor(c, 0).powers).toEqual([-1, -1, -1]);
    expect(moveArmy(c, army.id, home.adj[0])).toBe('battle');
    finishBattle(c, true, { clubman: 6, warlord: 1 }, { heroRank: 1, powers: [1, -1, -1] });
    expect(heroFor(c, 0)).toMatchObject({ name: 'Brunhild', rank: 1, powers: [1, -1, -1] });
  });
});

describe('a soldier raised keeps their arm', () => {
  it('names fall to women as well as men, fixed by who the soldier is', () => {
    const ids = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(ids.some(championFemale)).toBe(true);
    expect(ids.some((i) => !championFemale(i))).toBe(true);
    for (const i of ids) expect((championFemale(i) ? NAMES_F : NAMES_M)).toContain(championName(i));
    expect(championSpec('Hild', true, 'knight')).toMatchObject({ female: true, fights: 'knight', powers: [-1, -1, -1] });
    expect(cleanChampion({ name: 'Hild', kills: 4, unit: 'Knight', female: true, type: 'knight' })).toEqual({ name: 'Hild', kills: 4, unit: 'Knight', female: true, type: 'knight' });
    expect(cleanChampion({ name: 'Hild', kills: 4, unit: 'Knight', type: '<b>' })).toEqual({ name: 'Hild', kills: 4, unit: 'Knight' });
  });

  it('a leader from the ranks takes the field as what they were, with a leader\'s presence, and only once', () => {
    expect(leaderType(made({}))).toBe('warlord');
    expect(leaderType(made({ calling: 'strategist' }))).toBe('strategist');
    expect(leaderType(made({ fights: 'knight' }))).toBe('knight');
    expect(leaderType(made({ fights: 'trebuchet' }))).toBe('warlord'); // nobody leads from an engine
    expect(leaderType(made({ fights: 'no such thing' }))).toBe('warlord');
    expect(leaderDef(UNITS.knight, made({ fights: 'knight' }), 0)).toMatchObject({ atk: UNITS.knight.atk, speed: UNITS.knight.speed, aura: UNITS.warlord.aura, auraRange: UNITS.warlord.auraRange });
    expect(UNITS.knight.aura).toBeUndefined();

    const g = game({ name: 'Hild', female: true, fights: 'bowman', rank: 2 });
    const plain = g.spawnUnit('clubman', 0, 40.5, 40.5);
    expect(plain.hero).toBeUndefined();
    const b = g.spawnUnit('bowman', 0, 46.5, 46.5);
    expect(b.hero).toEqual({ xp: RANK_XP[2], rank: 2 });
    expect(b.name).toBe('Hild');
    expect(b.def.range).toBe(UNITS.bowman.range); // an archer still
    expect(g.spawnUnit('bowman', 0, 47.5, 46.5).hero).toBeUndefined(); // the next archer is only an archer
    expect(g.spawnUnit('warlord', 0, 48.5, 46.5).hero).toBeUndefined(); // and a hired hero is not the leader
    run(g, 1);
    expect(g.auraAt(0, plain.x, plain.y)).toBe(1); // too far
    expect(g.auraAt(0, b.x + 1, b.y)).toBe(UNITS.warlord.aura);
    // When they fall no archer steps into their place.
    b.hp = 0.5;
    const foe = g.spawnUnit('knight', 1, b.x + 0.8, b.y);
    g.cmdTarget(1, [foe.id], b.id);
    run(g, 8);
    expect(b.dead).toBe(true);
    expect(g.players[0].heroFell).toBe(true);
    expect(g.spawnUnit('bowman', 0, 30.5, 30.5).hero).toBeUndefined();
  });

  it('on the campaign map the captain who is raised fights on as what made their name', () => {
    const c = newCampaign(3);
    houseOf(c, 0).heirs = [];
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    army.champion = { name: 'Hild', kills: 7, unit: 'Bowman', female: true, type: 'bowman' };
    army.hero = false;
    c.factions[0].heroAlive = false;
    const claim = claimants(c, 0).find((x) => x.kind === 'captain')!;
    expect(claim).toMatchObject({ name: 'Hild', female: true, rank: 2 });
    expect(claim.what).toContain('she stands');
    expect(succeed(c, 0, claim)).toBe(true);
    expect(heroFor(c, 0)).toMatchObject({ name: 'Hild', female: true, fights: 'bowman', powers: [-1, -1, -1] });
    // In their next battle the army brings one more archer, and that archer is the leader.
    const before = { ...army.units };
    expect(moveArmy(c, army.id, home.adj[0])).toBe('battle');
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].hero).toMatchObject({ fights: 'bowman' });
    army.hero = false;
    const without = battleConfig(c)!;
    expect(without.setups[0].hero?.fights).toBeUndefined(); // an army they are not with has only its own archers
    expect((cfg.setups[0].bonus!.units!.bowman ?? 0) - (without.setups[0].bonus!.units!.bowman ?? 0)).toBe(1);
    army.hero = true;
    expect(army.units).toEqual(before);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field);
    const lead = g.units.filter((u) => u.owner === 0 && u.hero);
    expect(lead.length).toBe(1);
    expect(lead[0]).toMatchObject({ type: 'bowman', name: 'Hild' });
  });
});

describe('rivals who live alike are led differently', () => {
  it('no two peoples of one way of life have the same leader, and some are Strategists', () => {
    const seen = new Map<string, string>();
    for (const civ of CIV_IDS) {
      const h = rivalHero(civ), key = [CIV_STYLE[civ], h.calling, h.bent, h.might, h.guard, h.vigour, h.powers!.join('')].join();
      expect(seen.get(key), `${civ} and ${seen.get(key)}`).toBeUndefined();
      seen.set(key, civ);
      expect(h.powers!.every((k) => k === 0 || k === 1), civ).toBe(true); // a rival's are all chosen
      expect(POWERS[h.calling].length).toBe(3);
    }
    expect(CIV_IDS.filter((civ) => rivalHero(civ).calling === 'strategist').length).toBeGreaterThanOrEqual(2);
    // A Strategist's people have their leader when a Strategist is raised, not a Warlord.
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'babylon' }]);
    expect(g.spawnUnit('warlord', 1, 30.5, 30.5).hero).toBeUndefined();
    expect(g.spawnUnit('strategist', 1, 31.5, 30.5).hero).toBeDefined();
  });
});
