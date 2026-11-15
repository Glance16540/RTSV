// The pace of births on the map and in a visit, as tuned against docs/TUNING.md ("People"): births are one record,
// whether the player is in the town or not (src/sim/seasonfolk.ts, src/sim/birthonly.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { folkOf } from '../src/sim/township';
import { YOUNG_SEASONS, bornOnVisit, seasonTown } from '../src/sim/seasonfolk';

const world = (seed = 5): Campaign => newCampaign(seed, 1, 1, 'hearth');
const home = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;

/** Births over some seasons in the player's capital, kept by its governor, with these children's ages to begin. */
function births(kids: number[], seasons: number, before?: (c: Campaign, tid: number) => void): number {
  const c = world(), h = home(c), f = folkOf(c, h.id);
  delete h.town;
  f.men = 3; f.women = 3; f.elders = 0; f.children = kids.length; f.stores.food = 5000;
  f.ages = { m: [100, 100, 100], f: [100, 100, 100], k: kids.slice() };
  f.due = 0;
  before?.(c, h.id);
  let born = 0;
  for (let s = 0; s < seasons; s++) { c.turn++; born += seasonTown(c, h.id).born; }
  return born;
}

describe('on the map, only children under five slow a couple\'s next', () => {
  it('a town whose children are older bears faster than one whose children are infants', () => {
    const infants = births(Array(9).fill(0), 8);
    const older = births(Array(9).fill(YOUNG_SEASONS + 4), 8);
    expect(older).toBeGreaterThan(infants);
    // With no children at all it is as with older ones: they no longer slow anyone.
    expect(births([], 8)).toBe(older);
  });
});

describe('what is born in a visit is the season\'s births, not more on top of them', () => {
  it('births in a visit are counted against what the town has due on the map', () => {
    const alone = births([], 8);
    const visited = births([], 8, (c, tid) => bornOnVisit(c, tid, 3));
    expect(visited).toBeLessThanOrEqual(alone - 2);
    expect(visited).toBeLessThan(alone);
  });

  it('a visit with no births changes nothing', () => {
    expect(births([], 8, (c, tid) => bornOnVisit(c, tid, 0))).toBe(births([], 8));
  });
});
