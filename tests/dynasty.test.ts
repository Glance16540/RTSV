import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, finishBattle, heroFor, moveArmy, newCampaign, raise, summonHero } from '../src/sim/campaign';
import { HEIR_AGE, HEIR_EVERY, MAX_HEIRS, autoSucceed, canSucceed, claimants, comesOfAge, houseOf, ofAge, succeed, tickHouses } from '../src/sim/dynasty';
import { Game } from '../src/sim/game';
import { heirName } from '../src/sim/hero';
import { leaderAt } from '../src/sim/court';
import { run } from './helpers';

/** A campaign whose leader has just died with their army. */
const bereft = (): { c: Campaign; home: number } => {
  const c = newCampaign(3);
  c.factions[0].hero = { name: 'Brunhild', female: true, calling: 'strategist', bent: 'armour', might: 1, guard: 4, vigour: 1 };
  c.factions[0].heroRank = 4;
  houseOf(c, 0);
  const home = c.territories.find((t) => t.capital === 0)!;
  expect(moveArmy(c, armyAt(c, home.id)!.id, home.adj[0])).toBe('battle');
  finishBattle(c, false);
  expect(c.factions[0].heroAlive).toBe(false);
  return { c, home: home.id };
};

describe('the ruling house', () => {
  it('a leader begins with one child half grown, and more are born while they live', () => {
    const c = newCampaign(3);
    const chance = c.rngState;
    const house = houseOf(c, 0);
    expect(house.heirs.length).toBe(1);
    expect(ofAge(c, house.heirs[0])).toBe(false);
    expect(comesOfAge(c, house.heirs[0])).toBe(HEIR_AGE - Math.floor(HEIR_AGE / 2));
    expect(claimants(c, 0)).toEqual([]); // the leader lives
    for (let i = 0; i < HEIR_EVERY * (MAX_HEIRS + 2); i++) { c.turn++; tickHouses(c); }
    expect(house.heirs.length).toBe(MAX_HEIRS);
    expect(new Set(house.heirs.map((h) => h.name)).size).toBe(MAX_HEIRS);
    expect(c.log.some((l) => /is born to/.test(l))).toBe(true);
    expect(c.rngState).toBe(chance); // none of it draws on the campaign's run of chance
    // Every rival has a house too.
    expect(c.factions.every((f) => f.house && f.house.heirs.length > 0)).toBe(true);
  });

  it('when the leader falls an heir of age may follow them, with their gifts and half their name', () => {
    const { c, home } = bereft();
    expect(heroFor(c, 0).rank).toBe(3); // one who falls is a rank the less
    expect(claimants(c, 0)).toEqual([]); // the child is too young, and no army has made a name
    c.turn += HEIR_AGE;
    const [claim] = claimants(c, 0);
    const heir = houseOf(c, 0).heirs[0];
    expect(claim).toMatchObject({ kind: 'heir', rank: 1, female: heir.female });
    expect(claim.name).toBe(`${heir.name}, ${heir.female ? 'daughter' : 'son'} of Brunhild`);
    expect(canSucceed(c, 0, claim)).toBe(true); // no army is needed: the heir takes up the rule in the capital
    expect(succeed(c, 0, claim)).toBe(true);
    expect(c.factions[0].heroAlive).toBe(true);
    expect(c.factions[0].court!.at).toBe(home);
    c.factions[0].supplies = 20;
    expect(raise(c, 0, home, 'infantry')).toBe(true);
    expect(leaderAt(c, 0, home)).toBe(true);
    expect(armyAt(c, home)!.hero).toBe(true); // an army raised where the leader is has them at its head
    expect(heroFor(c, 0).name).toBe(claim.name);
    expect(heroFor(c, 0)).toMatchObject({ name: claim.name, female: heir.female, calling: 'strategist', bent: 'armour', guard: 4, rank: 1 });
    expect(houseOf(c, 0)).toMatchObject({ heirs: [], line: 2 });
    expect(c.chronicle!.at(-1)!.text).toContain('takes up the rule');
    expect(succeed(c, 0, claim)).toBe(false); // there is a leader again
  });

  it('a captain of a seasoned army can be raised instead, where they stand, and the old house ends', () => {
    const { c, home } = bereft();
    c.turn += HEIR_AGE;
    c.factions[0].supplies = 20;
    raise(c, 0, home, 'infantry');
    const army = armyAt(c, home)!;
    expect(claimants(c, 0).map((x) => x.kind)).toEqual(['heir']);
    army.vet = 2;
    const claims = claimants(c, 0);
    expect(claims.map((x) => x.kind)).toEqual(['heir', 'captain']);
    const captain = claims[1];
    expect(captain).toMatchObject({ i: army.id, rank: 2 });
    expect(captain.name.startsWith('Captain ')).toBe(true);
    expect(succeed(c, 0, captain)).toBe(true);
    expect(army.hero).toBe(true);
    expect(heroFor(c, 0)).toMatchObject({ name: captain.name, calling: 'warlord', rank: 2 });
    expect(houseOf(c, 0)).toMatchObject({ heirs: [], line: 2 });
    expect(c.chronicle!.at(-1)!.text).toContain("Brunhild's house is set aside");
  });

  it('a rival settles its own succession, and a hired stranger is nobody\'s heir', () => {
    const c = newCampaign(3);
    const rival = c.factions[1], seat = c.territories.find((t) => t.capital === 1)!;
    houseOf(c, 1);
    const army = armyAt(c, seat.id)!;
    army.hero = false; rival.heroAlive = false;
    expect(autoSucceed(c, 1)).toBe(false); // nobody of age yet
    c.turn += HEIR_AGE;
    const heir = rival.house!.heirs[0].name;
    expect(autoSucceed(c, 1)).toBe(true);
    expect(army.hero).toBe(true);
    expect(heroFor(c, 1).name.startsWith(heir + ', ')).toBe(true);
    // Hiring one at the capital, as before, now brings a new name and ends the house.
    army.hero = false; rival.heroAlive = false; rival.supplies = 20;
    rival.house!.heirs = [];
    expect(summonHero(c, 1, seat.id)).toBe(true);
    expect(heroFor(c, 1)).toMatchObject({ rank: 0 });
    expect(heroFor(c, 1).name.endsWith(' the Hired')).toBe(true);
    expect(rival.house!.line).toBe(3);
  });

  it('in a battle the one raised after the leader falls is their heir by name', () => {
    expect(heirName('Edric')).toBe('Edric II');
    expect(heirName('Edric II')).toBe('Edric III');
    expect(heirName('Lady Aldegund of the Marches III')).toBe('Lady Aldegund of the Marches IV');
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: { name: 'Edric', rank: 2 } }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    expect(w.name).toBe('Edric');
    const foe = g.spawnUnit('knight', 1, 47.3, 46.5);
    w.hp = 1; w.stance = 'hold';
    g.cmdTarget(1, [foe.id], w.id);
    run(g, 6);
    expect(w.dead).toBe(true);
    const next = g.spawnUnit('warlord', 0, 40.5, 40.5);
    expect(next.name).toBe('Edric II');
    expect(next.hero).toMatchObject({ rank: 1 });
  });
});
