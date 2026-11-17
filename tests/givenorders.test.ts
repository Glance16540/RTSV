// One man's task among the idle is not the town's orders (src/sim/givenorders.ts; docs/PLAYTEST.md 4.2).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { GOVERN, keepOrders, workOf } from '../src/sim/governor';
import { GIVEN, ordersGiven, workGiven } from '../src/sim/givenorders';
import { beginVisit, visitConfig } from '../src/sim/visit';

const town = () => { const c = newCampaign(7, 1, 1, 'hearth'); return { c, t: c.territories.find((x) => x.capital === 0)! }; };

describe('which of a field\'s work is the leader\'s orders', () => {
  it('one man digging gold among twenty-seven idle leaves the governor\'s shares as they were', () => {
    const { c, t } = town();
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 1, stone: 0 }, build: ['house'], hands: 28 });
    expect(t.orders?.work).toBeUndefined();
    expect(t.orders?.build).toEqual(['house']); // what was begun is still kept
    expect(workOf(t)).toEqual(GOVERN.work);
  });

  it('a town already given its work keeps it', () => {
    const { c, t } = town();
    keepOrders(c, t.id, { work: { food: 20, wood: 8, gold: 0, stone: 0 }, hands: 28 });
    expect(t.orders?.work).toEqual({ food: 20, wood: 8, gold: 0, stone: 0 });
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 1, stone: 0 }, train: ['clubman'], hands: 28 });
    expect(t.orders?.work).toEqual({ food: 20, wood: 8, gold: 0, stone: 0 });
    expect(t.orders?.train).toEqual(['clubman']);
  });

  it('half the hands at work is orders, and a report that counts no hands is taken as before', () => {
    expect(workGiven({ food: 14 }, 28)).toBe(true);
    expect(workGiven({ food: 13 }, 28)).toBe(false);
    expect(GIVEN.share).toBe(0.5);
    expect(workGiven({ gold: 1 }, undefined)).toBe(true);
    expect(workGiven({}, 28)).toBe(false);
    const { c, t } = town();
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 10, stone: 0 } });
    expect(workOf(t)).toEqual({ food: 0, wood: 0, gold: 1, stone: 0 });
    expect(ordersGiven(undefined, null)).toBeNull();
  });

  it('nothing but an idle crowd leaves the old orders standing whole', () => {
    const { c, t } = town();
    keepOrders(c, t.id, { work: { food: 20, wood: 8, gold: 0, stone: 0 }, build: ['mill'], hands: 28 });
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 1, stone: 0 }, hands: 28 });
    expect(t.orders?.work).toEqual({ food: 20, wood: 8, gold: 0, stone: 0 });
  });

  it('the field says how many hands the town had there', () => {
    const { c, t } = town();
    beginVisit(c, t.id);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const o = g.orders(0);
    expect(o.hands).toBe(g.units.filter((u) => u.owner === 0 && u.type === 'villager').length);
    expect(o.hands).toBeGreaterThan(20);
  });
});
