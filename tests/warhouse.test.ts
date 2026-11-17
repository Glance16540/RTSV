// A man at war is still of his house, on the map (docs/DESIGN.md; src/sim/warhouse.ts).
import { bareCampaign, everyManSent } from './helpers';
import { describe, expect, it } from 'vitest';
import { armyAt, raise } from '../src/sim/campaign';
import { MEN_A_COMPANY, awayFrom, musterOf, reckonArmies, seasonOfArmies, sendHome } from '../src/sim/armytown';
import { agesOf } from '../src/sim/ageing';
import { GRIEF_SEASONS } from '../src/sim/grief';
import { townGrief } from '../src/sim/notableweight';
import { rollOf } from '../src/sim/roll';
import { Notable, folkOf } from '../src/sim/township';
import { WARHOUSE, awayMen, awayText, cameHome, enlist, fallenSince, fell, housesOf, recordedAway, settleHouses } from '../src/sim/warhouse';

everyManSent(); // these tests are about other rules: a company takes its two men while the town can spare them

/** A town of the player's with a Barracks and supplies, no army in it, and the men and women asked for. */
const town = (men = 10, women = 6, seed = 7) => {
  const c = bareCampaign(seed, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  if (!home.buildings.includes('barracks')) home.buildings.push('barracks');
  const f = folkOf(c, home.id);
  f.men = men; f.women = women; f.notables = []; delete f.ages; delete f.houses;
  agesOf(c, home.id, f);
  return { c, home, f };
};
const mother = (name: string, family: string, husband?: string): Notable => ({ name, family, gender: 'f', kind: 'mother', deed: 'raised three children', turn: 0, kids: 3, ...(husband ? { husband } : {}) });

describe('a man at war is still of his house, on the map', () => {
  it('a company raised takes its men from named houses of the town, and they are on those houses\' records as away', () => {
    const { c, home, f } = town();
    expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    const men = awayMen(c, home.id);
    expect(men.length).toBe(MEN_A_COMPANY);
    expect(recordedAway(f)).toBe(awayFrom(c, home.id));
    for (const m of men) { expect(m.name.length).toBeGreaterThan(0); expect(m.family.length).toBeGreaterThan(0); expect(m.since).toBe(c.turn); }
    expect(new Set(men.map((m) => `${m.name} ${m.family}`)).size).toBe(men.length); // no two the same
    expect(awayText(c, home.id)).toContain(men[0].family);
  });

  it('an unmarried man goes before a husband', () => {
    // Ten men and six women: four men have no wife. The first two companies are all sons; husbands go only after.
    const { c, home } = town(10, 6);
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, home.id, 'infantry');
    expect(awayMen(c, home.id).map((m) => m.as)).toEqual(['son', 'son', 'son', 'son']);
    raise(c, 0, home.id, 'infantry');
    expect(awayMen(c, home.id).filter((m) => m.as === 'husband').length).toBe(2);
    // A town with as many women as men has no unmarried man to send.
    const even = town(8, 8);
    even.f.men -= 1; // armytown has taken him already
    expect(enlist(even.c, even.home.id, 1).map((m) => m.as)).toEqual(['husband']);
  });

  it('a house gives two sons at the most before another house is asked', () => {
    const { c, home, f } = town(30, 2);
    f.men -= 8; // armytown has taken them already
    enlist(c, home.id, 8);
    for (const h of housesOf(f)) expect(h.away.filter((s) => s.as === 'son').length).toBeLessThanOrEqual(WARHOUSE.sons);
    expect(recordedAway(f)).toBe(8);
  });

  it('the man of a house the nation knows goes by his own name', () => {
    const { c, home, f } = town(4, 4);
    f.notables.push(mother('Ada', 'Harrow', 'Bram'));
    f.men -= 1;
    expect(enlist(c, home.id, 1)).toEqual([{ name: 'Bram', family: 'Harrow', as: 'husband' }]);
    // He is away already: the next husband is of another house.
    f.men -= 1;
    expect(enlist(c, home.id, 1)[0].family).not.toBe('Harrow');
  });

  it('they come home to their houses when the army is sent home', () => {
    const { c, home, f } = town();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    a.moved = false;
    expect(sendHome(c, a.id)).toBe(2 * MEN_A_COMPANY);
    expect(awayMen(c, home.id)).toEqual([]);
    expect(recordedAway(f)).toBe(0);
    expect(f.men).toBe(10);
    settleHouses(c);
    expect(f.houses).toBeUndefined(); // nobody away and nobody fallen: nothing is kept
  });

  it('a death in a battle on the map is his house\'s loss, and the town grieves', () => {
    const { c, home, f } = town();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!, before = awayMen(c, home.id).map((m) => `${m.name} ${m.family}`);
    a.units.infantry = 1; // the army lost a company
    const fallen = reckonArmies(c);
    const dead = fallen.reduce((n, x) => n + x.dead, 0), home2 = fallen.reduce((n, x) => n + (x.home ?? 0), 0);
    expect(dead).toBeGreaterThan(0);
    expect(dead + home2).toBe(MEN_A_COMPANY);
    const names = fallen.flatMap((x) => x.names ?? []);
    expect(names.length).toBe(dead);
    for (const n of names) expect(before).toContain(n);
    // Their houses keep their names among the fallen, and have them away no longer.
    const lost = housesOf(f).flatMap((h) => (h.fallen ?? []).map((x) => `${x.name} ${h.family}`));
    expect(lost.sort()).toEqual([...names].sort());
    expect(recordedAway(f)).toBe(awayFrom(c, home.id));
    expect(recordedAway(f)).toBe(MEN_A_COMPANY);
    expect(f.grief).toBe(Math.min(GRIEF_SEASONS, dead + WARHOUSE.mourn));
    expect(c.log.some((l) => l.includes(names[0]))).toBe(true);
    expect(fallenSince(c, 0, c.turn).map((x) => `${x.name} ${x.family}`).sort()).toEqual([...names].sort());
  });

  it('a man of a house the nation knows is listed with its lost: his loss weighs, and the roll can name him', () => {
    const { c, home, f } = town(4, 4);
    f.notables.push(mother('Ada', 'Harrow', 'Bram'));
    f.men -= 1;
    enlist(c, home.id, 1);
    expect(townGrief(f.notables, c.turn)).toBe(0);
    const out = fell(c, home.id, 1);
    expect(out).toEqual([{ name: 'Bram', family: 'Harrow', as: 'husband', known: true }]);
    const him = f.notables.find((n) => n.name === 'Bram')!;
    expect(him.lost).toEqual({ turn: c.turn, how: 'fell with the army' });
    expect(him.family).toBe('Harrow');
    expect(f.notables.find((n) => n.name === 'Ada')!.husband).toBeUndefined(); // she is a widow
    expect(townGrief(f.notables, c.turn)).toBeGreaterThan(0);
    expect(rollOf(c, 0).lost.map((x) => x.name)).toContain('Bram');
    // A man of a house nobody knows is his house's loss and the town's grief, and not one of the nation's known.
    const plain = town(6, 2);
    plain.f.men -= 1;
    enlist(plain.c, plain.home.id, 1);
    expect(fell(plain.c, plain.home.id, 1)[0].known).toBe(false);
    expect(plain.f.notables).toEqual([]);
    expect(plain.f.grief).toBe(1 + WARHOUSE.mourn);
  });

  it('a campaign saved before houses were kept still loads: its men away are given houses when the season turns', () => {
    const { c, home, f } = town();
    raise(c, 0, home.id, 'infantry');
    delete f.houses; // as an older save would have it
    const again = JSON.parse(JSON.stringify(c)) as typeof c;
    const g = again.territories[home.id].folk!;
    expect(recordedAway(g)).toBe(0);
    seasonOfArmies(again);
    expect(recordedAway(g)).toBe(MEN_A_COMPANY);
    expect(awayFrom(again, home.id)).toBe(MEN_A_COMPANY);
    // And nonsense on the record is made safe.
    (g as { houses?: unknown }).houses = [{ family: 7, away: 'x' }, { family: 'Barrow', away: [{ name: 'Holt', as: 'uncle', since: 'never' }, null] }];
    expect(housesOf(g)).toEqual([{ family: 'Nameless', away: [] }, { family: 'Barrow', away: [{ name: 'Holt', as: 'son', since: 0 }] }]);
  });

  it('the houses\' records follow the rolls, whatever road the men took', () => {
    const { c, home, f } = town();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    musterOf(c, a.id)!.men[home.id].pop(); // one man is off the roll, and nobody said how
    expect(settleHouses(c)).toEqual({ enlisted: 0, released: 1 });
    expect(recordedAway(f)).toBe(awayFrom(c, home.id));
    expect(cameHome(c, home.id, 99).length).toBe(3);
    expect(recordedAway(f)).toBe(0);
  });
});
