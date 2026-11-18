// A person ages only on the map, a season at a time, and each person's age is kept on the town's record
// (docs/DESIGN.md, "Time"; src/sim/ageing.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { folkOf, tollFolk } from '../src/sim/township';
import { CHILD_SEASONS, GROWN_SEASON, OLD_SEASON, SEASONS_A_YEAR, ageTown, agesOf, childSeasons, deathChance, leftFor } from '../src/sim/ageing';
import { GROW_TIME } from '../src/sim/data';
import { seasonTown } from '../src/sim/seasonfolk';
import { run, setups, spot, villagers } from './helpers';

const LONG = 60_000;
const world = (seed = 5): Campaign => newCampaign(seed, 1, 1, 'hearth');
const home = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const Y = SEASONS_A_YEAR;

describe('nobody ages in a campaign town', () => {
  it('in a campaign battle or visit the grown do not grow older, the old do not die, children do not grow; a skirmish ages as before', () => {
    const g = new Game(7, setups);
    g.bornOnly = true;
    const v = villagers(g, 0)[0];
    v.age = v.lifespan * 0.99; // a breath from the end of a life
    const before = villagers(g, 0).map((u) => u.age);
    const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const child = (g as unknown as { bear(b: unknown): { left: number } }).bear(h);
    const left = child.left;
    run(g, 120);
    expect(v.dead).toBe(false);
    expect(villagers(g, 0).map((u) => u.age)).toEqual(before);
    expect(child.left).toBe(left);
    const s = new Game(7, setups);
    const w = villagers(s, 0)[0];
    w.age = w.lifespan * 0.99;
    run(s, 120);
    expect(w.dead).toBe(true);
  });
});

describe('each person\'s age is on the town\'s record', () => {
  it('a town comes back from a visit with the same people at the same ages', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 3; f.women = 2; f.elders = 2; f.children = 2;
    f.ages = { m: [80, 150, 200, 250], f: [100, 236, 270], k: [3, 50] };
    beginVisit(c, h.id);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.bornOnly = true;
    run(g, 60);
    const census = g.census(0);
    expect(sorted(census.ages!.m)).toEqual([80, 150, 200, 250]);
    expect(sorted(census.ages!.f)).toEqual([100, 236, 270]);
    expect(sorted(census.ages!.k)).toEqual([3, 50]);
    finishVisit(c, { folk: census, seconds: 60 });
    expect(sorted(folkOf(c, h.id).ages!.m)).toEqual([80, 150, 200, 250]);
    expect(folkOf(c, h.id)).toMatchObject({ men: 3, women: 2, elders: 2, children: 2 });
  }, LONG);

  it('the record follows the counts when only a count is changed, with ages in the right bands', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 6; f.women = 4; f.elders = 3; f.children = 5;
    delete f.ages;
    const a = agesOf(c, h.id, f);
    expect(a.m.length + a.f.length).toBe(13);
    expect(a.m.filter((s) => s < OLD_SEASON).length).toBe(6);
    expect(a.f.filter((s) => s < OLD_SEASON).length).toBe(4);
    expect(a.k.every((s) => s >= 0 && s < GROWN_SEASON)).toBe(true);
    expect([...a.m, ...a.f].every((s) => s >= GROWN_SEASON)).toBe(true);
    // The toll of a battle settled from the map takes men; the record loses as many.
    tollFolk(c, h.id, true);
    expect(agesOf(c, h.id, f).m.filter((s) => s < OLD_SEASON).length).toBe(f.men);
    // Read twice with nothing changed, it is the same.
    expect(agesOf(c, h.id, f)).toEqual(agesOf(c, h.id, f));
  });
});

describe('on the map a person ages a season at a time', () => {
  it('a child comes of age at fifteen, the grown are old at sixty, and nobody under sixty dies of age', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 1; f.women = 1; f.elders = 0; f.children = 1;
    f.ages = { m: [OLD_SEASON - 1], f: [100], k: [GROWN_SEASON - 1] };
    c.turn++;
    const r = ageTown(c, h.id, f);
    expect(r).toMatchObject({ grew: 1, aged: 1, died: 0 });
    expect(f.children).toBe(0);
    expect(f.elders).toBe(1);
    expect(f.men + f.women).toBe(2);
    expect(deathChance(OLD_SEASON - 1)).toBe(0);
    expect(deathChance(OLD_SEASON + 10 * Y)).toBeGreaterThan(deathChance(OLD_SEASON));
  });

  it('the old die over the years after sixty: few in the first years, most within fifteen', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 0; f.women = 0; f.elders = 40; f.children = 0;
    f.ages = { m: Array(20).fill(OLD_SEASON), f: Array(20).fill(OLD_SEASON), k: [] };
    let died = 0;
    for (let s = 0; s < 3 * Y; s++) { c.turn++; died += ageTown(c, h.id, f).died; }
    expect(died).toBeLessThan(15);
    for (let s = 0; s < 12 * Y; s++) { c.turn++; died += ageTown(c, h.id, f).died; }
    expect(died).toBeGreaterThan(30);
    expect(f.elders).toBe(40 - died);
  });

  it('a season on the map ages the town, then its couples bear: newborns are on the record at nought', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    delete h.town;
    f.men = 6; f.women = 6; f.elders = 0; f.children = 0; f.stores.food = 5000;
    delete f.ages;
    let born = 0;
    for (let s = 0; s < 12; s++) { c.turn++; born += seasonTown(c, h.id).born; }
    expect(born).toBeGreaterThan(0);
    expect(f.ages!.k.length).toBe(f.children);
    expect(Math.min(...f.ages!.k)).toBeLessThan(12);
  });
});

describe('a child on the record keeps its age through a town', () => {
  it('every age from nought to the season before coming of age comes back the same', () => {
    for (let s = 0; s < CHILD_SEASONS; s++) expect(childSeasons(leftFor(s, GROW_TIME), GROW_TIME)).toBe(s);
    expect(leftFor(CHILD_SEASONS - 1, GROW_TIME)).toBeGreaterThan(0);
  });

  it('a child of 59 seasons comes back from a visit at 59, and comes of age with the next season', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    f.men = 1; f.women = 1; f.elders = 0; f.children = 1;
    f.ages = { m: [100], f: [100], k: [CHILD_SEASONS - 1] };
    beginVisit(c, h.id);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.bornOnly = true;
    run(g, 30);
    finishVisit(c, { folk: g.census(0), seconds: 30 });
    expect(f.ages!.k).toEqual([CHILD_SEASONS - 1]);
    c.turn++;
    expect(ageTown(c, h.id, f).grew).toBe(1);
  }, LONG);
});

