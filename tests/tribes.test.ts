// The local tribes' warriors are their towns' men (src/sim/tribes.ts).
import { describe, expect, it } from 'vitest';
import { battleConfig, defence, defenders, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { TRIBE, armMen, tribeArms, tribeBeaten, tribeSide, tribesSeason, warriorsOf } from '../src/sim/tribes';
import { folkOf } from '../src/sim/township';

function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const tribe = c.territories[home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde)!];
  return { c, home, tribe };
}
const people = (c: Campaign, tid: number) => { const f = folkOf(c, tid); return f.men + f.women + f.elders + f.children; };

describe('a tribe\'s bands are its town\'s men', () => {
  it('a town nobody has looked into keeps its old number, and reading its strength founds nothing', () => {
    const { c, tribe } = world();
    const was = tribe.militia;
    expect(tribe.folk).toBeUndefined();
    expect(warriorsOf(c, tribe.id)).toBe(was);
    expect(defenders(c, tribe.id)).toEqual({ infantry: was });
    defence(c, tribe.id);
    expect(tribe.folk).toBeUndefined();
    expect(tribe.tribal).toBeUndefined();
  });

  it('once it has a record the town is made up, once, to the men its bands stood for, with women in proportion; the tribe is as strong as it was', () => {
    const { c, tribe } = world();
    const was = tribe.militia, before = defence(c, tribe.id);
    folkOf(c, tribe.id);
    expect(warriorsOf(c, tribe.id)).toBe(was);
    const f = folkOf(c, tribe.id);
    expect(f.men).toBeGreaterThanOrEqual(was * TRIBE.men);
    expect(f.women).toBeGreaterThanOrEqual(Math.round(was * TRIBE.men * TRIBE.women));
    expect(tribe.tribal).toBe(true);
    expect(defence(c, tribe.id)).toBe(before);
    // From now on the count is the men: lose two and a band is gone; the old number is not read.
    f.men -= TRIBE.men;
    tribe.militia = 99;
    expect(warriorsOf(c, tribe.id)).toBe(was - 1);
    tribesSeason(c);
    expect(tribe.militia).toBe(was - 1); // and it is kept true, as a mirror
    // Made up once only: men lost are not made good.
    expect(folkOf(c, tribe.id).men).toBe((was - 1) * TRIBE.men + (f.men % TRIBE.men));
  });

  it('a land a nation has held keeps the people it has when it goes back to the tribes', () => {
    const { c, home } = world();
    const land = c.territories.find((t) => t.owner === 0 && t.capital < 0) ?? home;
    tribesSeason(c);
    expect(land.tribal).toBe(true);
    Object.assign(folkOf(c, land.id), { men: 3, women: 2 });
    land.owner = -1; land.capital = -1; land.militia = 9; // a revolt, with whatever number it was given
    expect(warriorsOf(c, land.id)).toBe(1);
    expect(folkOf(c, land.id).men).toBe(3);
    tribesSeason(c);
    expect(land.militia).toBe(1);
  });

  it('a tribe beaten off loses bands, and those are men of its town, the young first; never its last band', () => {
    const { c, tribe } = world();
    tribe.militia = 5;
    const f = folkOf(c, tribe.id);
    expect(warriorsOf(c, tribe.id)).toBe(5);
    const men = f.men, women = f.women, kids = f.children;
    expect(tribeBeaten(c, tribe.id, 2)).toBe(2 * TRIBE.men);
    expect(f.men).toBe(men - 2 * TRIBE.men);
    expect([f.women, f.children]).toEqual([women, kids]);
    expect(f.ages!.m.length + f.ages!.f.length).toBe(f.men + f.women + f.elders);
    expect(warriorsOf(c, tribe.id)).toBe(3);
    expect(tribe.militia).toBe(3);
    tribeBeaten(c, tribe.id, 50);
    expect(warriorsOf(c, tribe.id)).toBe(TRIBE.least);
    expect(f.men).toBe(TRIBE.least * TRIBE.men + (men % TRIBE.men));
  });

  it('an attack thrown back in an unwatched battle costs the tribe men of its town', () => {
    let fought = 0;
    for (let seed = 1; seed <= 12 && fought < 2; seed++) {
      const { c, home, tribe } = world(seed);
      tribe.militia = 6; tribe.buildings = []; tribe.trait = '';
      c.armies = c.armies.filter((a) => a.owner !== 0);
      c.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
      if (moveArmy(c, 801, tribe.id) !== 'battle') continue;
      folkOf(c, tribe.id); // the town is looked into, and so made up to its six bands
      expect(warriorsOf(c, tribe.id)).toBe(6);
      const all = people(c, tribe.id), men = folkOf(c, tribe.id).men;
      expect(men).toBe(6 * TRIBE.men);
      if (resolvePending(c, 'auto')) continue; // the army won this one
      fought++;
      expect(tribe.owner).toBe(-1);
      expect(folkOf(c, tribe.id).men).toBeLessThan(men);
      expect(people(c, tribe.id)).toBeLessThan(all);
      expect(warriorsOf(c, tribe.id)).toBe(Math.floor(folkOf(c, tribe.id).men / TRIBE.men));
      expect(tribe.militia).toBe(warriorsOf(c, tribe.id));
    }
    expect(fought).toBeGreaterThan(0);
  });

  it('a tale that makes a tribe less ready for war stands its men down; nobody is made or unmade', () => {
    const { c, tribe } = world();
    tribe.militia = 4;
    const f = folkOf(c, tribe.id);
    tribeArms(c, tribe.id, -1);
    const all = people(c, tribe.id);
    expect(warriorsOf(c, tribe.id)).toBe(3);
    expect(tribe.militia).toBe(3);
    expect(f.men).toBe(4 * TRIBE.men);
    tribeArms(c, tribe.id, -9);
    expect(warriorsOf(c, tribe.id)).toBe(TRIBE.least); // some always keep their spears
    tribeArms(c, tribe.id, 9);
    expect(warriorsOf(c, tribe.id)).toBe(4);
    expect(tribe.stoodDown).toBeUndefined();
    expect(people(c, tribe.id)).toBe(all);
  });
});

