// The player's governor raises works of rule and faith and learns studies by its standing orders (src/sim/governworks.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { governWorksSeason, studyWanted, workWanted } from '../src/sim/governworks';
import { setStanding } from '../src/sim/townorders';
import { begunAt } from '../src/sim/townworks';
import { hasStudy } from '../src/sim/studies';
import { layTown } from '../src/sim/rivalrule';
import { manorNeeds } from '../src/sim/manor';
import { folkOf } from '../src/sim/township';

/** The player's capital, in the Bronze Age, rich in goods and bread, its town on record; and a second town beside it. */
function realm(): { c: Campaign; home: number; next: number } {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  c.factions[0].age = 1;
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id))!;
  next.owner = 0;
  for (const t of [home, next]) {
    t.buildings = ['farm'];
    const f = folkOf(c, t.id); delete f.hungry;
    f.stores = { food: 20000, wood: 5000, gold: 5000, stone: 5000 };
    delete t.town; layTown(c, t.id);
  }
  return { c, home: home.id, next: next.id };
}

describe('the governor and the works of rule and faith', () => {
  it('with no orders he raises none of them and learns nothing', () => {
    const { c, home } = realm();
    expect(workWanted(c, home)).toBeNull();
    expect(studyWanted(c, home)).toBeNull();
    expect(governWorksSeason(c)).toEqual({});
  });

  it('rule first: a Hall where the nation has none, then a Noble\'s Manor in a town big enough; not if told never to', () => {
    const { c, home, next } = realm();
    expect(setStanding(c, home, { first: 'rule' })).toBe('');
    expect(workWanted(c, home)).toBe('hall');
    setStanding(c, home, { never: ['hall'] });
    expect(workWanted(c, home)).not.toBe('hall'); // barred
    setStanding(c, home, { never: [] });
    expect(governWorksSeason(c).work).toEqual({ type: 'hall', at: home });
    expect(begunAt(c, home, 'hall')).toBe(true);
    // The nation has its Hall begun: a big town told the same raises a Manor.
    setStanding(c, next, { first: 'rule' });
    const f = folkOf(c, next); f.men = manorNeeds(); f.women = manorNeeds(); delete f.ages;
    expect(workWanted(c, next)).toBe('manor');
  });

  it('faith first: a Monastery once the Church stands and the town keeps the faith', () => {
    const { c, home } = realm();
    setStanding(c, home, { first: 'faith' });
    c.territories[home].virtue = 80;
    expect(workWanted(c, home)).toBeNull(); // no Church yet
    c.territories[home].buildings.push('church');
    expect(workWanted(c, home)).toBe('monastery');
    c.territories[home].virtue = 0;
    expect(workWanted(c, home)).toBeNull(); // not a holy town
  });

  it('none of it starves a town: a town that cannot spare the stores raises nothing', () => {
    const { c, home } = realm();
    setStanding(c, home, { first: 'rule' });
    folkOf(c, home).stores = { food: 20000, wood: 250, gold: 100, stone: 200 };
    expect(workWanted(c, home)).toBeNull();
  });

  it('told to learn studies, he learns the one taught in the town that presses most, when the nation can spare it', () => {
    const { c, home, next } = realm();
    c.territories[home].town!.b.push(['granary', 30, 30]); // a Granary stands: it teaches Salting and Smoking
    folkOf(c, next).hungry = 1; // hunger presses on the nation
    expect(studyWanted(c, home)).toBeNull(); // not told to
    setStanding(c, home, { learn: true });
    expect(studyWanted(c, home)).toBe('salting');
    expect(governWorksSeason(c).study).toEqual({ id: 'salting', at: home });
    expect(hasStudy(c, 0, 'salting')).toBe(true);
    for (const t of c.territories.filter((x) => x.owner === 0)) folkOf(c, t.id).stores = { food: 20000, wood: 50, gold: 10, stone: 0 };
    c.territories[home].town!.b.push(['infirmary', 34, 30]);
    expect(studyWanted(c, home)).toBeNull(); // the nation could not keep its floors after paying
  });
});
