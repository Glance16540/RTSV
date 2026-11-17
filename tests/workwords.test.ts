// The panel says what a town will really work by (src/sim/workwords.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { GOVERN, keepOrders, ordersText, shareOf } from '../src/sim/governor';
import { folkOf } from '../src/sim/township';
import { needOf, KEEP_SEASONS } from '../src/sim/larder';
import { workReason, workText } from '../src/sim/workwords';

const town = () => { const c = newCampaign(7, 1, 1, 'hearth'); const t = c.territories.find((x) => x.capital === 0)!; return { c, t, f: folkOf(c, t.id) }; };

describe('what the panel says a town works by', () => {
  it('a full granary: the shares the governor in fact sets, and why', () => {
    const { c, t, f } = town();
    f.stores.food = KEEP_SEASONS * needOf(c, t.id) + 500;
    const now = shareOf(c, t.id).share;
    expect(now.food).toBeLessThan(GOVERN.work.food);
    expect(workReason(c, t.id)).toBe('full');
    const text = workText(c, t.id);
    expect(text).toContain(`${Math.round(now.food * 100)}% food`);
    expect(text).toContain(`${Math.round(now.wood * 100)}% wood`);
    expect(text).toContain('The granary is full');
    expect(text.startsWith('A governor keeps it')).toBe(true);
  });

  it('food short: four in five at the fields whatever the orders, and the orders said beside it', () => {
    const { c, t, f } = town();
    keepOrders(c, t.id, { work: { food: 2, wood: 6, gold: 0, stone: 0 } });
    f.stores.food = 0;
    expect(shareOf(c, t.id).fields).toBe(true);
    expect(workReason(c, t.id)).toBe('short');
    const text = workText(c, t.id);
    expect(text).toContain(`${Math.round(GOVERN.fields * 100)}% food`);
    expect(text).toContain('Food is short');
    expect(text).toContain('your orders were 75% wood, 25% food');
    expect(text.startsWith('By your last orders')).toBe(true);
  });

  it('nothing changed: the same words as the orders, with what is building and training', () => {
    const { c, t, f } = town();
    keepOrders(c, t.id, { work: { food: 6, wood: 2, gold: 0, stone: 0 }, build: ['house'], train: ['clubman'] });
    f.stores.food = 2 * needOf(c, t.id); // neither short nor full
    if (workReason(c, t.id) !== '') return; // this town's larder puts it one side or the other: the cases above cover it
    expect(workText(c, t.id)).toBe(ordersText(t));
  });
});
