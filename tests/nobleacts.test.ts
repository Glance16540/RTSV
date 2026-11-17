// Nobles who act (src/sim/nobleacts.ts): a content lord helps in need, an angry one withholds or joins a plot.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { NOBLES, noblesAt, noblesOf, noblesSeason } from '../src/sim/nobles';
import type { Noble } from '../src/sim/nobles';
import { ACTS, nobleActsSeason, sendMen } from '../src/sim/nobleacts';
import { beginPlot } from '../src/sim/courtstory';
import { TOWN_SCALE, folkOf } from '../src/sim/township';
import { agesOf } from '../src/sim/ageing';

const world = (): { c: Campaign; tid: number; other: number; lord: Noble } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const f = folkOf(c, tid); f.men = 10 * TOWN_SCALE; f.women = 8 * TOWN_SCALE; f.elders = 0; delete f.ages; // the lord's town, with men to spare at either town size
  const near = c.territories[c.territories[tid].adj[0]];
  near.owner = 0; delete near.horde;
  const g = folkOf(c, near.id); g.men = 2; g.women = 4; g.elders = 0; delete g.ages;
  delete c.factions[0].nobles; noblesSeason(c, 0);
  return { c, tid, other: near.id, lord: noblesAt(c, tid).find((n) => n.rank === 'lord')! };
};
const raid = (c: Campaign, at: number): void => { (c.events ??= []).push({ kind: 'raid', at, turn: c.turn, until: c.turn } as never); };

describe('nobles who act', () => {
  it('a content lord sends young men, with their ages, to a struck town short of men; not again within the year', () => {
    const { c, tid, other, lord } = world();
    lord.mood = ACTS.content;
    raid(c, other);
    nobleActsSeason(c, 0);
    expect(folkOf(c, other).men).toBe(2 + ACTS.men);
    expect(folkOf(c, tid).men).toBe(10 * TOWN_SCALE - ACTS.men);
    expect(agesOf(c, other, folkOf(c, other)).m).toHaveLength(2 + ACTS.men);
    expect(c.log.some((l) => l.includes(lord.name) && l.includes('young men'))).toBe(true);
    nobleActsSeason(c, 0);
    expect(folkOf(c, other).men).toBe(2 + ACTS.men); // once in ACTS.every seasons
  });

  it('never sends below what his own town keeps, and an unhappy lord sends nothing', () => {
    const { c, tid, other, lord } = world();
    raid(c, other);
    lord.mood = 0;
    nobleActsSeason(c, 0);
    expect(folkOf(c, other).men).toBe(2);
    lord.mood = ACTS.content;
    folkOf(c, tid).men = ACTS.keepMen + 1; delete folkOf(c, tid).ages;
    nobleActsSeason(c, 0);
    expect(folkOf(c, tid).men).toBe(ACTS.keepMen + 1);
  });

  it('sending men moves only grown men, the youngest, never a child', () => {
    const { c, tid, other } = world();
    const kids = folkOf(c, tid).children;
    const a = agesOf(c, tid, folkOf(c, tid)), youngest = Math.min(...a.m);
    expect(sendMen(c, tid, other, 1)).toBe(1);
    expect(agesOf(c, other, folkOf(c, other)).m).toContain(youngest);
    expect(folkOf(c, tid).children).toBe(kids);
  });

  it('an angry lord withholds gold from his town, told once as it begins', () => {
    const { c, tid, lord } = world();
    lord.mood = NOBLES.angry - 5;
    folkOf(c, tid).stores.gold = 500;
    nobleActsSeason(c, 0);
    expect(folkOf(c, tid).stores.gold).toBe(500 - ACTS.withhold);
    c.turn++;
    nobleActsSeason(c, 0);
    expect(folkOf(c, tid).stores.gold).toBe(500 - 2 * ACTS.withhold);
    expect(c.log.filter((l) => l.includes('withholds')).length).toBe(1);
  });

  it('angry nobles join a plot afoot, and bring its rising nearer', () => {
    const { c, tid, lord } = world();
    for (const n of noblesOf(c, 0)) n.mood = NOBLES.angry - 5;
    const it = beginPlot(c, lord.key);
    expect(it).toBeTruthy();
    if (!it) return;
    const due = it.due!, others = noblesOf(c, 0).filter((n) => n.key !== lord.key).length;
    nobleActsSeason(c, 0);
    expect(it.due).toBe(Math.max(c.turn + 1, due - others));
    nobleActsSeason(c, 0);
    expect(it.due).toBe(Math.max(c.turn + 1, due - others)); // each joins once
    expect(folkOf(c, tid).men).toBeGreaterThan(0);
  });
});
