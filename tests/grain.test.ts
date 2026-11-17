// Grain bought abroad (src/sim/grain.ts, docs/DESIGN.md "The food decree buys grain abroad").
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { GRAIN, buyGrain, canSpareGrain, famineYear, goldOf, grainBar, grainDeal, grainPrice, grainWanted } from '../src/sim/grain';
import { needOf } from '../src/sim/larder';
import { PLENTY } from '../src/sim/plenty';
import { folkOf } from '../src/sim/township';
import { decreesAt, sensibleDecrees } from '../src/sim/decrees';

const world = (): { c: Campaign; tid: number; mine: number[] } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const mine = c.territories.filter((t) => t.owner === 0 && !t.horde).map((t) => t.id);
  for (const id of mine) folkOf(c, id).stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  return { c, tid, mine };
};

describe('grain bought abroad', () => {
  it('brings the town up to two seasons of its own eating, at a gold a food', () => {
    const { c, tid } = world(), s = folkOf(c, tid).stores;
    s.gold = 5000;
    const want = Math.ceil(GRAIN.seasons * needOf(c, tid));
    expect(grainWanted(c, tid)).toBe(want);
    expect(grainBar(c, 0, tid)).toBe('');
    expect(buyGrain(c, 0, tid)).toEqual({ food: want, gold: want * GRAIN.price });
    expect(s.food).toBe(want);
    expect(s.gold).toBe(5000 - want * GRAIN.price);
    // Already fed, it still brings the least worth sending for.
    expect(grainWanted(c, tid)).toBe(GRAIN.least);
  });

  it('is new food: no town of the nation gives up its bread, wood or stone for it', () => {
    const { c, tid, mine } = world();
    const other = mine.find((x) => x !== tid);
    folkOf(c, tid).stores.gold = 0;
    if (other === undefined) return;
    folkOf(c, other).stores = { food: 900, wood: 900, gold: 5000, stone: 900 };
    const d = buyGrain(c, 0, tid);
    expect(d.food).toBeGreaterThan(0);
    expect(folkOf(c, other).stores).toEqual({ food: 900, wood: 900, gold: 5000 - d.gold, stone: 900 });
  });

  it('by messenger, only half comes, and only that is paid for', () => {
    const { c, tid } = world();
    folkOf(c, tid).stores.gold = 5000;
    const whole = grainDeal(c, 0, tid, 1), half = grainDeal(c, 0, tid, 0.5);
    expect(half.food).toBe(Math.round(whole.food * 0.5));
    expect(half.gold).toBe(Math.ceil(half.food * GRAIN.price));
  });

  it('is dearer in a famine year, and as much is bought as the gold will pay for', () => {
    const { c, tid } = world();
    expect(famineYear(c, 0)).toBe(false);
    (c.events ??= []).push({ kind: 'famine', at: tid, until: c.turn } as never);
    expect(famineYear(c, 0)).toBe(true);
    expect(grainPrice(c, 0)).toBe(GRAIN.price * GRAIN.famine);
    folkOf(c, tid).stores.gold = 150;
    expect(grainDeal(c, 0, tid).food).toBe(Math.floor(150 / (GRAIN.price * GRAIN.famine)));
    folkOf(c, tid).stores.gold = 10;
    expect(grainBar(c, 0, tid)).toMatch(/not the gold/);
  });

  it('the computer buys only when the nation can spare the gold', () => {
    const { c, tid, mine } = world();
    const cost = grainWanted(c, tid) * GRAIN.price, floor = PLENTY.grain * PLENTY.floor * mine.length;
    for (const id of mine) folkOf(c, id).stores.gold = 0;
    expect(canSpareGrain(c, 0, tid)).toBe(false); // no gold, no grain
    if (floor > 0) { // a nation that keeps a stock of goods after buying (PLENTY.grain floors a town; none now, plenty.ts)
      folkOf(c, tid).stores.gold = cost + floor - 1;
      for (const id of mine) { const s = folkOf(c, id).stores; s.wood = 0; s.stone = 0; }
      expect(canSpareGrain(c, 0, tid)).toBe(false);
    }
    folkOf(c, tid).stores.gold = cost + floor;
    expect(goldOf(c, 0)).toBe(cost + floor);
    expect(canSpareGrain(c, 0, tid)).toBe(true);
  });

  it('a sensible ruler buys it for a hungry town beside the town\'s one decree, not instead of it', () => {
    const { c, tid } = world();
    folkOf(c, tid).stores.gold = 100000;
    c.factions[0].supplies = 30;
    sensibleDecrees(c, 0, (id) => ({ hungry: id === tid, raided: id === tid, moved: 0, standing: 0 }));
    expect(decreesAt(c, tid).map((d) => d.kind).sort()).toEqual(['alms', 'guards']);
    expect(folkOf(c, tid).stores.food).toBeGreaterThan(0);
  });
});