describe('a tribe\'s town fought over in person', () => {
  it('fields its own men in arms and no clubmen from nowhere; in the open, and for the marauders, two clubmen to a band as before', () => {
    const { c, tribe } = world();
    tribe.militia = 4;
    expect(tribeSide(c, tribe.id, false)).toEqual({ clubmen: 0, warriors: 4 * TRIBE.men });
    expect(tribeSide(c, tribe.id, true)).toEqual({ clubmen: 8, warriors: 0 });
    const camp = world().tribe;
    const w = world();
    w.tribe.horde = true; w.tribe.militia = 5;
    expect(tribeSide(w.c, w.tribe.id, false)).toEqual({ clubmen: 10, warriors: 0 });
    expect(camp.horde).toBeFalsy();
  });

  it('in the battle those men are the same people in arms, and are counted with the town when it is over', () => {
    const { c, home, tribe } = world();
    tribe.militia = 3; tribe.buildings = []; tribe.trait = '';
    c.armies = c.armies.filter((a) => a.owner !== 0);
    c.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 801, tribe.id)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!;
    const side = cfg.setups[1];
    expect(side.bonus!.units).toEqual({});
    expect(side.bonus!.warriors).toBe(3 * TRIBE.men);
    const f = folkOf(c, tribe.id);
    expect(side.bonus!.people).toMatchObject({ men: f.men, women: f.women });
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const theirs = g.units.filter((u) => u.owner === 1 && !u.dead);
    const armed = theirs.filter((u) => g.isMilitary(u));
    expect(armed).toHaveLength(3 * TRIBE.men);
    expect(armed.every((u) => u.lifespan > 0 && !!u.name)).toBe(true); // people of the town, not soldiers from nowhere
    expect(theirs.filter((u) => u.type === 'villager' && u.gender === 'm' && !g.isElder(u))).toHaveLength(f.men - 3 * TRIBE.men);
    // Counted home: every one of them is still one of the town's men.
    const census = g.census(1);
    expect(census.men + census.women + census.elders).toBe(f.men + f.women + f.elders);
    expect(census.men).toBeGreaterThanOrEqual(3 * TRIBE.men);
  });

  it('armMen takes grown men only, never more than there are, and keeps who they were', () => {
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
    const men = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'm');
    const women = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'f').length;
    const names = men.map((u) => u.name).sort();
    const armed = armMen(g, 0, 99);
    expect(armed).toHaveLength(men.length);
    expect(armed.map((u) => u.name).sort()).toEqual(names);
    expect(armed.every((u) => u.type !== 'villager' && u.lifespan > 0)).toBe(true);
    expect(g.units.filter((u) => u.owner === 0 && !u.dead && u.type === 'villager' && u.gender === 'm')).toHaveLength(0);
    expect(g.units.filter((u) => u.owner === 0 && !u.dead && u.type === 'villager' && u.gender === 'f')).toHaveLength(women);
    expect(armMen(g, 0, 3)).toHaveLength(0);
  });
});
