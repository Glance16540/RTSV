// A town is at work from its first second (src/sim/atwork.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game, Unit } from '../src/sim/game';
import { GOVERN, keepOrders, shareOf } from '../src/sim/governor';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { handsBy, setToWork, workChanged } from '../src/sim/atwork';
import { folkOf } from '../src/sim/township';
import { run } from './helpers';

const world = (): { c: Campaign; tid: number } => { const c = newCampaign(7, 1, 1, 'hearth'); return { c, tid: c.territories.find((t) => t.capital === 0)!.id }; };
const enter = (c: Campaign, tid: number): Game => {
  expect(beginVisit(c, tid)).toBe(true);
  const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
};
const folk = (g: Game, owner = 0): Unit[] => g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead);
const at = (g: Game, owner = 0): Record<string, number> => { const o: Record<string, number> = { food: 0, wood: 0, gold: 0, stone: 0, idle: 0 }; for (const u of folk(g, owner)) o[u.order?.t === 'gather' ? u.order.res : 'idle']++; return o; };

describe('the shares, in whole hands', () => {
  it('add to the hands there are, the largest part made up first', () => {
    expect(handsBy(GOVERN.work, 28)).toEqual({ food: 14, wood: 7, gold: 4, stone: 3 });
    expect(handsBy({ food: 1 }, 5)).toEqual({ food: 5, wood: 0, gold: 0, stone: 0 });
    expect(handsBy({ food: 1, wood: 1, gold: 1 }, 4)).toEqual({ food: 2, wood: 1, gold: 1, stone: 0 });
    expect(handsBy(undefined, 9)).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
    expect(handsBy(GOVERN.work, 0)).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
  });
});

describe('a town visited is at work as the visit begins', () => {
  it('its people are at the work its shares say, and hardly anybody stands idle', () => {
    const { c, tid } = world();
    const share = shareOf(c, tid).share;
    const g = enter(c, tid);
    const now = at(g), n = folk(g).length;
    expect(n).toBeGreaterThan(20);
    expect(now.idle).toBeLessThanOrEqual(2);
    // Food is the largest share and the most hands; each kind there is ground for has somebody at it.
    const most = (['food', 'wood', 'gold', 'stone'] as const).slice().sort((a, b) => share[b] - share[a])[0];
    expect(now[most]).toBe(Math.max(now.food, now.wood, now.gold, now.stone));
    expect(now.wood).toBeGreaterThan(0);
    run(g, 60);
    expect(g.players[0].stats.gathered).toBeGreaterThan(0); // and it brings something in
  }, 60_000);

  it('a town with orders works by them', () => {
    const { c, tid } = world();
    keepOrders(c, tid, { work: { food: 0, wood: 10, gold: 0, stone: 0 } });
    const g = enter(c, tid);
    const now = at(g);
    expect(now.wood).toBeGreaterThanOrEqual(folk(g).length - 2);
    expect(now.gold + now.stone).toBe(0);
  });

  it('leaving with nothing changed leaves the town to its governor: the work it was set to is not written back as orders', () => {
    const { c, tid } = world();
    const g = enter(c, tid);
    expect(workChanged(g, 0)).toBe(false);
    expect(g.orders(0).work).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
    finishVisit(c, { town: g.standing(0), orders: g.orders(0), folk: g.census(0), seconds: 5 });
    expect(c.territories[tid].orders?.work).toBeUndefined();
  });

  it('the moment the player moves a hand, the whole town is counted as it stands', () => {
    const { c, tid } = world();
    const g = enter(c, tid);
    const before = at(g);
    const digger = folk(g).find((u) => u.order?.t === 'gather' && u.order.res === 'food')!;
    const gold = g.resources.find((r) => r.resType === 'gold')!;
    g.cmdTarget(0, [digger.id], gold.id);
    expect(workChanged(g, 0)).toBe(true);
    const o = g.orders(0);
    expect(o.work.gold).toBe(before.gold + 1);
    expect(o.work.food).toBe(before.food - 1);
    finishVisit(c, { town: g.standing(0), orders: o, folk: g.census(0), seconds: 5 });
    expect(c.territories[tid].orders?.work).toEqual(o.work);
  });

  it('a field nobody was set to work on is counted as it always was', () => {
    const { c, tid } = world();
    beginVisit(c, tid);
    const cfg = visitConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups.map((s) => ({ ...s, bonus: { ...s.bonus, work: undefined } })), cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(at(g).idle).toBe(folk(g).length);
    expect(workChanged(g, 0)).toBe(true);
    expect(setToWork(g, 0, undefined, g.spec.starts[0])).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
  });
});

describe('in a siege', () => {
  it('the player\'s town defended is at work; a rival\'s town is left to the mind that plays it', () => {
    const { c, tid } = world();
    const home = c.territories[tid], next = home.adj.find((n) => c.territories[n].owner !== 0)!;
    c.territories[next].owner = 1;
    c.armies.push({ id: 990, owner: 1, at: next, units: { infantry: 4 }, hero: false, vet: 0, moved: false } as never);
    expect(moveArmy(c, 990, tid)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!;
    const mine = cfg.setups.findIndex((s) => !s.isAI);
    expect(cfg.setups[mine].bonus?.work).toBeTruthy();
    expect(cfg.setups.filter((s) => s.isAI).every((s) => !s.bonus?.work)).toBe(true);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(at(g, mine).idle).toBeLessThanOrEqual(2);
    expect(folkOf(c, tid).men).toBeGreaterThan(0);
  });
});
