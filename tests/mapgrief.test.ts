// Grief in a town's season of work on the map (src/sim/mapgrief.ts): a home that lost its mother or its sons works more
// slowly for a time, as grief.ts has it in a town.
import { describe, expect, it } from 'vitest';
import { landIncome, newCampaign, wholeIncome } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { HANDS_FULL, harvest } from '../src/sim/harvest';
import { settleStores } from '../src/sim/stores';
import { STORE_KINDS, folkOf } from '../src/sim/township';
import { GRIEF_SEASONS, GRIEF_SLOW, griefWeight } from '../src/sim/grief';
import { griefWork, grievingHomes } from '../src/sim/mapgrief';
import { faithAt } from '../src/sim/townfaith';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  for (const id of home.adj) if (c.territories[id].owner < 0) c.territories[id].owner = 0;
  settleStores(c);
  const t = c.territories.find((x) => x.owner === 0 && x.id !== home.id)!, f = folkOf(c, t.id);
  f.men = HANDS_FULL; f.women = 10; delete f.ages; f.notables = []; f.houses = [];
  c.turn = 30;
  return { c, t, f };
};
const reap = (c: Campaign, tid: number): number => {
  const s = folkOf(c, tid).stores, was = STORE_KINDS.reduce((n, k) => n + s[k], 0);
  harvest(c, (f, t) => landIncome(c, f, t), (f) => wholeIncome(c, f));
  return STORE_KINDS.reduce((n, k) => n + s[k], 0) - was;
};

describe('grief on the map slows a town\'s season of work', () => {
  it('a town with no grieving home works as before', () => {
    const { c, t } = world();
    expect(grievingHomes(c, t.id)).toEqual([]);
    expect(griefWork(c, t.id)).toBe(1);
  });

  it('the homes that lost a man with the army or a known person are worked GRIEF_SLOW more slowly, by their share of the town\'s homes', () => {
    const { c, t, f } = world();
    const plain = reap(c, t.id);
    f.houses = [{ family: 'Harrow', away: [], fallen: [{ name: 'Ulf', as: 'son', turn: c.turn, how: 'fell with the army' }] }, { family: 'Reeve', away: [] }];
    f.notables = [{ name: 'Edith Moss', family: 'Moss', gender: 'f', kind: 'mother', kids: 5, deed: 'raised five', turn: 2, lost: { turn: c.turn - 1, how: 'died of plague' } }];
    f.grief = GRIEF_SEASONS;
    expect(grievingHomes(c, t.id).sort()).toEqual(['Harrow', 'Moss']);
    const w = 1 - GRIEF_SLOW * griefWeight(faithAt(c, t.id)) * (2 / 10);
    expect(griefWork(c, t.id)).toBeCloseTo(w, 6);
    expect(w).toBeLessThan(1);
    expect(reap(c, t.id)).toBeLessThan(plain);
  });

  it('for as long as the loss is felt: no longer once its seasons are past, or once the town has done grieving', () => {
    const { c, t, f } = world();
    f.houses = [{ family: 'Harrow', away: [], fallen: [{ name: 'Ulf', as: 'son', turn: c.turn - GRIEF_SEASONS, how: 'fell with the army' }] }];
    f.grief = 1;
    expect(griefWork(c, t.id)).toBe(1); // the loss is GRIEF_SEASONS old
    f.houses[0].fallen![0].turn = c.turn;
    expect(griefWork(c, t.id)).toBeLessThan(1);
    f.grief = 0; // an Infirmary or the leader there has eased the town's grief sooner (drift.ts)
    expect(griefWork(c, t.id)).toBe(1);
  });

  it('a town grieving in every home is slowed GRIEF_SLOW at most', () => {
    const { c, t, f } = world();
    f.women = 1;
    f.houses = ['A', 'B', 'C'].map((family) => ({ family, away: [], fallen: [{ name: 'X', as: 'son' as const, turn: c.turn, how: 'fell' }] }));
    f.grief = 2;
    expect(griefWork(c, t.id)).toBeGreaterThanOrEqual(1 - GRIEF_SLOW - 1e-9);
  });
});
