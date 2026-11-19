// Drift inside a town (src/sim/driftintown.ts): the town turns out as the map left it, who works where shifts
// under pressure in real time, decrees are felt there, the computer leaves the drifted be, and those at the tavern
// and the mine go home as the town's drifted.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { AIController } from '../src/sim/ai';
import { driftBack, driftSecond, driftedIn, moraleOf, townStrain, withDrift } from '../src/sim/driftintown';
import { driftedOf } from '../src/sim/drift';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { folkOf, musterFolk } from '../src/sim/township';
import { run, setups, spot } from './helpers';

/** A campaign town with a tavern and a church, plenty in store. */
const town = (campaign = true, decrees?: { kind: 'guards' | 'closeTavern' | 'tavernWomen' | 'church' | 'alms'; strength: number }[]) => {
  const s = decrees ? [{ ...setups[0], bonus: { people: { men: 0, women: 0, elders: 0, children: 0, decrees } } }, setups[1]] : setups;
  const g = new Game(7, s);
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


describe('decrees and the computer, in a town', () => {
  it('a shut tavern keeps its women at their work; guards slow the drift', () => {
    const count = (decrees?: { kind: 'guards' | 'closeTavern'; strength: number }[]) => {
      const { g, p, tc } = town(true, decrees);
      run(g, 1200, () => raid(g, tc.x, tc.y));
      return p.drifted ?? { tavern: 0, mine: 0 };
    };
    const free = count();
    expect(count([{ kind: 'closeTavern', strength: 1 }]).tavern).toBe(0);
    const guarded = count([{ kind: 'guards', strength: 1 }]);
    expect(guarded.tavern + guarded.mine).toBeLessThanOrEqual(free.tavern + free.mine);
  }, 120_000);

  it('the computer does not set a drifted villager back to its own work', () => {
    const { g, p } = town();
    p.isAI = true;
    const ai = new AIController(g, 0); ai.setLevel(1);
    const man = g.units.find((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'm')!;
    const gold = g.findResourceNear(man.x, man.y, 'gold', 0, 40)!;
    g.cmdTarget(0, [man.id], gold.id);
    man.drifted = 'mine';
    // The computer never sets him to other work while he is drifted (sheltering him with his work to go back to is not
    // setting him back); the town's own care may still bring him back, by a roll of its own.
    const atGold = (o: typeof man.order): boolean => !!o && ((o.t === 'gather' && o.res === 'gold') || atGold((o as { then?: typeof man.order }).then ?? null));
    let touched = 0;
    run(g, 120, () => { const was = man.drifted; ai.update(); if (was && (man.drifted !== was || !atGold(man.order))) touched++; });
    expect(touched).toBe(0);
    if (!p.drifted?.back) {
      expect(man.drifted).toBe('mine');
      expect(man.order?.t === 'gather' && g.entities.get(man.order.id)?.type === 'gold').toBe(true);
    }
  }, 60_000);

  it('a town whose homes do not steady it is shaken the more by a raid', () => {
    const { g, p, tc } = town();
    raid(g, tc.x, tc.y);
    const bare = townStrain(g, p).strain;
    expect(moraleOf(g, p)).toBeLessThan(1);
    for (let k = 0; k < 5; k++) { const at = spot(g, 'house', 0); g.spawnBuilding('house', 0, at.cx, at.cy, true); }
    run(g, 2);
    raid(g, tc.x, tc.y);
    expect(moraleOf(g, p)).toBeGreaterThan(0);
    expect(townStrain(g, p).strain).toBeLessThan(bare);
  });
});

describe('the map\'s drifted, up close', () => {
  it('a visit turns out with the town\'s drifted men at the gold, and sends home who is drifted at the end', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), h = c.territories.find((t) => t.capital === 0)!, f = folkOf(c, h.id);
    f.men = 6; f.women = 6;
    f.drifted = { tavern: 0, mines: 2 };
    expect(withDrift(c, h.id, musterFolk(c, h.id)).people.drifted).toEqual({ tavern: 0, mines: 2 });
    beginVisit(c, h.id);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.bornOnly = true;
    run(g, 30);
    const now = driftedIn(g, 0);
    expect(now.mines).toBe(2);
    finishVisit(c, { folk: g.census(0), drifted: now, seconds: 30 });
    expect(driftedOf(c, h.id).mines).toBe(Math.min(2, folkOf(c, h.id).men));
  }, 60_000);

  it('the drifted written back are never more than the town has, and nobody drifted leaves no record', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), h = c.territories.find((t) => t.capital === 0)!, f = folkOf(c, h.id);
    f.men = 2; f.women = 3;
    driftBack(c, h.id, { tavern: 9, mines: 9 });
    expect(driftedOf(c, h.id)).toEqual({ tavern: 3, mines: 2 });
    driftBack(c, h.id, { tavern: 0, mines: 0 });
    expect(f.drifted).toBeUndefined();
  });
});
