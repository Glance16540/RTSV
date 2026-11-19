// A warning before a town's granary empties (src/sim/larderwatch.ts), and convoys walking their roads on the map
// (src/client/convoydraw.ts).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { sendConvoy } from '../src/sim/convoys';
import { harvest } from '../src/sim/harvest';
import { needOf } from '../src/sim/larder';
import { LARDER_WARN, emptyingText, emptyingTowns, foodComing, larderOutlook, noteReaped } from '../src/sim/larderwatch';
import { reportLines, reportSince, snapshot } from '../src/sim/seasonreport';
import { folkOf } from '../src/sim/township';
import { walk } from '../src/client/caravandraw';
import { convoyWalker, convoyWalkers } from '../src/client/convoydraw';

const base = JSON.stringify(newCampaign(5, 2));
/** The player's chief town and a town beside it, with `food` in store and the land last bringing in `reaped`. */
function town(food: number, reaped: number) {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = []; c.turn = 10;
  const seat = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => seat.adj.includes(x.id) && x.capital < 0)!;
  t.owner = 0;
  Object.assign(folkOf(c, t.id), { men: 8, women: 8, elders: 1, children: 3, stores: { food, wood: 300, gold: 300, stone: 300 } });
  delete folkOf(c, t.id).hungry;
  Object.assign(folkOf(c, seat.id), { stores: { food: 4000, wood: 900, gold: 900, stone: 900 } });
  noteReaped(c, t.id, reaped);
  return { c, seat, t };
}

describe('a warning before the granary empties', () => {
  it('reckons the seasons until a town cannot eat in full, from what it eats against what its land brought in', () => {
    const { c, t } = town(0, 0);
    const eats = needOf(c, t.id);
    expect(eats).toBeGreaterThan(0);
    const at = (food: number, reaped: number) => { const x = town(food, reaped); return larderOutlook(x.c, x.t.id).seasons; };
    expect(at(0, eats - 10)).toBe(1); // nothing laid by, and the harvest short: hungry at the next eating
    expect(at(eats * 3, 0)).toBe(4);
    expect(at(eats * 3, eats)).toBeNull(); // fed by its fields
    expect(at(50, eats * 2)).toBeNull();
  });

  it('warns of a town that will go hungry within a season or two, not of one fed or already hungry, and says so in words', () => {
    const near = town(0, 0);
    const warned = emptyingTowns(near.c, 0);
    expect(warned.map((x) => x.at)).toContain(near.t.id);
    const w = warned.find((x) => x.at === near.t.id)!;
    expect(w.seasons).toBeLessThanOrEqual(LARDER_WARN.seasons);
    expect(emptyingText(w)).toContain(near.t.name);
    expect(emptyingText(w)).toContain('next season');
    const far = town(needOf(near.c, near.t.id) * 5, 0);
    expect(emptyingTowns(far.c, 0).map((x) => x.at)).not.toContain(far.t.id);
    const hungry = town(0, 0);
    folkOf(hungry.c, hungry.t.id).hungry = 1;
    expect(emptyingTowns(hungry.c, 0).map((x) => x.at)).not.toContain(hungry.t.id); // the larder tells of it already
  });

  it('counts food on the road to the town as come in', () => {
    const { c, seat, t } = town(0, 0);
    const before = larderOutlook(c, t.id).seasons!;
    expect(sendConvoy(c, 0, seat.id, t.id, { food: needOf(c, t.id) * 4 })).not.toBeNull();
    expect(foodComing(c, t.id)).toBe(needOf(c, t.id) * 4);
    expect(larderOutlook(c, t.id).seasons!).toBeGreaterThan(before + 2);
  });

  it('the harvest notes what it brought in, town by town, this season', () => {
    const { c, t } = town(0, 0);
    c.turn++;
    harvest(c, () => 10, () => 0);
    const r = folkOf(c, t.id).reaped!;
    expect(r.turn).toBe(c.turn);
    expect(r.food).toBeGreaterThan(0);
    noteReaped(c, t.id, 5);
    expect(folkOf(c, t.id).reaped!.food).toBe(r.food + 5); // more the same season adds to it
  });

  it('the season\'s card carries the warning', () => {
    const { c, t } = town(0, 0);
    const lines = reportLines(reportSince(c, snapshot(c, 0), 0));
    expect(lines.some((l) => l.kind === 'food' && l.tone === 'bad' && l.text.includes(t.name))).toBe(true);
  });
});

describe('convoys on the map', () => {
  it('each convoy on the road walks it one way, from the town it left towards the town it is bound for', () => {
    const { c, seat, t } = town(0, 0);
    const x = sendConvoy(c, 0, seat.id, t.id, { food: 100 })!;
    expect(convoyWalkers(c)).toHaveLength(1);
    const w = convoyWalker(c, x);
    expect(w.one).toBe(true);
    w.pts = [[0, 0], [10, 0]]; w.ph = 0;
    const flat = (px: number, py: number): [number, number, number] => [px, 0, py];
    walk(w, 30, flat, 40); // three quarters of the lap: three quarters of the way, not on the way back
    expect(w.g.position.x).toBeCloseTo(7.5, 5);
    walk(w, 10, flat, 40);
    expect(w.g.position.x).toBeCloseTo(2.5, 5);
    expect(w.g).toBeInstanceOf(THREE.Group);
  });
});
