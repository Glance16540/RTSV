// The people a town has are one record (docs/DESIGN.md, "People come only by birth"): a visit brings them in and
// sends them home, a siege keeps those born in it, and on the map housed couples raise children season by season.
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { VISIT_SECONDS, beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { TOWN_GROW } from '../src/sim/birthonly';
import { folkOf, grown } from '../src/sim/township';
import { GROWN_SEASONS, couplesOf, roomOf, seasonFolk, seasonTown } from '../src/sim/seasonfolk';
import { run, spot, villagers } from './helpers';

const LONG = 60_000;
const world = (seed = 5): Campaign => newCampaign(seed, 1, 1, 'hearth');
const home = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;
const play = (cfg: NonNullable<ReturnType<typeof visitConfig>>): Game => new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
/** Put a couple of the town into a new house and let the visit or battle run. */
const raise = (g: Game, owner: number, seconds: number) => {
  const at = spot(g, 'house', owner);
  const h = g.spawnBuilding('house', owner, at.cx, at.cy, true);
  g.players[owner].res.food += 1000;
  run(g, 1);
  g.cmdAutoResidents(owner, h.id);
  run(g, seconds);
};

describe('a visit brings the town\'s own people and sends them home', () => {
  it('the town on a visit is its people and stores, not four founders and the usual stock', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 6; f.women = 5; f.elders = 2; f.children = 3;
    f.stores = { food: 444, wood: 333, gold: 22, stone: 11 };
    expect(beginVisit(c, h.id)).toBe(true);
    const g = play(visitConfig(c)!);
    expect(villagers(g, 0).length).toBe(13);
    expect(g.players[0].res).toMatchObject({ food: 444, wood: 333, gold: 22, stone: 11 });
    expect(g.census(0)).toMatchObject({ men: 6, women: 5, elders: 2, children: 3 });
  }, LONG);

  it('those born on a visit are the town\'s when the player leaves, and the dead are not', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 3; f.women = 3; f.elders = 0; f.children = 0;
    beginVisit(c, h.id);
    const g = play(visitConfig(c)!);
    raise(g, 0, 150);
    const born = g.players[0].stats.born;
    expect(born).toBeGreaterThanOrEqual(2);
    const census = g.census(0);
    expect(finishVisit(c, { folk: census, seconds: 151 })).toBe(true);
    expect(folkOf(c, h.id)).toMatchObject({ men: census.men, women: census.women, children: census.children });
    expect(grown(folkOf(c, h.id)) + folkOf(c, h.id).children).toBeGreaterThan(6);
    expect(c.log.some((l) => /born or came of age/.test(l))).toBe(true);
  }, LONG);

  it('a visit that sends no count home leaves the town as it was', () => {
    const c = world(), h = home(c), before = { ...folkOf(c, h.id) };
    beginVisit(c, h.id);
    finishVisit(c, { seconds: 30 });
    expect(folkOf(c, h.id)).toMatchObject({ men: before.men, women: before.women, children: before.children });
  });
});

describe('a siege keeps those born in it', () => {
  it('children born and grown in a siege go home with the town that held it', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 3; f.women = 3; f.elders = 0; f.children = 0;
    c.armies.push({ id: 99, owner: 1, at: h.adj[0], units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    c.territories[h.adj[0]].owner = 1;
    expect(moveArmy(c, 99, h.id)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea);
    raise(g, 0, 150);
    const census = g.census(0);
    expect(census.men + census.women + census.elders + census.children).toBeGreaterThan(6);
    finishBattle(c, true, undefined, { folk: census });
    expect(folkOf(c, h.id)).toMatchObject({ men: census.men, women: census.women, children: census.children });
  }, LONG);
});

describe('on the map, housed couples raise children season by season', () => {
  it('a town nobody has entered is kept by its governor: its couples raise children, who cost food', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    delete h.town;
    f.men = 4; f.women = 4; f.children = 0; f.stores.food = 1000;
    expect(couplesOf(h, f)).toBe(4);
    let born = 0;
    for (let s = 0; s < 8; s++) { c.turn++; born += seasonTown(c, h.id).born; }
    expect(born).toBeGreaterThanOrEqual(2);
    expect(born).toBeLessThanOrEqual(6);
    expect(f.children).toBe(born);
    expect(f.stores.food).toBe(1000 - 25 * born);
  });

  it('a town on record has as many couples as finished houses, and room for five to a house and ten to the hall', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 6; f.women = 6; f.elders = 0; f.children = 0; f.stores.food = 5000;
    h.town = { at: 0, b: [['towncenter', 10, 10], ['house', 20, 20], ['house', 24, 20, 0.5, 0.4]] };
    expect(couplesOf(h, f)).toBe(1); // the second house was never finished
    expect(roomOf(h)).toBe(15);
    for (let s = 0; s < 60; s++) { c.turn++; seasonTown(c, h.id); }
    expect(grown(f) + f.children).toBeLessThanOrEqual(15);
    // With no house at all, nobody is born.
    h.town = { at: 0, b: [['towncenter', 10, 10]] };
    const kids = f.children;
    for (let s = 0; s < 20; s++) { c.turn++; expect(seasonTown(c, h.id).born).toBe(0); }
    expect(f.children).toBeLessThanOrEqual(kids);
  });

  it('a town of women only, or with no food, raises nobody', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    delete h.town;
    f.men = 0; f.women = 6; f.children = 0; f.stores.food = 1000;
    for (let s = 0; s < 20; s++) { c.turn++; expect(seasonTown(c, h.id).born).toBe(0); }
    f.men = 6; f.stores.food = 10;
    for (let s = 0; s < 20; s++) { c.turn++; expect(seasonTown(c, h.id).born).toBe(0); }
  });

  it('children are counts on the record and come of age over the years into men and women', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    delete h.town;
    f.men = 0; f.women = 0; f.elders = 0; f.children = 30; f.stores.food = 0;
    let grew = 0;
    for (let s = 0; s < GROWN_SEASONS; s++) { c.turn++; grew += seasonTown(c, h.id).grew; }
    expect(grew).toBeGreaterThanOrEqual(15);
    expect(f.men + f.women).toBe(grew);
    expect(f.children).toBe(30 - grew);
    expect(f.men).toBeGreaterThan(0);
    expect(f.women).toBeGreaterThan(0);
  });

  it('a decadent people raises fewer than a righteous one', () => {
    const count = (virtue: number) => {
      const c = world(7), h = home(c), f = folkOf(c, h.id);
      delete h.town;
      c.factions[0].virtue = virtue;
      f.men = 8; f.women = 8; f.children = 0; f.stores.food = 10000;
      for (let s = 0; s < 24; s++) { c.turn++; seasonTown(c, h.id); }
      return f.children + f.men + f.women - 16;
    };
    expect(count(-90)).toBeLessThan(count(90));
  });

  it('runs for every town when a season passes', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    delete h.town;
    f.men = 5; f.women = 5; f.children = 0; f.stores.food = 2000;
    for (let s = 0; s < 12; s++) { c.turn++; seasonFolk(c); }
    expect(f.children).toBeGreaterThan(0);
  });
});

describe('a town and the map keep one pace for growing up', () => {
  it('a child takes as many visits to come of age in a town as seasons on the map', () => {
    expect(TOWN_GROW).toBe(VISIT_SECONDS * GROWN_SEASONS);
  });
});
