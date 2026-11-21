// Who serves in a Monastery or Convent, on the map, and what monks and nuns do there (src/sim/cloister.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { TECHS } from '../src/sim/data';
import { CLOISTER, cloisterOf, cloisterSeason, monksTeachMap, nunsNurseMap, servingIn, taughtCost } from '../src/sim/cloister';
import { MONKS, NUNS } from '../src/sim/clergywork';
import { allStudies, studyCost } from '../src/sim/studies';
import { folkOf } from '../src/sim/township';
import { sicken } from '../src/sim/acts';

function town(builds: string[] = ['monastery']) {
  const c = newCampaign(5, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.capital === 0)!;
  t.town = { at: 0, b: [...(t.town?.b ?? []), ...builds.map((type, i) => [type, 40 + i, 40, 0] as never)] };
  return { c, t, f: folkOf(c, t.id) };
}

describe('cloister', () => {
  it('as many serve as in a town at most, one in five of the grown at most, in the town\'s proportion', () => {
    expect(servingIn({ men: 40, women: 40 })).toEqual({ monks: 3, nuns: 3 });
    expect(servingIn({ men: 10, women: 30 })).toEqual({ monks: 1, nuns: 5 }); // a Convent
    expect(servingIn({ men: 30, women: 10 })).toEqual({ monks: 5, nuns: 1 });
    expect(servingIn({ men: 6, women: 6 })).toEqual({ monks: 1, nuns: 1 }); // a hamlet is not emptied into it
    expect(servingIn({ men: 2, women: 2 })).toEqual({ monks: 0, nuns: 0 });
    const k = servingIn({ men: 200, women: 200 });
    expect(k.monks + k.nuns).toBe(CLOISTER.most);
  });

  it('is kept once a season where a Monastery stands, and none where none does', () => {
    const { c, t, f } = town();
    f.men = 20; f.women = 40;
    cloisterSeason(c);
    expect(f.cloister).toEqual(servingIn(f));
    expect(cloisterOf(c, t.id).nuns).toBeGreaterThan(cloisterOf(c, t.id).monks);
    t.town!.b = t.town!.b.filter((x) => x[0] !== 'monastery');
    expect(cloisterOf(c, t.id)).toEqual({ monks: 0, nuns: 0 }); // read as nobody at once
    cloisterSeason(c);
    expect(f.cloister).toBeUndefined();
  });

  it('nuns nurse where an Infirmary stands: plague takes fewer, at a share of their work in a town', () => {
    const { c, t, f } = town(['monastery']);
    f.men = 30; f.women = 30;
    cloisterSeason(c);
    expect(nunsNurseMap(c, t.id)).toBe(1); // nowhere to nurse
    t.town!.b.push(['infirmary', 50, 50, 0] as never);
    const nuns = cloisterOf(c, t.id).nuns;
    expect(nunsNurseMap(c, t.id)).toBeCloseTo(1 - CLOISTER.share * Math.min(NUNS.most, NUNS.each * nuns));
    // The same plague season in two like towns: fewer die where the nuns nurse.
    const sick = (nursed: boolean) => {
      const x = town(['infirmary', ...(nursed ? ['monastery'] : [])]);
      const k = folkOf(x.c, x.t.id); k.men = 120; k.women = 120; k.elders = 0;
      cloisterSeason(x.c);
      return sicken(x.c, x.t);
    };
    expect(sick(true)).toBeLessThan(sick(false));
  });

  it('monks teach: a study learned in the town costs less, at a share of their work in a town', () => {
    const { c, t, f } = town();
    f.men = 60; f.women = 20;
    const id = allStudies()[0].id;
    expect(studyCost(c, id, t.id)).toEqual(TECHS[id].cost); // the season has not counted them yet
    cloisterSeason(c);
    const monks = cloisterOf(c, t.id).monks;
    expect(monks).toBeGreaterThan(0);
    expect(monksTeachMap(c, t.id)).toBeCloseTo(1 + CLOISTER.share * Math.min(MONKS.most, MONKS.each * monks));
    const cost = studyCost(c, id, t.id);
    for (const [r, v] of Object.entries(TECHS[id].cost)) if (v) { expect(cost[r as keyof typeof cost]).toBeLessThanOrEqual(v); expect(cost[r as keyof typeof cost]).toBe(Math.ceil(v / monksTeachMap(c, t.id))); }
    expect(taughtCost(c, t.id, { gold: 100 }).gold).toBeLessThan(100);
  });

  it('a saved game from before has no count, and loads as one with nobody serving until the season', () => {
    const { c, t } = town();
    const back = JSON.parse(JSON.stringify(c));
    expect(cloisterOf(back, t.id)).toEqual({ monks: 0, nuns: 0 });
    back.territories[t.id].folk.cloister = { monks: 'x', nuns: -3 };
    expect(cloisterOf(back, t.id)).toEqual({ monks: 0, nuns: 0 });
  });
});
