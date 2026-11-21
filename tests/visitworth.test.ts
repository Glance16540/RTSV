// A visit brings home a season's worth (src/sim/visitworth.ts, the owner's word of 21 November 2026).
import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, continueAI, endTurn, landIncome, newCampaign, resolvePending } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { VISIT_SECONDS, beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { STORE_KINDS, folkOf } from '../src/sim/township';
import type { Census, Stores } from '../src/sim/township';
import { carriedLastSeason, seasonWorth, visitStands, weighCarried } from '../src/sim/visitworth';
import { SUPPLY_UNITS } from '../src/sim/stores';
import { lastGain, turnLeft, turnOpened } from '../src/sim/seasongain';
import { run } from './helpers';

const sum = (s: Stores): number => STORE_KINDS.reduce((n, k) => n + s[k], 0);
const world = (): { c: Campaign; tid: number } => { const c = newCampaign(7, 1, 1, 'hearth'); return { c, tid: c.territories.find((t) => t.capital === 0)!.id }; };
const enter = (c: Campaign, tid: number): Game => {
  expect(beginVisit(c, tid)).toBe(true);
  const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
};
const turn = (c: Campaign): void => { endTurn(c); for (let i = 0; i < 40 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); } };
const worthOf = (c: Campaign, tid: number): number => seasonWorth(c, tid, landIncome(c, 0, c.territories[tid]));
const census = (stores: Stores): Census => ({ men: 10, women: 10, elders: 0, children: 0, stores });

describe('what a visit gathered, weighed to the season', () => {
  it('a town makes in a season what its land yields it on the map, in goods', () => {
    const { c, tid } = world();
    expect(worthOf(c, tid)).toBeGreaterThan(0);
    expect(worthOf(c, tid) % 1).toBe(0);
  });

  it('more than a season is brought down to the season, each kind in its own share', () => {
    const { c, tid } = world();
    const worth = worthOf(c, tid), had: Stores = { food: 500, wood: 500, gold: 500, stone: 500 };
    const cs = census({ food: 500 + worth * 6, wood: 500 + worth * 3, gold: 500 + worth, stone: 500 });
    expect(weighCarried(c, tid, had, cs, { share: 1, supplies: landIncome(c, 0, c.territories[tid]) })).toBe(worth);
    const got = { food: cs.stores.food - 500, wood: cs.stores.wood - 500, gold: cs.stores.gold - 500, stone: cs.stores.stone - 500 };
    expect(sum(got)).toBe(worth);
    expect(got.food).toBeGreaterThan(got.wood);
    expect(got.wood).toBeGreaterThan(got.gold);
    expect(got.stone).toBe(0);
  });

  it('a shorter visit brings its share of the season', () => {
    const { c, tid } = world();
    const worth = worthOf(c, tid), had: Stores = { food: 500, wood: 500, gold: 500, stone: 500 };
    const cs = census({ food: 500 + worth * 10, wood: 500, gold: 500, stone: 500 });
    expect(weighCarried(c, tid, had, cs, { share: 0.5, supplies: landIncome(c, 0, c.territories[tid]) })).toBe(Math.round(worth / 2));
    expect(cs.stores.food).toBe(500 + Math.round(worth / 2));
  });

  it('less than the season is carried whole, and what was spent there stays spent', () => {
    const { c, tid } = world();
    const worth = worthOf(c, tid), had: Stores = { food: 500, wood: 500, gold: 500, stone: 500 };
    const cs = census({ food: 500 + Math.floor(worth / 4), wood: 200, gold: 500, stone: 450 });
    expect(weighCarried(c, tid, had, cs, { share: 1, supplies: landIncome(c, 0, c.territories[tid]) })).toBe(Math.floor(worth / 4));
    expect(cs.stores).toEqual({ food: 500 + Math.floor(worth / 4), wood: 200, gold: 500, stone: 450 });
  });
});

describe('a visit played', () => {
  it('a full visit of the town at work brings home its season, where its people gathered many', () => {
    const { c, tid } = world();
    const had = { ...folkOf(c, tid).stores }, worth = worthOf(c, tid);
    const g = enter(c, tid);
    run(g, 120); // two minutes at the field's rate is already more than the season
    const folk = g.census(0);
    const gathered = STORE_KINDS.reduce((n, k) => n + Math.max(0, folk.stores[k] - had[k]), 0);
    expect(gathered).toBeGreaterThan(worth);
    finishVisit(c, { town: g.standing(0), orders: g.orders(0), folk, seconds: VISIT_SECONDS });
    const now = folkOf(c, tid).stores;
    expect(STORE_KINDS.reduce((n, k) => n + Math.max(0, now[k] - had[k]), 0)).toBe(worth);
  });

  it('a visit of half the time brings half the season', () => {
    const { c, tid } = world();
    const had = { ...folkOf(c, tid).stores }, worth = worthOf(c, tid);
    const g = enter(c, tid);
    run(g, 120);
    finishVisit(c, { town: g.standing(0), orders: g.orders(0), folk: g.census(0), seconds: VISIT_SECONDS / 2 });
    const now = folkOf(c, tid).stores;
    expect(STORE_KINDS.reduce((n, k) => n + Math.max(0, now[k] - had[k]), 0)).toBe(Math.round(worth / 2));
  });

  it('stands in place of the town\'s season: it brings in nothing more as the season turns, and the bar counts the visit', () => {
    const { c, tid } = world();
    const other = c.territories.find((t) => t.owner === 0 && t.id !== tid);
    const g = enter(c, tid);
    run(g, 120);
    finishVisit(c, { town: g.standing(0), orders: g.orders(0), folk: g.census(0), seconds: VISIT_SECONDS });
    const carried = carriedLastSeason({ ...c, turn: c.turn + 1 } as Campaign);
    expect(carried).toBe(worthOf(c, tid));
    turn(c);
    expect(visitStands(c, 0, tid)).toBe(true);
    if (other) expect(visitStands(c, 0, other.id)).toBe(false);
    expect(visitStands(c, 1, tid)).toBe(false);
    turn(c);
    expect(visitStands(c, 0, tid)).toBe(false); // the season after that is the town's own again
  });

  it('the bar\'s season gain counts what the visit carried, it having come in before the turn was ended', () => {
    const { c, tid } = world();
    c.visitCarry = [{ at: tid, turn: c.turn, goods: 640 }];
    turnLeft(c);
    c.turn++; // the season turns with nothing else gained or spent
    turnOpened(c);
    expect(lastGain(c)).toBe(Math.floor(640 / SUPPLY_UNITS));
  });

});
