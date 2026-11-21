// A rival king at war by a feud sends a raiding party against the leader's seat (src/sim/feudraid.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, finishBattle, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Mark } from '../src/sim/aftermath';
import { seasonWaits, threatsOfMen } from '../src/sim/bandseason';
import { FEUDRAID, feudRaidSeason, isParty, partyStrength, raidsDue, raiseParty, seatOf } from '../src/sim/feudraid';
import { offerRaid, raidUnits } from '../src/sim/raidfought';
import { THREATS } from '../src/sim/threatsbase';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign in which the first rival's king, defied, is at war with the player by a feud begun two seasons ago. */
const world = (seed = 5): { c: Campaign; m: Mark; seat: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 12; c.bands = []; c.phase = 'player'; c.pending = null; c.demand = null;
  const m = { id: 4, kind: 'feud', from: 'threat', story: 9, owner: 0, since: 10, until: 26, rival: 1, name: 'King Aron', text: 'King Aron was defied.', war: true } as unknown as Mark;
  c.marks = [m];
  const seat = seatOf(c)!;
  Object.assign(folkOf(c, seat), { men: 12 * S, women: 12 * S, elders: 0, children: 4 * S, stores: { food: 400, wood: 200, gold: 200, stone: 100 } }); delete folkOf(c, seat).ages;
  return { c, m, seat };
};

describe('when the king sends his party', () => {
  it('the seat is where the court sits, if that town is the player\'s; else the capital', () => {
    const { c, seat } = world();
    expect(c.territories[seat].owner).toBe(0);
    const cap = c.territories.find((t) => t.capital === 0)!.id;
    c.court = undefined as never;
    expect(seatOf(c)).toBe(cap);
  });
  it('only in a feud at war, a season in, not yet raided, with his people alive and armed', () => {
    const { c, m } = world();
    expect(raidsDue(c, true)).toEqual([m]);
    m.war = false; expect(raidsDue(c, true)).toEqual([]); m.war = true;
    m.since = c.turn; expect(raidsDue(c, true)).toEqual([]); m.since = 10;
    m.until = c.turn - 1; expect(raidsDue(c, true)).toEqual([]); m.until = 26;
    m.raided = 11; expect(raidsDue(c, true)).toEqual([]); delete m.raided;
    c.factions[1].alive = false; expect(raidsDue(c, true)).toEqual([]); c.factions[1].alive = true;
    const armies = c.armies; c.armies = armies.filter((a) => a.owner !== 1); expect(raidsDue(c, true)).toEqual([]); c.armies = armies;
    expect(raidsDue(c, true)).toEqual([m]);
  });
  it('by a chance of its own each season, about one season in four', () => {
    let came = 0;
    for (let seed = 1; seed <= 400; seed++) { const { c } = world(seed); came += raidsDue(c).length; }
    expect(came / 400).toBeGreaterThan(FEUDRAID.chance - 0.07);
    expect(came / 400).toBeLessThan(FEUDRAID.chance + 0.07);
  });
  it('the party is half his strongest army, never under the least nor over a band\'s most', () => {
    const { c } = world();
    c.armies = c.armies.filter((a) => a.owner !== 1);
    expect(partyStrength(c, 1)).toBe(0);
    c.armies.push({ id: 71, owner: 1, at: c.territories.find((t) => t.owner === 1)!.id, units: { infantry: 1 }, vet: 0, moved: false, hero: false } as Campaign['armies'][number]);
    expect(partyStrength(c, 1)).toBe(FEUDRAID.least);
    c.armies[c.armies.length - 1].units = { infantry: 60 };
    expect(partyStrength(c, 1)).toBe(THREATS.max);
  });
});

describe('the raid on the court', () => {
  it('struck with nobody asked: a strike on the seat by the strike\'s own rule, told and chronicled, and the party gone home', () => {
    const { c, m, seat } = world();
    const out: string[] = [];
    const raids = feudRaidSeason(c, out, { sure: true });
    expect(raids).toHaveLength(1);
    expect(raids[0]).toMatchObject({ at: seat, owner: 0, kind: 'raiders', name: `the raiders of the ${c.factions[1].name}`, turn: c.turn });
    expect(c.raids!.at(-1)).toBe(raids[0]);
    expect(m.raided).toBe(c.turn);
    expect(c.bands).toEqual([]); // no band is left on the map
    expect(c.log.some((l) => l.includes('has sent a raiding party against your court'))).toBe(true);
    expect(c.chronicle!.some((x) => x.text.includes('sent raiders against the court'))).toBe(true);
    expect(feudRaidSeason(c, [], { sure: true })).toEqual([]); // once a feud
  });
  it('it carries nobody off, however the town fares: a seat broken by the party is raided, never taken', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { c, seat } = world(seed);
      c.armies = c.armies.filter((a) => a.at !== seat);
      c.territories[seat].buildings = []; c.territories[seat].capital = -1;
      c.court = undefined as never;
      c.territories[seat].capital = 0;
      Object.assign(folkOf(c, seat), { men: 2 * S });
      c.armies.push({ id: 71, owner: 1, at: c.territories.find((t) => t.owner === 1)!.id, units: { infantry: 40 }, vet: 0, moved: false, hero: false } as Campaign['armies'][number]);
      const women = folkOf(c, seat).women, kids = folkOf(c, seat).children;
      const [raid] = feudRaidSeason(c, [], { sure: true });
      expect(raid.outcome).not.toBe('taken');
      expect(raid.taken).toEqual({ men: 0, women: 0 });
      expect(folkOf(c, seat).women).toBe(women);
      expect(folkOf(c, seat).children).toBe(kids);
      expect(c.territories[seat].owner).toBe(0);
    }
  });
  it('in the campaign\'s own turn it waits on the player, the season with it; left to the town it falls and the party goes home', () => {
    const { c, seat } = world();
    const m2 = raidsDue(c, true)[0];
    const b = raiseParty(c, m2);
    expect(isParty(b)).toBe(true);
    expect(offerRaid(c, b, seat, [])).toBe(true);
    expect(c.pending).toMatchObject({ raid: b.id, to: seat, defender: 0 });
    const cfg = battleConfig(c)!;
    expect(cfg.setups[1].name).toBe(`The raiders of the ${c.factions[1].name}`);
    expect(cfg.setups[1].bonus!.units).toEqual(raidUnits(b.strength));
    resolvePending(c, 'auto');
    expect(c.raids!.at(-1)).toMatchObject({ band: b.id, at: seat });
    threatsOfMen(c); // the season's next step sends it home
    expect(c.bands!.some(isParty)).toBe(false);
  });
  it('through the season\'s own call: it stops the season, and fought and won in person the seat held', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60 && !seen; seed++) {
      const { c, m, seat } = world(seed);
      threatsOfMen(c, { waits: true });
      if (m.raided === undefined) continue;
      seen++;
      expect(seasonWaits(c)).toBe(true);
      const id = c.pending!.raid!;
      expect(c.bands!.find((x) => x.id === id)!.party).toBe(1);
      expect(c.seasonHeld!.done).toContain(id);
      finishBattle(c, true, {}, { foes: {} });
      expect(c.raids!.at(-1)).toMatchObject({ band: id, at: seat, outcome: 'held' });
      threatsOfMen(c, { waits: true }); // taken up where it stopped
      expect(seasonWaits(c)).toBe(false);
      expect(c.bands!.some(isParty)).toBe(false);
      expect(c.raids!.filter((r) => r.band === id)).toHaveLength(1); // it struck once
    }
    expect(seen).toBe(1);
  });
});
