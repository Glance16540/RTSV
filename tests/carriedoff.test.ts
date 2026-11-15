// A worldly or decadent rival that takes a town leads some of its people away (src/sim/carriedoff.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { CARRY, carriedAt, carriedLeft, carriedOf, carriedSeason, carriesOff, townFell } from '../src/sim/carriedoff';
import { folkOf, grown } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign in which a rival of the given standing has just taken a town of the player's, from a land of its own. */
const world = (virtue: number, seed = 5): { c: Campaign; town: number; hold: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10;
  const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
  c.factions[rival].virtue = virtue;
  const t = c.territories.find((x) => x.owner === 0)!, h = c.territories.find((x) => x.owner === rival)!;
  Object.assign(folkOf(c, t.id), { men: 10, women: 12, elders: 2, children: 5 }); delete folkOf(c, t.id).ages;
  Object.assign(folkOf(c, h.id), { men: 6, women: 6, elders: 0, children: 2 }); delete folkOf(c, h.id).ages;
  return { c, town: t.id, hold: h.id, rival };
};
const seasons = (c: Campaign, k: number): { born: number; taken: number } => { const sum = { born: 0, taken: 0 }; for (let i = 0; i < k; i++) { c.turn++; const r = carriedSeason(c); sum.born += r.born; sum.taken += r.taken; } return sum; };

describe('people carried off by a nation', () => {
  it('only a worldly or decadent rival does it, and never the player', () => {
    for (const [virtue, does] of [[90, false], [40, false], [0, false], [-40, true], [-90, true]] as [number, boolean][]) {
      const { c, town, hold, rival } = world(virtue);
      expect(carriesOff(c, rival)).toBe(does);
      expect(!!townFell(c, town, 0, rival, hold)).toBe(does);
    }
    const me = world(-90);
    me.c.factions[0].virtue = -90;
    expect(carriesOff(me.c, 0)).toBe(false);
    expect(townFell(me.c, me.hold, me.rival, 0, me.town)).toBeNull();
    const tribe = world(-90);
    expect(townFell(tribe.c, tribe.town, -1, tribe.rival, tribe.hold)).toBeNull(); // a nation's town only
  });
  it('takes grown people only, a share of them, to the land the army came from, and leaves the town standing', () => {
    const { c, town, hold, rival } = world(-90), f = folkOf(c, town);
    const x = townFell(c, town, 0, rival, hold)!;
    expect(x).toMatchObject({ by: rival, at: hold });
    expect(x.held).toMatchObject({ from: town, owner: 0, since: c.turn });
    expect(x.held.women.length).toBeGreaterThanOrEqual(3);
    expect(x.held.women.length).toBeLessThanOrEqual(4);
    expect(x.held.men.length).toBeLessThanOrEqual(2);
    expect(f.women).toBe(12 - x.held.women.length);
    expect(f.men).toBe(10 - x.held.men.length);
    expect(f.children).toBe(5); // no child is ever taken
    expect(f.ages!.k).toHaveLength(5);
    expect(c.log.at(-1)).toContain(c.territories[hold].name);
    expect(carriedLeft(c, x)).toBe(CARRY.seasons);
    const small = world(-90);
    Object.assign(folkOf(small.c, small.town), { men: 2, women: 2, elders: 0 }); delete folkOf(small.c, small.town).ages;
    expect(townFell(small.c, small.town, 0, small.rival, small.hold)).toBeNull(); // nobody to spare
    expect(JSON.parse(JSON.stringify(c.carried))).toEqual(c.carried);
  });
  it('they come home if the land they are held in is taken in time, the older for it', () => {
    const { c, town, hold, rival } = world(-90), f = folkOf(c, town);
    const x = townFell(c, town, 0, rival, hold)!, n = x.held.women.length + x.held.men.length, before = grown(f);
    seasons(c, 2);
    const youngest = Math.min(...x.held.women);
    townFell(c, hold, rival, 0, town); // the player takes the land where they are held
    expect(carriedOf(c, 0)).toHaveLength(0);
    expect(grown(f)).toBe(before + n);
    expect(Math.max(...f.ages!.f)).toBeGreaterThan(youngest); // older than when they went
    expect(c.log.at(-1)).toContain('going home');
    expect(seasons(c, 6).taken).toBe(0);
  });
  it('held long enough they are the taker\'s people, on the record of the town that holds them, and do not come home', () => {
    const { c, town, hold, rival } = world(-90), f = folkOf(c, town), there = folkOf(c, hold);
    const x = townFell(c, town, 0, rival, hold)!, n = x.held.women.length + x.held.men.length;
    const had = grown(there), left = grown(f);
    const r = seasons(c, CARRY.seasons);
    expect(r.taken).toBe(n);
    expect(grown(there)).toBe(had + n);
    expect(grown(f)).toBe(left);
    expect(carriedAt(c, hold)).toHaveLength(0);
    expect(c.chronicle!.at(-1)!.text).toContain('never got back');
    townFell(c, hold, rival, 0, town);
    expect(grown(f)).toBe(left); // too late
  });
  it('a child born to a woman held this way is the taker\'s own, and never comes home', () => {
    let born = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { c, town, hold, rival } = world(-90, seed), f = folkOf(c, town), there = folkOf(c, hold);
      townFell(c, town, 0, rival, hold);
      const r = seasons(c, CARRY.seasons - 1);
      expect(there.children).toBe(2 + r.born);
      born += r.born;
      townFell(c, hold, rival, 0, town);
      expect(f.children).toBe(5);
      expect(there.children).toBe(2 + r.born); // they stay where they were born
    }
    expect(born).toBeGreaterThan(5);
  });
  it('they go free if their keepers lose the land by any road', () => {
    const { c, town, hold, rival } = world(-90), f = folkOf(c, town);
    const x = townFell(c, town, 0, rival, hold)!, before = grown(f);
    c.territories[hold].owner = -1;
    seasons(c, 1);
    expect(c.carried).toHaveLength(0);
    expect(grown(f)).toBe(before + x.held.women.length + x.held.men.length);
  });
});
