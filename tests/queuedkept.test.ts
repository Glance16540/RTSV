// The men in a town's training queues: one queued for what is no company on the map is kept, and the men of a kind go out
// together, a company's worth at a time (src/sim/queueddrill.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { MEN, menOf, musterOf } from '../src/sim/armytown';
import { agesOf } from '../src/sim/ageing';
import { cleanQueued, drillQueued, keepQueued, queuedAt } from '../src/sim/queueddrill';
import { companyOf } from '../src/sim/townmuster';
import { folkOf } from '../src/sim/township';

/** The player's chief town with a Barracks, twenty men of known ages, no army, nothing in its orders. */
const town = () => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0); c.musters = {};
  home.buildings = ['barracks'];
  const f = folkOf(c, home.id);
  Object.assign(f, { men: 20, women: 20, elders: 0, children: 0 }); delete f.ages; delete f.houses;
  const ages = agesOf(c, home.id, f);
  delete home.orders;
  return { c, home, f, ages };
};

describe('a man queued for what is no company on the map', () => {
  it('is kept, not dropped: a unit of the game is believed, a made-up one is not', () => {
    expect(companyOf('priest')).toBeUndefined();
    expect(cleanQueued([{ as: 'priest', name: 'Odo', seasons: 80 }])).toHaveLength(1);
    expect(cleanQueued([{ as: 'dragon', name: 'Odo', seasons: 80 }])).toEqual([]);
  });

  it('with no place for him on the town\'s record, he is a townsman again, still of the town, and the log says so', () => {
    const { c, home, f, ages } = town();
    keepQueued(c, home.id, [{ as: 'priest', name: 'Odo', family: 'Barrow', seasons: ages.m[3] }]);
    const men = f.men;
    expect(drillQueued(c, home.id)).toEqual([]);
    expect(queuedAt(c, home.id)).toEqual([]); // off the queue
    expect(folkOf(c, home.id).men).toBe(men); // and still a man of the town
    expect(c.log.at(-1)).toContain('Odo Barrow');
    expect(c.log.at(-1)).toContain('a townsman again');
  });
});

describe('the men of a kind go out together', () => {
  it('MEN.company of them make a company; fewer wait for more', () => {
    const { c, home, ages } = town();
    const was = MEN.company;
    try {
      MEN.company = 2; // towns of the old size: two men to a company
      keepQueued(c, home.id, [
        { as: 'clubman', name: 'Ivo', seasons: ages.m[0] },
        { as: 'clubman', name: 'Holt', seasons: ages.m[5] },
        { as: 'clubman', name: 'Bran', seasons: ages.m[10] },
      ]);
      const out = drillQueued(c, home.id);
      expect(out).toEqual([expect.objectContaining({ kind: 'infantry', men: 2 })]);
      const a = c.armies.find((x) => x.id === out[0].army)!;
      expect(a.units.infantry).toBe(1); // one company of the two
      expect(menOf(c, a).town).toBe(2);
      expect(musterOf(c, a.id)!.men[home.id]).toHaveLength(2);
      expect(queuedAt(c, home.id).map((m) => m.name)).toEqual(['Bran']); // the third waits for another
      expect(c.log.some((l) => l.startsWith('Ivo and Holt of'))).toBe(true);
    } finally { MEN.company = was; }
  });
});
