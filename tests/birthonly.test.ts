// People come only by birth (docs/DESIGN.md): in the campaign no villager is bought at the Town Center.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { BORN_ONLY, TOWN_BIRTH, roomForCouples, unhousedCouples } from '../src/sim/birthonly';
import { VISIT_SECONDS } from '../src/sim/visit';
import { run, setups, spot, villagers } from './helpers';

/** A quiet town with a barracks and plenty in store. */
const town = (seed = 7) => {
  const g = new Game(seed, setups);
  const p = g.players[0], tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  Object.assign(p.res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  p.popCap = 200;
  const at = spot(g, 'barracks', 0);
  const barracks = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
  const said = (text: RegExp) => g.events.some((e) => e.t === 'msg' && e.player === 0 && text.test(e.text));
  return { g, p, tc, barracks, said };
};

describe('in the campaign a town\'s people are born, not bought', () => {
  it('the Town Center trains no villager, costs nothing for asking, and says why; a skirmish still hires', () => {
    const { g, p, tc, said } = town();
    g.bornOnly = true;
    const food = p.res.food;
    expect(g.cmdTrain(0, tc.id, 'villager', 'm')).toBe(false);
    expect(g.cmdTrain(0, tc.id, 'villager')).toBe(false);
    expect(tc.queue.length).toBe(0);
    expect(p.res.food).toBe(food);
    expect(said(/no villager is bought/)).toBe(true);
    expect(BORN_ONLY).toMatch(/born to its housed couples/);
    // The rule is kept with a saved battle.
    expect(Game.restore(g.serialize()).bornOnly).toBe(true);
    const skirmish = town();
    expect(skirmish.g.bornOnly).toBe(false);
    expect(skirmish.g.cmdTrain(0, skirmish.tc.id, 'villager')).toBe(true);
  });

  it('a housed couple raises its first child in a little more than a visit, who does not come of age; a skirmish is as fast as ever', () => {
    const born = (campaign: boolean, seconds: number) => {
      const { g, p } = town();
      g.bornOnly = campaign;
      const at = spot(g, 'house', 0);
      const h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
      run(g, 1);
      expect(g.cmdAutoResidents(0, h.id)).toBe(2);
      const before = villagers(g, 0).length;
      run(g, seconds);
      return { born: p.stats.born, grew: villagers(g, 0).length - before, young: h.young?.length ?? 0 };
    };
    // The first child takes TOWN_BIRTH seconds (birthonly.ts): none in a short stay, at most one in a visit, one soon after.
    expect(born(true, VISIT_SECONDS).born).toBeLessThanOrEqual(1);
    const visit = born(true, TOWN_BIRTH + 30);
    expect(visit.born).toBe(1);
    expect(visit.grew).toBe(0);
    expect(visit.young).toBe(1);
    expect(born(true, 200).born).toBe(0);
    const skirmish = born(false, 200);
    expect(skirmish.born).toBeGreaterThanOrEqual(3);
    expect(skirmish.grew).toBeGreaterThan(0);
  });

  it('a man with no wife is sent to arms before a husband, so the house goes on raising children', () => {
    const { g, barracks } = town();
    g.bornOnly = true;
    const at = spot(g, 'house', 0);
    const h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    run(g, 1);
    g.cmdAutoResidents(0, h.id);
    run(g, 20);
    const husband = g.entities.get(h.residents.m);
    expect(husband).toBeTruthy();
    // Every man at the same work, so that only the house tells them apart.
    const men = villagers(g, 0).filter((v) => v.gender === 'm');
    const tree = g.resources.find((r) => r.type === 'tree')!;
    g.cmdTarget(0, men.map((m) => m.id), tree.id);
    expect(g.cmdTrain(0, barracks.id, g.trainedAs(0, 'clubman'))).toBe(true);
    const called = men.find((m) => m.order?.t === 'enlist')!;
    expect(called).toBeTruthy();
    expect(called.homeId).toBe(0);
    expect(called).not.toBe(husband);
    // With no man left but the husband, he goes: the town's need is the town's to judge.
    expect(g.cmdTrain(0, barracks.id, g.trainedAs(0, 'clubman'))).toBe(true);
    expect((husband as { order?: { t: string } }).order?.t).toBe('enlist');
  });

  it('the computer, unable to buy hands, houses its couples and buys nobody', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true, civ: 'forge' }, setups[1]]);
    g.fixedAge = true;
    g.bornOnly = true;
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    ais.forEach((a) => a.setLevel(1));
    let hired = false;
    run(g, 60 * 20, () => {
      ais.forEach((a) => a.update());
      for (const b of g.buildings) if (b.queue.some((q) => q.id === 'villager')) hired = true;
    });
    expect(hired).toBe(false);
    for (const pid of [0, 1]) {
      expect(g.players[pid].stats.born, `born to ${pid}`).toBeGreaterThanOrEqual(1);
      // No more than one couple waits for a roof that is not coming.
      expect(unhousedCouples(g, pid) - roomForCouples(g, pid), `couples of ${pid} unhoused`).toBeLessThanOrEqual(1);
    }
  }, 120_000);
});
