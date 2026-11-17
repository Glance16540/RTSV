// A veteran is of his own house (src/sim/veteranhome.ts): his town and house off the army's roll, and his loss weighs.
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { agesOf } from '../src/sim/ageing';
import { townGrief } from '../src/sim/notableweight';
import { folkOf, rememberVeteran } from '../src/sim/township';
import { enlist, fell, housesOf } from '../src/sim/warhouse';
import { veteranHome, veteransFell } from '../src/sim/veteranhome';

/** Two towns of the player's, each with men away with army 9. */
const twoTowns = () => {
  const c = bareCampaign(7, 1, 1, 'hearth');
  const [a, b] = c.territories.filter((t) => t.owner === 0).length >= 2 ? c.territories.filter((t) => t.owner === 0) : (() => {
    const cap = c.territories.find((t) => t.capital === 0)!, other = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    other.owner = 0; return [cap, other];
  })();
  for (const t of [a, b]) { const f = folkOf(c, t.id); f.men = 10; f.women = 6; f.notables = []; delete f.ages; delete f.houses; agesOf(c, t.id, f); }
  enlist(c, a.id, 3, 9); enlist(c, b.id, 2, 9);
  return { c, a, b };
};

describe('a veteran of his own house', () => {
  it('is the man of the roll who bears his name: of his town and his house, not the army\'s town', () => {
    const { c, b } = twoTowns();
    const man = housesOf(folkOf(c, b.id))[0];
    const name = man.away[0].name;
    expect(veteranHome(c, 0, 9, name)).toEqual({ town: b.id, family: man.family });
  });

  it('else one of the army\'s men drawn by lot, who is known by his name from then on', () => {
    const { c } = twoTowns();
    const home = veteranHome(c, 0, 9, 'Ulfgar the Bold')!;
    expect(home).toBeDefined();
    const h = housesOf(folkOf(c, home.town)).find((x) => x.family === home.family)!;
    expect(h.away.some((s) => s.name === 'Ulfgar the Bold')).toBe(true);
    expect(veteranHome(c, 0, 9, 'Ulfgar the Bold')).toEqual(home); // the same man, asked again
    expect(veteranHome(c, 0, 4, 'Ulfgar the Bold')).toBeUndefined(); // an army with nobody on its roll
  });

  it('is remembered with his house, and if he falls with the army on the map, the town loses him and grieves by his weight', () => {
    const { c, a } = twoTowns();
    const f = folkOf(c, a.id), h = housesOf(f)[0], name = h.away[0].name;
    rememberVeteran(c, a.id, { name, kills: 9, unit: 'Swordsman', family: h.family });
    expect(f.notables[0].family).toBe(h.family);
    expect(townGrief(f.notables, c.turn)).toBe(0);
    const lost = veteransFell(c, a.id, [{ name, family: h.family }]);
    expect(lost.map((n) => n.name)).toEqual([name]);
    expect(f.notables[0].lost?.turn).toBe(c.turn);
    expect(townGrief(f.notables, c.turn)).toBeGreaterThan(0.25); // fame 3: a far heavier loss than a plain soldier's
    expect(veteransFell(c, a.id, [{ name: 'Nobody', family: h.family }])).toEqual([]);
  });

  it('falling by lot on the map (warhouse.ts fell) marks the veteran lost, once', () => {
    const { c, a } = twoTowns();
    const f = folkOf(c, a.id);
    const names = housesOf(f).flatMap((h) => h.away.map((s) => ({ name: s.name, family: h.family })));
    for (const m of names) rememberVeteran(c, a.id, { name: m.name, kills: 6, family: m.family });
    const out = fell(c, a.id, 1, 'fell with the army', 9);
    const vet = f.notables.filter((n) => n.name === out[0].name);
    expect(vet.length).toBe(1);
    expect(vet[0].lost).toBeDefined();
    expect(vet[0].kills).toBe(6);
  });
});

describe('the famous mourned longer, and a rival\'s veterans of their own towns', () => {
  it('a famous loss is felt GRIEF_LONGER seasons more for each degree of fame', async () => {
    const { GRIEF_SEASONS, GRIEF_LONGER, griefSeasonsOf, townGrief, mourned } = await import('../src/sim/notableweight');
    const plain = { name: 'A', gender: 'm' as const, kind: 'veteran' as const, deed: '', turn: 0, kills: 3, lost: { turn: 10, how: 'fell' } };
    const famed = { ...plain, name: 'B', kills: 9 };
    expect(griefSeasonsOf(plain)).toBe(GRIEF_SEASONS);
    expect(griefSeasonsOf(famed)).toBe(GRIEF_SEASONS + 2 * GRIEF_LONGER);
    const at = 10 + GRIEF_SEASONS + 1;
    expect(townGrief([plain], at)).toBe(0);
    expect(townGrief([famed], at)).toBeGreaterThan(0);
    expect(mourned([plain, famed], at).map((n) => n.name)).toEqual(['B']);
  });

  it('a map battle won with enough felled names a man of the winning army\'s roll who stood, of his own town and house', async () => {
    const { NAMED, battleNamed } = await import('../src/sim/veteranhome');
    const { c, a, b } = twoTowns();
    c.armies.push({ id: 9, owner: 0, at: a.id, units: { infantry: 3 }, vet: 0 } as never);
    expect(battleNamed(c, 9, NAMED.least - 1)).toBeUndefined();
    const named = battleNamed(c, 9, 20)!;
    expect([a.id, b.id]).toContain(named.town);
    const army = c.armies.find((x) => x.id === 9)!;
    expect(army.champion?.kills).toBe(Math.round(20 * NAMED.share));
    const n = folkOf(c, named.town).notables.find((x) => x.kind === 'veteran')!;
    expect(n.name).toBe(army.champion!.name);
    expect(housesOf(folkOf(c, named.town)).some((h) => h.family === n.family && h.away.some((s) => `${s.name} ${h.family}` === n.name))).toBe(true);
    expect(battleNamed(c, 9, 20)).toBeUndefined(); // one known by name already
    // Found again by his full name, and lost as the veteran he was if he falls.
    const house = housesOf(folkOf(c, named.town)).find((h) => h.family === n.family)!;
    const man = house.away.find((s) => `${s.name} ${house.family}` === n.name)!;
    expect(veteransFell(c, named.town, [{ name: man.name, family: house.family }]).length).toBe(1);
  });
});
