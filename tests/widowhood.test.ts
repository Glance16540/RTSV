// Widows, widowers and orphans on the map (src/sim/widowhood.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { WIDOW, bereftText, widowsTown } from '../src/sim/widowhood';
import { folkOf } from '../src/sim/township';
import { housesOf } from '../src/sim/warhouse';

const world = (): { c: Campaign; tid: number; other: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const other = c.territories[tid].adj.find((n) => !c.territories[n].horde)!;
  c.territories[other].owner = 0;
  for (const id of [tid, other]) { const f = folkOf(c, id); f.men = 4; f.women = 4; f.elders = 0; f.children = 4; delete f.ages; f.notables = []; f.houses = []; }
  return { c, tid, other };
};
/** A husband of the town falls with the army this season, as warhouse.ts records it. */
const falls = (c: Campaign, tid: number, family: string, name: string): void => {
  const f = folkOf(c, tid);
  housesOf(f).push({ family, away: [], fallen: [{ name, as: 'husband', turn: c.turn, how: 'fell with the army' }] });
  f.men--; delete f.ages;
};
/** Seasons pass for the town's widowed. */
const seasons = (c: Campaign, tid: number, n: number): void => { for (let i = 0; i < n; i++) { c.turn++; widowsTown(c, tid); } };

describe('who is widowed', () => {
  it('a husband fallen with the army leaves a widow: his known wife by name, or one named from the seed', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    widowsTown(c, tid); // the town is read from now on
    c.turn++;
    f.notables.push({ name: 'Edith', family: 'Thorne', gender: 'f', kind: 'mother', deed: 'raised four', turn: 0, kids: 4 });
    falls(c, tid, 'Thorne', 'Aldric');
    falls(c, tid, 'Pike', 'Bram');
    widowsTown(c, tid);
    expect(f.widowed!.map((w) => [w.name, w.family, w.female, w.of])).toEqual([['Edith', 'Thorne', true, 'Aldric'], [expect.any(String), 'Pike', true, 'Bram']]);
    expect(f.widowed![0].kids).toBeGreaterThan(0);
    expect(bereftText(c, tid)).toMatch(/Edith Thorne, widow of Aldric, in mourning/);
    // Read again, nobody is widowed twice.
    c.turn++; widowsTown(c, tid);
    expect(f.widowed).toHaveLength(2);
  });

  it('a notable mother who dies leaves her husband a widower', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    widowsTown(c, tid);
    c.turn++;
    f.notables.push({ name: 'Hild', family: 'Oakes', gender: 'f', kind: 'mother', deed: 'raised five', turn: 0, kids: 5, husband: 'Osric', lost: { turn: c.turn, how: 'died of the plague' } });
    widowsTown(c, tid);
    expect(f.widowed).toEqual([expect.objectContaining({ name: 'Osric', family: 'Oakes', female: false, of: 'Hild' })]);
  });
});

describe('what becomes of them', () => {
  it('after mourning, a widow marries again in the town when it has a man with nobody', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    widowsTown(c, tid);
    c.turn++; falls(c, tid, 'Thorne', 'Aldric'); widowsTown(c, tid);
    f.men = 6; delete f.ages; // more men than women: someone for her
    seasons(c, tid, WIDOW.mourn - 1);
    expect(f.widowed).toHaveLength(1); // still mourning
    seasons(c, tid, 40);
    expect(f.widowed).toBeUndefined();
    expect(c.log.some((l) => /has married again in/.test(l))).toBe(true);
  });

  it('with nobody for her at home, she goes to marry in a town of her people that has, and is on its record', () => {
    const { c, tid, other } = world(), f = folkOf(c, tid), g = folkOf(c, other);
    widowsTown(c, tid);
    c.turn++; falls(c, tid, 'Thorne', 'Aldric'); widowsTown(c, tid);
    g.men = 7; delete g.ages;
    const women = f.women, there = g.women;
    seasons(c, tid, 60);
    expect(f.widowed).toBeUndefined();
    expect(f.women).toBe(women - 1);
    expect(g.women).toBe(there + 1);
    expect(c.log.some((l) => /has gone from .* to marry in/.test(l))).toBe(true);
  });

  it('a widow who dies leaves her children to another named house of the town; they stay the town\'s', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    widowsTown(c, tid);
    c.turn++;
    housesOf(f).push({ family: 'Redfern', away: [{ name: 'Wulf', as: 'son', since: 0 }] });
    falls(c, tid, 'Thorne', 'Aldric'); widowsTown(c, tid);
    const kids = f.children;
    f.women = 0; f.elders = 0; delete f.ages; // and then she is gone, with every woman of the town
    c.turn++; widowsTown(c, tid);
    expect(f.widowed).toBeUndefined();
    expect(f.orphans).toEqual([expect.objectContaining({ family: 'Thorne', into: 'Redfern' })]);
    expect(f.orphans![0].count).toBeGreaterThan(0);
    expect(f.children).toBe(kids);
    expect(bereftText(c, tid)).toMatch(/(child|children) of the house of Thorne, kept by the house of Redfern/);
  });
});
