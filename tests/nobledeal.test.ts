// Dealing with a noble (src/sim/nobledeal.ts): summon, gift, post, marriage, stripping; each costs, moves the mood,
// and lasts.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { NOBLES, noblesAt, noblesOf, noblesSeason, restOf } from '../src/sim/nobles';
import type { Noble } from '../src/sim/nobles';
import { DEALS, DEAL_KINDS, TITLES, dealBar, dealEffect, dealWith, dealsFor } from '../src/sim/nobledeal';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { daughterOfAge } from '../src/sim/courtstory';
import { folkOf } from '../src/sim/township';

const world = (): { c: Campaign; tid: number; lord: Noble } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  c.factions[0].supplies = 200;
  const f = folkOf(c, tid); f.men = 8; f.women = 8; f.elders = 0; delete f.ages;
  f.notables = [{ name: 'Wulf', gender: 'm', kind: 'veteran', deed: 'felled ten', turn: 0, kills: 10 }];
  delete c.factions[0].nobles; noblesSeason(c, 0);
  return { c, tid, lord: noblesAt(c, tid).find((n) => n.rank === 'lord')! };
};
const again = (c: Campaign, key: string): Noble => noblesOf(c, 0).find((n) => n.key === key)!;
const seasons = (c: Campaign, n: number): void => { for (let i = 0; i < n; i++) { c.turn++; noblesSeason(c, 0); } };

describe('dealing with a noble', () => {
  it('summoned to court, a noble is the calmer, and settles higher for a year; not again within it', () => {
    const { c, lord } = world();
    lord.mood = NOBLES.angry - 10;
    const supplies = c.factions[0].supplies;
    expect(dealWith(c, 0, lord.key, 'summon')).toBe('');
    expect(c.factions[0].supplies).toBeLessThan(supplies);
    expect(lord.mood).toBe(NOBLES.angry - 10 + DEALS.summon.mood);
    expect(dealBar(c, 0, lord.key, 'summon')).toMatch(/within the year/);
    seasons(c, 2);
    expect(restOf(c, again(c, lord.key))).toBe(DEALS.summon.rest);
    seasons(c, DEALS.summon.seasons);
    expect(restOf(c, again(c, lord.key))).toBe(0); // the bond has run out
    expect(dealBar(c, 0, lord.key, 'summon')).toBe('');
  });

  it('a gift and a post cost supplies; a post lasts while held, and stings the others of the rank', () => {
    const { c, tid, lord } = world();
    expect(dealWith(c, 0, lord.key, 'gift')).toBe('');
    expect(lord.mood).toBe(DEALS.gift.mood);
    const captain = noblesAt(c, tid).find((n) => n.rank === 'captain')!;
    const before = captain.mood;
    expect(dealWith(c, 0, captain.key, 'post')).toBe('');
    expect(again(c, captain.key).title).toBe(TITLES.captain);
    expect(dealBar(c, 0, captain.key, 'post')).toMatch(/Already/);
    seasons(c, 40);
    expect(again(c, captain.key).mood).toBeGreaterThanOrEqual(DEALS.post.rest - 1); // settled where the post holds it, years on
    expect(again(c, lord.key).mood).toBeLessThan(DEALS.post.rest);
    expect(before).toBe(0);
    c.factions[0].supplies = 0;
    expect(dealBar(c, 0, lord.key, 'gift')).toMatch(/costs/);
  });

  it('a grown son or daughter of the house weds a noble, never a child, and a wed daughter is not courted', () => {
    const { c, lord } = world();
    const h = houseOf(c, 0);
    h.heirs = [{ name: 'Tam', female: !lord.female, born: c.turn - 3 }];
    expect(dealBar(c, 0, lord.key, 'wed')).toMatch(/no grown son or daughter/);
    h.heirs.push({ name: 'Elin', female: !lord.female, born: c.turn - HEIR_AGE - 4 });
    expect(dealWith(c, 0, lord.key, 'wed')).toBe('');
    expect(h.heirs.find((x) => x.name === 'Elin')!.wedTo?.key).toBe(lord.key);
    expect(h.heirs.find((x) => x.name === 'Tam')!.wedTo).toBeUndefined();
    expect(lord.wed).toBe('Elin');
    expect(lord.mood).toBe(DEALS.wed.mood);
    expect(dealBar(c, 0, lord.key, 'wed')).toMatch(/Already wed/);
    if (!lord.female) expect(daughterOfAge(c)).toBeUndefined(); // Elin is wed: no suitor comes for her
    seasons(c, 60);
    expect(again(c, lord.key).mood).toBeGreaterThanOrEqual(DEALS.wed.rest - 1); // for good
    expect(c.log.some((l) => l.includes('Elin of your house weds'))).toBe(true);
  });

  it('a lord stripped of his lands is noble no more: his town has a new lord, the crown has his goods, the nobles are afraid', () => {
    const { c, tid, lord } = world();
    const captain = noblesAt(c, tid).find((n) => n.rank === 'captain')!, gold = folkOf(c, tid).stores.gold;
    expect(dealWith(c, 0, lord.key, 'strip')).toBe('');
    expect(noblesOf(c, 0).some((n) => n.key === lord.key)).toBe(false);
    const next = noblesAt(c, tid).find((n) => n.rank === 'lord')!;
    expect(next.name).not.toBe(lord.name);
    expect(folkOf(c, tid).stores.gold).toBe(gold + DEALS.strip.seized);
    expect(again(c, captain.key).mood).toBe(DEALS.strip.near);
    expect(c.factions[0].unlanded?.[0].name).toBe(lord.name);
    // A captain stripped is not reckoned a noble again, though still the town's most famous veteran.
    expect(dealWith(c, 0, captain.key, 'strip')).toBe('');
    seasons(c, 1);
    expect(noblesAt(c, tid).some((n) => n.rank === 'captain')).toBe(false);
  });

  it('nobody of the inner circle is dealt with, and each dealing is in the season\'s report by name', () => {
    const { c, lord } = world();
    const close = noblesOf(c, 0).find((n) => n.rank === 'close');
    if (close) expect(dealsFor(c, 0, close.key)).toEqual([]);
    dealWith(c, 0, lord.key, 'gift');
    expect((c.intrigueNews ?? []).some((n) => n.turn === c.turn && n.owner === 0 && n.text.includes(lord.name))).toBe(true);
  });

  it('each dealing says what it does, a post is new to the rank, and a gift says what it did', () => {
    const { c, tid, lord } = world();
    const captain = noblesAt(c, tid).find((n) => n.rank === 'captain')!;
    for (const k of DEAL_KINDS) expect(dealEffect(c, 0, lord, k).length).toBeGreaterThan(20);
    expect(dealEffect(c, 0, lord, 'gift')).toContain(`${DEALS.gift.mood}`);
    expect(TITLES.captain).not.toMatch(/^Captain/);
    expect(dealsFor(c, 0, captain.key).find((d) => d.kind === 'post')!.name).toBe(`Make ${TITLES.captain}`);
    dealWith(c, 0, lord.key, 'gift');
    expect(c.log[c.log.length - 1]).toMatch(new RegExp(`mood rises by ${DEALS.gift.mood}`));
  });
});
