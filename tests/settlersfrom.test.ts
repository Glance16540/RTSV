// Settlers come from the taker's own towns (src/sim/settlersfrom.ts): nobody from nowhere settles a town left empty.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { SETTLE_FROM, settleTaken, settlersTo, spareCouples } from '../src/sim/settlersfrom';
import { folkOf, headcount } from '../src/sim/township';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const empty = c.territories[home.adj[0]];
  empty.owner = 0; empty.horde = false as never;
  const e = folkOf(c, empty.id);
  e.men = 0; e.women = 0; e.elders = 0; e.children = 0; delete e.ages;
  const h = folkOf(c, home.id);
  h.men = 12; h.women = 12; delete h.ages;
  return { c, home, empty };
};
const grown = (c: ReturnType<typeof newCampaign>, tid: number) => { const f = folkOf(c, tid); return f.men + f.women + f.elders; };

describe('settlers from the taker\'s own towns', () => {
  it('a town spares couples only above what it keeps, and always a man and a woman', () => {
    const { c, home } = world();
    const f = folkOf(c, home.id);
    expect(spareCouples(c, home.id)).toBe(Math.floor((24 - SETTLE_FROM.keep) / 2));
    f.men = 1; f.women = 30;
    expect(spareCouples(c, home.id)).toBe(0);
    f.men = 4; f.women = 4;
    expect(spareCouples(c, home.id)).toBe(0); // eight grown: it keeps them all
  });

  it('they set out by road from the nearest town that can spare them, and nobody appears in the empty town', () => {
    const { c, home, empty } = world();
    const before = grown(c, home.id);
    const r = settlersTo(c, 0, empty.id, 2);
    expect(r).toEqual({ sent: 4, from: [home.id] });
    expect(grown(c, home.id)).toBe(before - 4);
    expect(headcount(folkOf(c, empty.id))).toBe(0);
    const going = (c.convoys ?? []).filter((x) => x.to === empty.id && x.movers);
    expect(going).toHaveLength(1);
    expect(going[0].cargo.men).toHaveLength(2);
    expect(going[0].cargo.women).toHaveLength(2);
    expect(going[0].cargo.children ?? []).toHaveLength(0);
    expect(c.log.at(-1)).toContain('set out by road to settle it');
  });

  it('where nobody can be spared, nobody comes and the town stands empty', () => {
    const { c, home, empty } = world();
    const f = folkOf(c, home.id);
    f.men = 4; f.women = 4;
    for (const t of c.territories) if (t.owner === 0 && t.id !== home.id && t.id !== empty.id) t.owner = -1;
    expect(settlersTo(c, 0, empty.id, 2)).toEqual({ sent: 0, from: [] });
    expect(c.log.at(-1)).toContain('stands empty');
  });

  it('after a battle, only a town taken with nobody left is settled', () => {
    const { c, empty } = world();
    expect(settleTaken(c, empty.id, 0).sent).toBe(0); // its holder kept it: it was not taken
    expect(settleTaken(c, empty.id, 1).sent).toBe(2 * SETTLE_FROM.taken);
    const { c: c2, empty: e2 } = world();
    folkOf(c2, e2.id).women = 1;
    expect(settleTaken(c2, e2.id, 1).sent).toBe(0); // someone lives there
  });
});
