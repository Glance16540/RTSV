// The soldiers of a visit go home to the map (src/sim/visit.ts): the army stationed there loses on the map what it
// lost in the town, and townsmen trained there become companies of the land's army, as that town's men.
import { describe, expect, it } from 'vitest';

import type { Army, Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginVisit, finishVisit, visitArms, visitConfig } from '../src/sim/visit';
import { awayFrom, musterOf } from '../src/sim/armytown';
import { folkOf } from '../src/sim/township';
import { run, bareCampaign, everyManSent } from './helpers';

everyManSent(); // these tests are about other rules: a company takes its two men while the town can spare them

const world = (): { c: Campaign; home: number } => {
  const c = bareCampaign(3);
  const home = c.territories.find((t) => t.owner === 0)!.id;
  c.armies = c.armies.filter((a) => a.at !== home);
  const f = folkOf(c, home);
  f.men = 8; f.women = 8; f.elders = 0; delete f.ages;
  return { c, home };
};
const station = (c: Campaign, at: number, units: Record<string, number>, hero = false): Army => {
  const a: Army = { id: c.nextArmy++, owner: 0, at, units, hero, vet: 0, moved: false };
  c.armies.push(a);
  return a;
};

describe('who bears arms as a visit ends', () => {
  it('the army\'s soldiers apart from townsmen trained there, by company', () => {
    const arms = visitArms([
      { owner: 0, type: 'clubman', lifespan: 0 }, { owner: 0, type: 'clubman', lifespan: 0 },
      { owner: 0, type: 'clubman', lifespan: 900 }, { owner: 0, type: 'bowman', lifespan: 900 }, { owner: 0, type: 'bowman', lifespan: 900 },
      { owner: 0, type: 'villager', lifespan: 900 }, { owner: 1, type: 'clubman', lifespan: 0 }, { owner: 0, type: 'clubman', lifespan: 0, dead: true },
    ], 0);
    expect(arms).toEqual({ army: { infantry: 2 }, trained: { infantry: 1, archers: 2 } });
  });

  it('in a real visit, the army stationed there is counted as the army\'s', () => {
    const { c, home } = world();
    station(c, home, { infantry: 2 });
    beginVisit(c, home);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.bornOnly = true;
    run(g, 5);
    expect(visitArms(g.units, 0).army.infantry).toBe(4);
    expect(visitArms(g.units, 0).trained).toEqual({});
  }, 60_000);
});

describe('the soldiers go home to the map', () => {
  it('townsmen trained there become companies of a new army, two men taken from the town onto its roll', () => {
    const { c, home } = world();
    const men = folkOf(c, home).men;
    beginVisit(c, home);
    expect(finishVisit(c, { arms: { army: {}, trained: { infantry: 5, archers: 1 } } })).toBe(true);
    const a = c.armies.find((x) => x.at === home && x.owner === 0)!;
    expect(a.units).toEqual({ infantry: 2 }); // a company for every two of a kind; the lone archer is not one
    expect(folkOf(c, home).men).toBe(men - 4);
    expect(awayFrom(c, home)).toBe(4);
    expect(musterOf(c, a.id)!.men[home]).toHaveLength(4);
  });

  it('they join the army already there', () => {
    const { c, home } = world();
    const a = station(c, home, { infantry: 1 });
    beginVisit(c, home);
    finishVisit(c, { arms: { army: { infantry: 2 }, trained: { archers: 2 } } });
    expect(a.units).toEqual({ infantry: 1, archers: 1 });
    expect(c.armies.filter((x) => x.at === home)).toHaveLength(1);
  });

  it('companies of the army lost in the town are lost on the map, and their men with them', () => {
    const { c, home } = world();
    const a = station(c, home, { infantry: 3 });
    beginVisit(c, home);
    finishVisit(c, { arms: { army: { infantry: 3 }, trained: {} } }); // three of six left: two companies, the third short
    expect(a.units).toEqual({ infantry: 2 });
    expect(c.log.some((l) => /company of the army in .* was lost/.test(l))).toBe(true);
    // An army that lost every man in the town is gone; the leader's keeps a company about them.
    const b = world(), gone = station(b.c, b.home, { infantry: 2 });
    beginVisit(b.c, b.home);
    finishVisit(b.c, { arms: { army: {}, trained: {} } });
    expect(b.c.armies).not.toContain(gone);
    const h = world(), led = station(h.c, h.home, { infantry: 2 }, true);
    beginVisit(h.c, h.home);
    finishVisit(h.c, { arms: { army: {}, trained: {} } });
    expect(led.units).toEqual({ infantry: 1 });
  });

  it('a visit that says nothing of arms leaves the army as it was', () => {
    const { c, home } = world();
    const a = station(c, home, { infantry: 2 });
    beginVisit(c, home);
    finishVisit(c, {});
    expect(a.units).toEqual({ infantry: 2 });
  });
});
