// Your people's name and your house's (src/sim/naming.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, battleConfig, finishBattle, moveArmy, newCampaign, raise } from '../src/sim/campaign';
import { CIVS } from '../src/sim/data';
import { HEIR_AGE, claimants, houseOf, strangerLeads, succeed } from '../src/sim/dynasty';
import { MAX_NAME, cleanName, foundHouse, houseName, houseToName, nameNation, ownLine, ownWords, peopleName, renameOwn } from '../src/sim/naming';

/** A named campaign whose leader has just fallen with their army. */
const bereft = (names = { people: 'Ashfolk', house: 'Varn' }): { c: Campaign; home: number } => {
  const c = newCampaign(3, 1, 1, 'japan', { names });
  c.factions[0].hero = { name: 'Brunhild', female: true, calling: 'strategist', bent: 'armour', might: 1, guard: 4, vigour: 1 };
  houseOf(c, 0);
  const home = c.territories.find((t) => t.capital === 0)!;
  expect(moveArmy(c, armyAt(c, home.id)!.id, home.adj[0])).toBe('battle');
  finishBattle(c, false);
  return { c, home: home.id };
};

describe('naming your people and your house', () => {
  it('a name is made safe: trimmed, plain, and no longer than MAX_NAME', () => {
    expect(cleanName('  Ash  folk ')).toBe('Ash folk');
    expect(cleanName('<b>Varn</b>')).toBe('bVarnb');
    expect(cleanName('O\'Dare-Smith Jr.')).toBe('O\'Dare-Smith Jr.');
    expect(cleanName('Ælfheim')).toBe('Ælfheim');
    expect(cleanName('x'.repeat(80))).toHaveLength(MAX_NAME);
    expect(cleanName('<>&"`')).toBe('');
    expect(cleanName(undefined)).toBe('');
    expect(cleanName(42)).toBe('');
  });

  it('the names you give are your people\'s and your house\'s from the first turn, and kept in a saved game', () => {
    const c = newCampaign(5, 2, 1, 'japan', { names: { people: 'Ashfolk', house: 'Varn' } });
    expect(c.factions[0].civ).toBe('japan'); // the people chosen still decides dress, units and leaders
    expect(peopleName(c, 0)).toBe('Ashfolk');
    expect(houseName(c, 0)).toBe('Varn');
    expect(c.log[0]).toContain('You lead the Ashfolk, under the House of Varn');
    expect(c.chronicle![0].text).toContain('The Ashfolk');
    const kept = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(peopleName(kept, 0)).toBe('Ashfolk');
    expect(houseName(kept, 0)).toBe('Varn');
    // Rivals keep their written names.
    for (const f of c.factions.slice(1)) { expect(f.people).toBeUndefined(); expect(peopleName(c, f.id)).toBe(CIVS[f.civ].name); }
  });

  it('left blank, the defaults are as they were', () => {
    const c = newCampaign(5, 1, 1, 'japan', { names: { people: '  ', house: '' } });
    expect(c.factions[0].people).toBeUndefined();
    expect(c.factions[0].dynasty).toBeUndefined();
    expect(peopleName(c, 0)).toBe(CIVS.japan.name);
    expect(houseName(c, 0)).toBeUndefined();
    expect(c.log[0]).toContain(`You lead the ${CIVS.japan.name}.`);
    nameNation(c, 0, { people: 'Ashfolk' });
    expect(peopleName(c, 0)).toBe('Ashfolk');
    expect(newCampaign(5, 1, 1, 'japan').log[0]).toContain(`You lead the ${CIVS.japan.name}.`); // and with none given at all
  });

  it('an heir of the house takes up the rule as one of it, and the house keeps its name', () => {
    const { c } = bereft();
    c.turn += HEIR_AGE;
    const [claim] = claimants(c, 0);
    expect(claim.what).toContain('the House of Varn');
    expect(succeed(c, 0, claim)).toBe(true);
    expect(c.chronicle!.at(-1)!.text).toContain('of the House of Varn takes up the rule of your people');
    expect(houseName(c, 0)).toBe('Varn');
  });

  it('a house set aside or ended takes its name with it', () => {
    const { c, home } = bereft();
    c.turn += HEIR_AGE;
    c.factions[0].supplies = 20;
    raise(c, 0, home, 'infantry');
    armyAt(c, home)!.vet = 2;
    const captain = claimants(c, 0).find((x) => x.kind === 'captain')!;
    expect(succeed(c, 0, captain)).toBe(true);
    expect(c.chronicle!.at(-1)!.text).toContain('The House of Varn is set aside');
    expect(houseName(c, 0)).toBeUndefined();

    const b = bereft();
    strangerLeads(b.c, 0);
    expect(b.c.chronicle!.at(-1)!.text).toContain('The House of Varn is ended');
    expect(houseName(b.c, 0)).toBeUndefined();
  });

  it('a new house founded by a captain or a stranger can be named by the player, with a name offered', () => {
    const { c, home } = bereft();
    c.turn += HEIR_AGE;
    c.factions[0].supplies = 20;
    raise(c, 0, home, 'infantry');
    armyAt(c, home)!.vet = 2;
    const captain = claimants(c, 0).find((x) => x.kind === 'captain')!;
    expect(succeed(c, 0, captain)).toBe(true);
    const offered = houseToName(c, 0)!;
    expect(offered).toBe(captain.name.replace(/^Captain /, '').split(' ')[0]); // the captain's name, without the rank
    expect(foundHouse(c, 0, 'Iron Hand')).toBe('Iron Hand');
    expect(houseName(c, 0)).toBe('Iron Hand');
    expect(houseToName(c, 0)).toBeUndefined();
    expect(c.chronicle!.at(-1)!.text).toBe('A new house rules the Ashfolk: the House of Iron Hand.');
    expect(foundHouse(c, 0, 'Again')).toBe(''); // only once, while it waits

    const b = bereft();
    strangerLeads(b.c, 0);
    expect(houseToName(b.c, 0)).toBe(b.c.factions[0].hero!.name!.replace(/ the Hired$/, ''));
    expect(foundHouse(b.c, 0, '   ')).toBe(''); // left unnamed
    expect(houseName(b.c, 0)).toBeUndefined();
    expect(houseToName(b.c, 0)).toBeUndefined();

    // A rival's new house is not offered a name.
    const r = newCampaign(3, 1, 1, 'japan');
    r.factions[1].heroAlive = false;
    strangerLeads(r, 1);
    expect(houseToName(r, 1)).toBeUndefined();
  });

  it('in a battle the player\'s side bears their people\'s name', () => {
    const c = newCampaign(5, 1, 1, 'japan', { names: { people: 'Ashfolk' } });
    const home = c.territories.find((t) => t.capital === 0)!;
    expect(moveArmy(c, armyAt(c, home.id)!.id, home.adj[0])).toBe('battle');
    expect(battleConfig(c)!.setups[0].name).toBe('Ashfolk');
    const plain = newCampaign(5, 1, 1, 'japan');
    const h = plain.territories.find((t) => t.capital === 0)!;
    moveArmy(plain, armyAt(plain, h.id)!.id, h.adj[0]);
    expect(battleConfig(plain)!.setups[0].name).toBe(CIVS.japan.name);
  });

  it('the player\'s own leader\'s lines are shown with the name given to their people', () => {
    expect(ownWords('kush')).toEqual(expect.arrayContaining(['Kush', CIVS.kush.name]));
    const c = newCampaign(5, 1, 1, 'kush', { names: { people: 'Ashfolk' } });
    expect(ownLine(c, 'A new age. Let Kush be first in it.')).toBe('A new age. Let Ashfolk be first in it.');
    expect(ownLine(c, 'Kushite steel.')).toBe('Kushite steel.'); // only the whole word
    expect(renameOwn('Let Kush be first.', 'kush', undefined)).toBe('Let Kush be first.');
    const plain = newCampaign(5, 1, 1, 'kush');
    expect(ownLine(plain, 'Let Kush be first in it.')).toBe('Let Kush be first in it.');
  });
});
