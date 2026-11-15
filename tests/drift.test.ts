// Drift on the map (docs/DESIGN.md, step 5; src/sim/drift.ts): a strained town's people drift a few a season, women
// to the tavern and men to the mines, and its standing falls; a well-kept town has them back. Drift inside a town is
// tests/driftintown.test.ts.
import { describe, expect, it } from 'vitest';
import { Campaign, endTurn, newCampaign } from '../src/sim/campaign';
import { BACK_MOST, FALL, GO_MOST, MILD, MINE_GOLD, NATION_DIP, NEWLY_TAKEN, RISE, SHARE, TAVERN_GOLD, driftSeason, driftTown, driftedOf, newlyTaken, townStanding, watchOf } from '../src/sim/drift';
import { faithAt, nationVirtue } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';
import { couplesOf } from '../src/sim/seasonfolk';
import { defenceOf } from '../src/sim/threats';
import { mouths } from '../src/sim/larder';
import { issueDecree } from '../src/sim/decrees';
import { seat } from '../src/sim/court';

describe('drift on the map', () => {
  const world = (): { c: Campaign; tid: number } => {
    const c = newCampaign(5, 1, 1, 'hearth');
    return { c, tid: c.territories.find((t) => t.capital === 0)!.id };
  };

  it('a hungry town falls by the season, and its men go to the mines; a fed and quiet one stays where its church and tavern put it', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    f.stores.food = 0;
    const gold = f.stores.gold, was = faithAt(c, tid);
    expect(driftTown(c, tid)).toBeLessThan(0);
    expect(faithAt(c, tid)).toBeLessThan(was);
    expect(townStanding(c, tid)).toBe(faithAt(c, tid));
    expect(nationVirtue(c, 0)).toBe(c.factions[0].virtue); // the nation is its towns'
    expect(f.stores.gold).toBeGreaterThan(gold);
    f.stores.food = 5000;
    t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern');
    expect(driftTown(c, tid)).toBe(0);
    expect(f.drift!.care).toBeGreaterThan(0);
    expect(RISE).toBeGreaterThan(0);
  });

  it('a strained town with a tavern falls faster than one without, as its women drift there, and no town falls past the end of the scale', () => {
    const fall = (tavern: boolean): number => {
      const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
      t.buildings = [...t.buildings.filter((b) => b !== 'tavern'), ...(tavern ? ['tavern'] : [])];
      f.men = 8; f.women = 8; f.stores.food = 0;
      let sum = 0;
      for (let s = 0; s < 4; s++) { c.turn++; const m = driftTown(c, tid); expect(m).toBeGreaterThanOrEqual(-FALL - 4); sum += m; }
      return sum;
    };
    expect(fall(true)).toBeLessThan(fall(false));
    const { c, tid } = world(), f = folkOf(c, tid);
    f.stores.food = 0;
    for (let s = 0; s < 80; s++) driftTown(c, tid);
    expect(faithAt(c, tid)).toBe(-100);
  });

  it('every town drifts when a season passes', () => {
    const { c, tid } = world();
    for (let s = 0; s < 2; s++) { endTurn(c); }
    expect(folkOf(c, tid).drift).toBeDefined();
  }, 60_000);

  it('the drifted are counted on the town\'s record: a few a season under strain, up to half of each, and back with care', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    t.buildings = [...t.buildings.filter((b) => b !== 'tavern'), 'tavern'];
    f.men = 8; f.women = 8; f.stores.food = 0;
    driftTown(c, tid);
    const d = driftedOf(c, tid);
    expect(d.tavern + d.mines).toBeGreaterThan(0);
    expect(d.tavern + d.mines).toBeLessThanOrEqual(GO_MOST);
    for (let s = 0; s < 20; s++) { c.turn++; driftTown(c, tid); }
    expect(driftedOf(c, tid)).toEqual({ tavern: 8 * SHARE, mines: 8 * SHARE });
    const gold = f.stores.gold;
    driftTown(c, tid);
    expect(f.stores.gold - gold).toBe(4 * MINE_GOLD + 4 * TAVERN_GOLD);
    f.stores.food = 5000;
    for (let s = 0; s < 20; s++) { c.turn++; driftTown(c, tid); }
    expect(driftedOf(c, tid)).toEqual({ tavern: 0, mines: 0 });
    expect(f.drifted).toBeUndefined();
  });

  it('what the drifted do to the rest: thin walls, fewer wives, and they eat where they work', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    f.men = 8; f.women = 8; delete t.town;
    const whole = defenceOf(c, tid), wives = couplesOf(t, f), eat = mouths(c, tid);
    f.drifted = { tavern: 3, mines: 4 };
    expect(watchOf(c, tid)).toBe(0.5);
    expect(defenceOf(c, tid).men).toBeLessThan(whole.men);
    expect(defenceOf(c, tid).total).toBeLessThan(whole.total);
    expect(couplesOf(t, f)).toBe(wives - 3);
    expect(mouths(c, tid)).toMatchObject({ men: eat.men - 4, women: eat.women - 3 });
  });

  it('a shut tavern sends its women home; women ordered into it stay there', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    t.buildings = [...t.buildings.filter((b) => b !== 'tavern'), 'tavern'];
    f.men = 8; f.women = 8; f.stores.food = 5000;
    c.factions[0].supplies = 30;
    seat(c, 0, tid);
    expect(issueDecree(c, 0, tid, 'tavernWomen')).toBe('');
    driftTown(c, tid);
    expect(driftedOf(c, tid).tavern).toBe(8 * SHARE);
    t.decrees = [];
    f.drifted = { tavern: 3, mines: 0 };
    expect(issueDecree(c, 0, tid, 'closeTavern')).toBe('');
    driftTown(c, tid);
    expect(driftedOf(c, tid).tavern).toBe(0);
  });

  it('a nation that has lately lost a known person dips in standing, every town together', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    driftSeason(c);
    const was = faithAt(c, tid);
    f.notables.push({ name: 'Maren', gender: 'f', kind: 'mother', deed: 'raised 9 children', kids: 9, turn: 1, lost: { turn: c.turn, how: 'killed' } });
    f.stores.food = 5000;
    driftSeason(c);
    expect(faithAt(c, tid)).toBeLessThan(was);
    expect(NATION_DIP).toBeGreaterThan(0);
  });
});
describe('what strains a town enough to drift (tuned to docs/TUNING.md)', () => {
  const world = (): { c: Campaign; tid: number } => {
    const c = newCampaign(5, 1, 1, 'hearth');
    return { c, tid: c.territories.find((t) => t.capital === 0)!.id };
  };
  const ready = (c: Campaign, tid: number): void => {
    const f = folkOf(c, tid), t = c.territories[tid];
    t.buildings = [...t.buildings.filter((b) => b !== 'tavern'), 'tavern'];
    f.men = 8; f.women = 8; f.stores.food = 5000; delete f.hungry; delete f.drifted;
  };

  it('a larder that fell short this season, alone, is a mild strain: nobody new drifts', () => {
    const { c, tid } = world();
    ready(c, tid);
    folkOf(c, tid).hungry = 1;
    driftTown(c, tid);
    expect(folkOf(c, tid).drift!.strain).toBeGreaterThan(0);
    expect(folkOf(c, tid).drift!.strain).toBeLessThan(MILD);
    expect(driftedOf(c, tid)).toEqual({ tavern: 0, mines: 0 });
  });

  it('under a mild strain the drifted come back, two a season', () => {
    const { c, tid } = world();
    ready(c, tid);
    const f = folkOf(c, tid);
    f.drifted = { tavern: 2, mines: 2 };
    f.hungry = 1;
    driftTown(c, tid);
    const d = driftedOf(c, tid);
    expect(d.tavern + d.mines).toBe(4 - (BACK_MOST - 1));
  });

  it('a town newly taken by force drifts, but its unrest does not lower its standing: the yoke weighs on it already', () => {
    const { c, tid } = world();
    ready(c, tid);
    c.territories[tid].yoke = { from: 1, since: c.turn, resent: 0 };
    expect(newlyTaken(c, tid)).toBe(true);
    const was = faithAt(c, tid);
    expect(driftTown(c, tid)).toBeGreaterThanOrEqual(0);
    expect(faithAt(c, tid)).toBe(was);
    const d = driftedOf(c, tid);
    expect(d.tavern + d.mines).toBeGreaterThan(0);
    // Settled, or long since taken, it is unsettled no more.
    c.turn += NEWLY_TAKEN + 1;
    expect(newlyTaken(c, tid)).toBe(false);
  });
});
