// Drift (docs/DESIGN.md, step 5; src/sim/drift.ts): a strained town's people turn to what is worse for them, a
// well-kept one drifts toward the holy way, in a town second by second and on the map season by season.
import { describe, expect, it } from 'vitest';
import { Campaign, endTurn, newCampaign, virtueOf } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { FALL, MAX_LEAN, RISE, driftSecond, driftTown, townStanding, townStrain } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';
import { run, setups, spot } from './helpers';

/** A campaign town with a tavern and a church, plenty in store. */
const town = (campaign = true) => {
  const g = new Game(7, setups);
  g.bornOnly = campaign;
  const p = g.players[0];
  Object.assign(p.res, { food: 2000, wood: 2000, gold: 500, stone: 500 });
  p.popCap = 200;
  for (const type of ['tavern', 'temple']) { const at = spot(g, type, 0); g.spawnBuilding(type, 0, at.cx, at.cy, true); }
  const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  for (let k = 0; k < 6; k++) g.spawnUnit('villager', 0, tc.x + 3 + (k % 3), tc.y + 3 + Math.floor(k / 3), k % 2 ? 'm' : 'f');
  return { g, p, tc };
};
const raid = (g: Game, x: number, y: number) => { g.players[0].lastAttacked = { x, y, t: g.time }; };

describe('drift in a town', () => {
  it('what strains a town: raids and hunger; and what cares for it: fed, safe, a church', () => {
    const { g, p, tc } = town();
    run(g, 200);
    expect(townStrain(g, p)).toMatchObject({ strain: 0 });
    expect(townStrain(g, p).care).toBeGreaterThan(0.5);
    raid(g, tc.x, tc.y);
    expect(townStrain(g, p).strain).toBeGreaterThan(0);
    expect(townStrain(g, p).care).toBe(0);
    p.hunger = 1000; p.res.food = 0;
    expect(townStrain(g, p).strain).toBeGreaterThan(0.5);
  });

  it('a raided campaign town loses people from their work to the tavern and the mine; a skirmish does not', () => {
    for (const campaign of [true, false]) {
      const { g, p, tc } = town(campaign);
      run(g, 900, () => raid(g, tc.x, tc.y));
      const d = p.drifted ?? { tavern: 0, mine: 0 };
      if (campaign) expect(d.tavern + d.mine).toBeGreaterThan(0);
      else expect(d.tavern + d.mine).toBe(0);
    }
  }, 60_000);

  it('a well-kept campaign town draws its people back from the tavern and to the church', () => {
    const { g, p } = town();
    const tavern = g.buildings.find((b) => b.type === 'tavern')!;
    const woman = g.units.find((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'f')!;
    g.cmdTarget(0, [woman.id], tavern.id);
    run(g, 1500);
    expect((p.drifted?.back ?? 0) + (p.drifted?.church ?? 0)).toBeGreaterThan(0);
    driftSecond(g);
  }, 60_000);
});

describe('drift on the map', () => {
  const world = (): { c: Campaign; tid: number } => {
    const c = newCampaign(5, 1, 1, 'hearth');
    return { c, tid: c.territories.find((t) => t.capital === 0)!.id };
  };

  it('a hungry town falls by the season, and its men go to the mines; a fed and quiet one rises, faster with a church', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    f.stores.food = 0; f.lean = 0;
    const gold = f.stores.gold;
    expect(driftTown(c, tid)).toBeLessThan(0);
    expect(f.lean).toBeLessThan(0);
    expect(f.stores.gold).toBeGreaterThan(gold);
    expect(townStanding(c, tid)).toBe(virtueOf(c, 0) + f.lean!);
    f.stores.food = 5000; f.lean = 0;
    t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern');
    const plain = driftTown(c, tid);
    expect(plain).toBeGreaterThan(0);
    expect(plain).toBeLessThanOrEqual(RISE);
    t.buildings.push('church');
    expect(driftTown(c, tid)).toBeGreaterThan(plain);
  });

  it('a strained town with a tavern falls faster than one without, and no town leans past the bound', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    t.buildings = t.buildings.filter((b) => b !== 'tavern');
    f.stores.food = 0; f.lean = 0;
    const without = driftTown(c, tid);
    t.buildings.push('tavern');
    const withTavern = driftTown(c, tid);
    expect(withTavern).toBeLessThan(without);
    expect(without).toBeGreaterThanOrEqual(-FALL);
    for (let s = 0; s < 40; s++) driftTown(c, tid);
    expect(f.lean).toBe(-MAX_LEAN);
  });

  it('every town drifts when a season passes', () => {
    const { c, tid } = world();
    for (let s = 0; s < 2; s++) { endTurn(c); }
    expect(folkOf(c, tid).drift).toBeDefined();
  }, 60_000);
});
