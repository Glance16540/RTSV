// A rival's foresight with its stores (src/sim/rivalstock.ts): goods sent a season ahead of its next age and its chosen
// work, and the town it spends in chosen by what it holds.
import { describe, expect, it } from 'vitest';
import { AGE_COST, ageCost, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { convoysTurn } from '../src/sim/convoys';
import { paysHere, priceOf } from '../src/sim/prices';
import { RIVAL } from '../src/sim/rivalrule';
import { RIVAL_STOCK, aheadTo, ageNext, rivalForesight, sendAhead, spendIn } from '../src/sim/rivalstock';
import { settleStores } from '../src/sim/stores';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** Rival 1 with its chief town bare and a town beside it rich in everything. */
function rival() {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = []; c.convoys = [];
  const chief = c.territories.find((t) => t.capital === 1)!;
  const rich = c.territories.find((t) => chief.adj.includes(t.id) && t.capital < 0)!;
  for (const t of c.territories) if (t.owner === 1 && t !== chief) t.owner = -1;
  rich.owner = 1;
  folkOf(c, chief.id).stores = { food: 300, wood: 100, gold: 50, stone: 50 };
  folkOf(c, rich.id).stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
  Object.assign(folkOf(c, rich.id), { men: 10, women: 10, elders: 1, children: 4 });
  settleStores(c);
  c.factions[1].isAI = true;
  return { c, chief, rich };
}

describe('a rival sends goods ahead', () => {
  it('sends what the paying town lacks of a price, from the town with most to spare, marked for what it is', () => {
    const { c, chief, rich } = rival();
    const n = 10, p = priceOf('age', n);
    expect(sendAhead(c, 1, chief.id, 'age', n)).toBeGreaterThan(0);
    const x = (c.convoys ?? []).filter((y) => y.ahead === 'age');
    expect(x.every((y) => y.from === rich.id && y.to === chief.id)).toBe(true);
    const coming = aheadTo(c, 1, chief.id, 'age'), s = folkOf(c, chief.id).stores;
    for (const k of ['food', 'wood', 'gold', 'stone'] as const) if (p[k] - s[k] >= RIVAL_STOCK.least) expect(coming[k]).toBe(p[k] - s[k]);
    expect(sendAhead(c, 1, chief.id, 'age', n)).toBe(0); // what is on the road is counted
    c.turn++;
    convoysTurn(c);
    expect(paysHere(c, 1, 'age', n, { at: chief.id })).toBe(true); // in when its time comes
  });

  it('acts a season before its age, not the season it buys', () => {
    const { c } = rival();
    const cost = ageCost(c, 1), f = c.factions[1];
    c.turn = 4; f.age = 0; f.supplies = cost + 8;
    expect(ageNext(c, 1, { cost, income: 0, maxAge: AGE_COST.length })).toBe(true); // its first age, next season (from the fifth)
    c.turn = 6;
    expect(ageNext(c, 1, { cost, income: 0, maxAge: AGE_COST.length })).toBe(false); // it buys now: the purchase sends for itself
    f.age = 1; c.aged = { 1: { age: 1, at: 10 } }; c.turn = 10 + RIVAL.settle - 1;
    expect(ageNext(c, 1, { cost, income: 0, maxAge: AGE_COST.length })).toBe(true); // its time in this age is up next season
    c.turn = 10 + RIVAL.settle - 3;
    expect(ageNext(c, 1, { cost, income: 0, maxAge: AGE_COST.length })).toBe(false);
  });

  it('only for a rival the computer leads, never for the player', () => {
    const { c } = rival();
    c.turn = 4; c.factions[0].supplies = 999;
    expect(rivalForesight(c, 0, { ageCost: 5, income: 99, maxAge: AGE_COST.length })).toBe(0);
    c.factions[1].supplies = ageCost(c, 1) + 8;
    expect(rivalForesight(c, 1, { ageCost: ageCost(c, 1), income: 0, maxAge: AGE_COST.length })).toBeGreaterThan(0);
  });
});

describe('a rival chooses where to spend', () => {
  it('in the first town that can pay out of its own stores, else the one holding most of what it is made of', () => {
    const { c, chief, rich } = rival();
    expect(spendIn(c, 1, 'church', [{ tid: chief.id, n: 5 }, { tid: rich.id, n: 5 }])).toBe(rich.id);
    folkOf(c, chief.id).stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
    settleStores(c);
    expect(spendIn(c, 1, 'church', [{ tid: chief.id, n: 5 }, { tid: rich.id, n: 5 }])).toBe(chief.id);
    expect(spendIn(c, 1, 'church', [])).toBeUndefined();
  });
});
