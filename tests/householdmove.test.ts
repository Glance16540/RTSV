// A household leaves a town together (src/sim/householdmove.ts, with migration.ts and convoys.ts sendFamily), and a land
// a war or a band has emptied becomes an empty land after a while (src/sim/emptied.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { OLD_SEASON } from '../src/sim/ageing';
import { convoysTurn, sendFamily } from '../src/sim/convoys';
import { DEAD } from '../src/sim/deadtown';
import { EMPTIED, letGoSeason } from '../src/sim/emptied';
import { emptyLand } from '../src/sim/founding';
import { HOUSEHOLD, houseArrives, householdOf } from '../src/sim/householdmove';
import { MIGRATE } from '../src/sim/migration';
import { folkOf } from '../src/sim/township';
import type { Notable } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** The player's chief town and a town of theirs beside it, the first with people to spare and some of them old. */
function two() {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = []; c.convoys = [];
  const from = c.territories.find((t) => t.capital === 0)!;
  const to = c.territories.find((t) => from.adj.includes(t.id) && t.capital < 0)!;
  to.owner = 0;
  Object.assign(folkOf(c, from.id), { men: 12, women: 12, elders: 4, children: 8 }); delete folkOf(c, from.id).ages;
  Object.assign(folkOf(c, to.id), { men: 4, women: 4, elders: 0, children: 0 }); delete folkOf(c, to.id).ages;
  return { c, from, to };
}
const wynn = (): Notable => ({ name: 'Wynn', family: 'Ashby', gender: 'f', kind: 'mother', deed: 'raised four children', turn: 1, kids: 4, husband: 'Edric' });

describe('a household leaves together', () => {
  it('a couple, their children and one of the old', () => {
    const { c, from } = two();
    const who = householdOf(c, from.id, { keep: MIGRATE.keep })!;
    expect(who).toMatchObject({ men: 1, women: 1, old: HOUSEHOLD.old });
    expect(who.children).toBeGreaterThan(0);
    expect(who.children).toBeLessThanOrEqual(HOUSEHOLD.children);
  });

  it('the old go on the road with them and are old where they come in; the town they leave has one old fewer', () => {
    const { c, from, to } = two();
    const old0 = folkOf(c, from.id).elders;
    const x = sendFamily(c, 0, from.id, to.id, { men: 1, women: 1, children: 2, old: 1 })!;
    expect([...x.cargo.men, ...x.cargo.women].filter((s) => s >= OLD_SEASON)).toHaveLength(1);
    expect(folkOf(c, from.id).elders).toBe(old0 - 1);
    c.turn++;
    convoysTurn(c);
    expect(folkOf(c, to.id).elders).toBe(1);
    expect(folkOf(c, to.id).children).toBe(2);
  });

  it('a town keeps its grown people and a couple: no old one goes where it would leave the town short', () => {
    const { c, from } = two();
    Object.assign(folkOf(c, from.id), { men: MIGRATE.keep / 2 + 1, women: MIGRATE.keep / 2, elders: 1 }); delete folkOf(c, from.id).ages; // a couple can go, and leave it its grown; with their old one too, it would be short
    expect(householdOf(c, from.id, { keep: MIGRATE.keep })!.old).toBe(0);
    Object.assign(folkOf(c, from.id), { men: 2, women: 2, elders: 0 }); delete folkOf(c, from.id).ages;
    expect(householdOf(c, from.id, { keep: MIGRATE.keep })).toBeNull();
  });
});

describe('a known house moves whole, and its man at war is still of it', () => {
  const housed = () => {
    const x = two(), { c, from } = x;
    folkOf(c, from.id).notables.push(wynn());
    (folkOf(c, from.id) as unknown as { houses: unknown[] }).houses = [{ family: 'Ashby', away: [{ name: 'Edric', as: 'husband', since: 1, army: 7 }], fallen: [{ name: 'Osric', as: 'son', turn: 3, how: 'fell at the ford' }] }];
    c.musters = { 7: { size: 1, men: { [from.id]: [120] }, owner: 0 } };
    return x;
  };

  it('with her man away, she goes with the children and the old, as her house', () => {
    const { c, from } = housed();
    const who = householdOf(c, from.id, { known: wynn(), keep: MIGRATE.keep })!;
    expect(who.men).toBe(0); // he is with the army, and stays of his house
    expect(who.family).toBe('Ashby');
  });

  it('as it comes in, its record and his place on the army\'s roll go with it; nothing moves while it is on the road', () => {
    const { c, from, to } = housed();
    const her = folkOf(c, from.id).notables.find((n) => n.name === 'Wynn')!;
    sendFamily(c, 0, from.id, to.id, { men: 0, women: 1, children: 3, old: 1, notable: her, family: 'Ashby' });
    const housesOf = (tid: number) => (folkOf(c, tid) as unknown as { houses?: { family: string; fallen?: unknown[] }[] }).houses ?? [];
    expect(housesOf(from.id).map((h) => h.family)).toContain('Ashby'); // on the road: still the old town's
    expect(c.musters![7].men[from.id]).toEqual([120]);
    c.turn++;
    convoysTurn(c);
    expect(housesOf(from.id).map((h) => h.family)).not.toContain('Ashby');
    const house = housesOf(to.id).find((h) => h.family === 'Ashby')!;
    expect(house.fallen).toHaveLength(1); // its fallen are remembered where it lives now
    expect(c.musters![7].men[to.id]).toEqual([120]); // he comes home to where his house is
    expect(c.musters![7].men[from.id]).toBeUndefined();
    expect(folkOf(c, to.id).notables.some((n) => n.name === 'Wynn' && n.husband === 'Edric')).toBe(true);
  });

  it('a house of the same name where it comes in becomes one house with it', () => {
    const { c, from, to } = housed();
    (folkOf(c, to.id) as unknown as { houses: unknown[] }).houses = [{ family: 'Ashby', away: [], war: 2 }];
    expect(houseArrives(c, from.id, to.id, 'Ashby')).toBe(1);
    const houses = (folkOf(c, to.id) as unknown as { houses: { family: string; away: unknown[]; fallen?: unknown[] }[] }).houses;
    expect(houses.filter((h) => h.family === 'Ashby')).toHaveLength(1);
    expect(houses[0].away).toHaveLength(1);
    expect(houses[0].fallen).toHaveLength(1);
  });
});

describe('a land emptied becomes an empty land', () => {
  const dead = () => {
    const { c, to } = two();
    Object.assign(folkOf(c, to.id), { men: 0, women: 0, elders: 0, children: 0 }); delete folkOf(c, to.id).ages;
    c.emptied = { [to.id]: DEAD.open + EMPTIED.wait }; c.emptiedOf = { [to.id]: 0 };
    return { c, to };
  };

  it('an open town nobody has come for is let go after the wait, and settlers may found on it', () => {
    const { c, to } = dead();
    expect(letGoSeason(c)).toEqual([to.id]);
    expect(to.owner).toBe(-1);
    expect(emptyLand(c, to.id)).toBe(true);
    expect(c.log.some((l) => l.includes(to.name) && l.includes('empty land'))).toBe(true);
  });

  it('not before the wait, and not while an army of its people holds it', () => {
    const a = dead();
    a.c.emptied![a.to.id] = DEAD.open + EMPTIED.wait - 1;
    expect(letGoSeason(a.c)).toEqual([]);
    const b = dead();
    b.c.armies.push({ id: 99, owner: 0, at: b.to.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(letGoSeason(b.c)).toEqual([]);
    expect(b.to.owner).toBe(0);
  });
});
