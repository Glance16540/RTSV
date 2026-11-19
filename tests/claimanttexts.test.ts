// What the claimant stories say, as the player reads them (wifetaken.ts, roll.ts; the browser pass of 19 November 2026).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import '../src/sim/wifetaken';
import { beginPlot } from '../src/sim/courtstory';
import { kinOf } from '../src/sim/kin';
import { noblesOf } from '../src/sim/nobles';
import { mayTake, takeWife } from '../src/sim/wifetaken';
import { rollOf } from '../src/sim/roll';
import { folkOf } from '../src/sim/township';

/** A plot over faith by the lord (or lady) of a worldly town under a devout people, the leader with a wife. */
function plot(female: boolean) {
  const c: Campaign = newCampaign(5, 2);
  c.turn = 20; c.phase = 'player';
  const cap = c.territories.find((x) => x.capital === 0)!;
  const ring = c.territories.filter((t) => t !== cap && !t.horde && t.capital < 0 && !t.rim).slice(0, 3);
  for (const t of ring) { t.owner = 0; delete t.free; }
  for (const t of [cap, ...ring]) { t.virtue = 50; Object.assign(folkOf(c, t.id), { men: 12, women: 12, elders: 2, children: 6 }); }
  ring[0].virtue = -50;
  const k = kinOf(c, 0);
  k.spouse = { name: 'Maren', female: true, born: c.turn - 100, of: k.leader };
  k.circle = [];
  c.factions[0].heroAlive = true;
  c.factions[0].nobles = [ring[0], ring[1], ring[2], cap].map((t, i) => ({ key: `lord:${t.id}:0`, name: ['Aldric', 'Bram', 'Cyra', 'Dunn'][i], female: i === 0 ? female : i === 2, town: t.id, rank: 'lord' as const, leaning: 'martial' as const, mood: 0 }));
  const lord = noblesOf(c, 0)[0];
  lord.mood = -80;
  return { c, it: beginPlot(c, lord.key)! };
}

describe('the claimant stories as read', () => {
  it('a lady who holds a town may plot over faith, but takes no wife into her house', () => {
    const lady = plot(true);
    expect(lady.it.faith).toBe(true);
    expect(mayTake(lady.c, lady.it)).toBe(false);
    expect(takeWife(lady.c, lady.it)).toBe(false);
    const lord = plot(false);
    expect(mayTake(lord.c, lord.it)).toBe(true);
  });
  it('the roll names the lord who holds the wife', () => {
    const { c, it } = plot(false);
    expect(takeWife(c, it)).toBe(true);
    expect(rollOf(c, 0).spouse?.lost).toMatchObject({ house: it.wife!.key, by: it.nobles![it.culprit].title });
  });
});
