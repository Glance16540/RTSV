// A raid fought out a round at a time (src/sim/raidclash.ts), stage one: the fight itself, not yet used by a strike.
import { describe, expect, it } from 'vitest';
import { RAID, raidClash, raidForces, raidForeseen } from '../src/sim/raidclash';
import type { TownStand } from '../src/sim/raidclash';

const stand = (over: Partial<TownStand> = {}): TownStand => { const s = { men: 1, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 0, ...over }; return { ...s, total: over.total ?? (s.men + s.works + s.walls + s.army + s.guard) * s.spirit }; };

describe('the two sides of a raid', () => {
  it('a band is companies on foot and with bows, worth its force of the day; a town is its works, with its army\'s companies behind them', () => {
    const { a, d } = raidForces(6, 5.4, stand({ men: 2, works: 3, army: 3 }), { infantry: 2, archers: 1 });
    expect(a.units).toEqual({ infantry: 4, archers: 2 });
    expect(a.weight).toBeCloseTo(5.4 * RAID.press);
    expect(d.units).toEqual({ infantry: 2, archers: 1 });
    expect(d.weight).toBe(8);
    expect(d.own).toBeCloseTo(3); // the army's three of the eight
    expect(d.walled).toBe(true);
    // A town with nobody but its own people has no companies: it is all works.
    const bare = raidForces(1, 1, stand({ men: 2 })).d;
    expect(bare.units).toEqual({});
    expect(bare.own).toBe(0);
    expect(bare.walled).toBe(false);
    expect(raidForces(1, 1, stand()).a.units).toEqual({ infantry: 1 }); // a band of one is one company, on foot
  });
});

describe('a raid fought out', () => {
  it('a strong town holds and the band is the weaker for it; a weak one is broken into; one that costs the band little is taken', () => {
    const held = raidClash(4, 4, stand({ men: 2, works: 4, army: 4 }), { infantry: 4 });
    expect(held.outcome).toBe('held');
    expect(held.bandLost).toBeGreaterThanOrEqual(1);
    expect(held.rounds).toBeGreaterThan(0);
    const taken = raidClash(10, 10, stand({ men: 1 }));
    expect(taken.outcome).toBe('taken');
    expect(taken.broke).toBe('defender');
    expect(taken.garrisonLost).toEqual({});
    // Between the two there are raids: the town breaks, but the band had to fight for it.
    const seen = new Set<string>();
    for (let f = 1; f <= 24; f += 0.25) seen.add(raidClash(f, f, stand({ men: 2, works: 3 })).outcome);
    expect([...seen].sort()).toEqual(['held', 'raided', 'taken']);
  });

  it('the stronger the band against the same town, the worse it goes for the town, never the better', () => {
    const rank = { held: 0, raided: 1, taken: 2 };
    let worst = 0;
    for (let f = 1; f <= 40; f += 0.5) {
      const o = rank[raidClash(f, f, stand({ men: 3, works: 3, walls: 1 })).outcome];
      expect(o).toBeGreaterThanOrEqual(worst);
      worst = o;
    }
    expect(worst).toBe(2);
  });

  it('a garrison pressed loses companies, and the day\'s luck can turn a near thing', () => {
    const pressed = raidClash(9, 9, stand({ men: 1, army: 4 }), { infantry: 4 });
    expect(pressed.outcome).not.toBe('held');
    expect(Object.values(pressed.garrisonLost).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
    const s = stand({ men: 2, works: 3 });
    let turn = 0;
    for (let f = 2; f <= 10; f += 0.25) if (raidClash(f, f, s, {}, 0, 1, 0).outcome !== raidClash(f, f, s, {}, 0, 0, 1).outcome) turn++;
    expect(turn).toBeGreaterThan(0);
  });

  it('a pious town stands longer than a decadent one under the same band', () => {
    const rank = { held: 0, raided: 1, taken: 2 };
    let holy = 0, fallen = 0;
    for (let f = 2; f <= 12; f += 0.25) { holy += rank[raidClash(f, f, stand({ men: 3, works: 3 }), {}, 100).outcome]; fallen += rank[raidClash(f, f, stand({ men: 3, works: 3 }), {}, -100).outcome]; }
    expect(holy).toBeLessThanOrEqual(fallen);
  });

  it('a strike on record is foreseen from its own figures', () => {
    const r = { force: 6, defence: stand({ men: 2, works: 3, army: 2 }) };
    const f = raidForeseen(r);
    expect(['held', 'raided', 'taken']).toContain(f.outcome);
    expect(f).toEqual(raidClash(6, 6, r.defence, { infantry: 2 }));
  });
});

// Stage two: a strike on a town is decided by the fight (threats.ts `strike`).
import { bareCampaign } from './helpers';
import { strike } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { reportText } from '../src/sim/threats';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';

describe('a strike on a town is fought out', () => {
  /** One town of the player's set apart, plain, with so many men (as towns were); a band of raiders beside it. */
  function world(men: number, strength: number, seed = 11) {
    const c = bareCampaign(seed, 2);
    c.fronts = [];
    const t = c.territories.find((x) => x.owner === 0)!;
    for (const id of t.adj) c.territories[id].owner = -1;
    c.armies = c.armies.filter((a) => a.at !== t.id);
    t.buildings = []; delete t.town;
    Object.assign(folkOf(c, t.id), { men: men * S, women: 6 * S, elders: 0, children: 2 * S });
    delete folkOf(c, t.id).ages;
    const b: Band = { id: 950, kind: 'raiders', name: 'the Test Men', at: t.id, strength, since: c.turn, held: [] };
    c.bands = [b];
    return { c, t, b };
  }

  it('its report says how the fight went: the rounds, and who broke', () => {
    const { c, t, b } = world(1, 12);
    const r = strike(c, b, t.id, []);
    expect(r.outcome).not.toBe('held');
    expect(r.broke).toBe('defender');
    expect(r.rounds).toBeGreaterThan(0);
    expect(reportText(c, r).join(' ')).toContain('the town\'s defence broke');
    const strong = world(20, 2);
    strong.t.buildings = ['fortress'];
    const h = strike(strong.c, strong.b, strong.t.id, []);
    expect(h.outcome).toBe('held');
    expect(h.broke).toBe('attacker');
    expect(strong.b.strength).toBeLessThan(2); // the weaker for it
    expect(reportText(strong.c, h).join(' ')).toContain('the band broke');
  });

  it('an army standing in a raided town loses companies when it is pressed, never its last, and none when the band is seen off easily', () => {
    const { c, t, b } = world(1, 14);
    c.armies.push({ id: 801, owner: 0, at: t.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
    const r = strike(c, b, t.id, []);
    const left = c.armies.find((a) => a.id === 801)!;
    expect(left).toBeDefined(); // it is never wiped out by a raid: it falls back inside
    expect(left.units.infantry).toBeGreaterThanOrEqual(1);
    expect(r.garrison).toBe(4 - left.units.infantry);
    expect(r.garrison).toBeGreaterThan(0);
    expect(reportText(c, r).join(' ')).toContain('The army there lost');
    // A strong garrison against a small band: it holds, and loses nobody.
    const easy = world(6, 1);
    easy.c.armies.push({ id: 802, owner: 0, at: easy.t.id, units: { infantry: 8 }, hero: false, vet: 0, moved: false });
    const h = strike(easy.c, easy.b, easy.t.id, []);
    expect(h.outcome).toBe('held');
    expect(h.garrison).toBeUndefined();
    expect(easy.c.armies.find((a) => a.id === 802)!.units.infantry).toBe(8);
  });

  it('a strike on a road is still an escort or nothing: no fight, no rounds', () => {
    const { c, t, b } = world(6, 6);
    const far = c.territories[t.adj[0]];
    far.owner = 0;
    b.kind = 'highwaymen'; b.to = far.id;
    for (const id of [t.id, far.id]) folkOf(c, id).stores.food = 2000;
    const r = strike(c, b, t.id, []);
    expect(r.rounds).toBeUndefined();
    expect(r.broke).toBeUndefined();
    expect(r.outcome).toBe('raided');
  });
});

describe('stage three, report only: the town turned out as bands (raidclash.ts turnedOut)', () => {
  it('the town\'s men are companies on foot beside its army, and only its works, walls and guard are the place', async () => {
    const { raidForces } = await import('../src/sim/raidclash');
    const stand = { men: 2, works: 3, walls: 1, army: 4, guard: 1, spirit: 1, total: 11 };
    const now = raidForces(5, 5, stand, { infantry: 4 }).d, out = raidForces(5, 5, stand, { infantry: 4 }, 0, { bands: 2.4, worth: 1.2 }).d;
    expect(now.units).toEqual({ infantry: 4 });
    expect(out.units).toEqual({ infantry: 6 }); // two bands of its own men beside the four companies
    expect(now.weight).toBe(11);
    expect(out.weight).toBeCloseTo(3 + 1 + 1 + 4 + 1.2, 5); // the sum's men put aside for what the bands are worth
    expect(out.own).toBeCloseTo(4 + 1.2, 5); // the army and the bands; the rest is the place
    expect(out.walled).toBe(true);
    // No man in the town: no band, and nothing of its own but the army.
    const none = raidForces(5, 5, { ...stand, men: 0, total: 9 }, {}, 0, { bands: 0, worth: 0 }).d;
    expect(none.units).toEqual({});
    // The town's spirit (the sum's total over its parts) is kept on everything.
    const low = raidForces(5, 5, { ...stand, spirit: 0.5, total: 5.5 }, {}, 0, { bands: 1, worth: 1 }).d;
    expect(low.weight).toBeCloseTo((3 + 1 + 1 + 4 + 1) * 0.5, 5);
  });

  it('a strike is decided by the turned-out fight, and still records what the old fight would have made of it', async () => {
    const { newCampaign } = await import('../src/sim/campaign');
    const { strike, townMilitia, defenceOf, bandsFell } = await import('../src/sim/threats');
    const { folkOf } = await import('../src/sim/township');
    const { raidClash, RAID } = await import('../src/sim/raidclash');
    const { faithAt } = await import('../src/sim/townfaith');
    let differed = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const c = newCampaign(seed, 2), home = c.territories.find((t) => t.capital === 0)!;
      const f = folkOf(c, home.id), men = f.men;
      c.armies = c.armies.filter((a) => a.at !== home.id);
      const stand = defenceOf(c, home.id), m = townMilitia(c, home.id, stand), virtue = faithAt(c, home.id);
      expect(m.worth).toBeGreaterThan(0);
      const band = { id: 900, kind: 'raiders' as const, name: 'the test band', at: home.adj[0], strength: 3 + (seed % 7), since: 0, held: [] };
      (c.bands ??= []).push(band);
      const r = strike(c, band, home.id, []);
      const now = raidClash(r.strength!, r.force, stand, {}, virtue, 0.5, 0.5, m), old = raidClash(r.strength!, r.force, stand, {}, virtue);
      expect(r.outcome === now.outcome || (now.outcome === 'taken' && r.outcome === 'raided')).toBe(true); // raided only where nobody could be carried off
      expect(r.rounds).toBe(now.rounds);
      expect(r.would).toBe(old.outcome);
      if (old.outcome !== now.outcome) differed++;
      // The dead are what its bands lost, at a raid's share: never more, and never the town's last men.
      expect(r.killed).toBeLessThanOrEqual(bandsFell(c, home.id, 1, RAID.dead) + 1);
      expect(f.men).toBe(men - r.killed - r.taken.men);
    }
    expect(differed).toBeGreaterThan(0);
  });
});

describe('what a band comes away with follows the fight (raidclash.ts spoilsOf)', () => {
  it('the whole day where the town broke at the first rush, less for every round it stood; and the hands the band has left', async () => {
    const { spoilsOf, RAID } = await import('../src/sim/raidclash');
    const { CLASH } = await import('../src/sim/mapbattle');
    expect(spoilsOf({ rounds: 1, cost: 0 })).toEqual({ time: 1, hands: 1 });
    expect(spoilsOf({ rounds: 0, cost: 0 }).time).toBe(1);
    expect(spoilsOf({ rounds: 3, cost: 0.2 }).time).toBeCloseTo(1 - 2 / CLASH.rounds, 6);
    expect(spoilsOf({ rounds: 3, cost: 0.2 }).hands).toBeCloseTo(0.8, 6);
    expect(spoilsOf({ rounds: CLASH.rounds, cost: 2 })).toEqual({ time: 1 / CLASH.rounds, hands: 0 });
    for (let r = 1; r < CLASH.rounds; r++) expect(spoilsOf({ rounds: r + 1, cost: 0 }).time).toBeLessThan(spoilsOf({ rounds: r, cost: 0 }).time);
    expect(RAID.loot).toBeGreaterThan(0.2);
    expect(RAID.loot).toBeLessThan(0.5);
  });

  it('a town that stands longer before it breaks loses less of its stores to the same band, and never more than the band\'s hands can carry', async () => {
    const { newCampaign } = await import('../src/sim/campaign');
    const { strike } = await import('../src/sim/threats');
    const { THREATS } = await import('../src/sim/threatsbase');
    const { RAID, spoilsOf } = await import('../src/sim/raidclash');
    const { folkOf } = await import('../src/sim/township');
    const seen: { rounds: number; share: number }[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCampaign(seed, 2), home = c.territories.find((t) => t.capital === 0)!;
      c.armies = c.armies.filter((a) => a.at !== home.id);
      const f = folkOf(c, home.id);
      f.stores = { food: 0, wood: 4000, gold: 4000, stone: 4000 }; // no food, so the larder's rule is out of it
      const had = 12000;
      const band = { id: 900, kind: 'raiders' as const, name: 'the test band', at: home.adj[0], strength: 2 + (seed % 9), since: 0, held: [] };
      (c.bands ??= []).push(band);
      const r = strike(c, band, home.id, []);
      if (r.outcome === 'held') continue;
      const took = r.stores.wood + r.stores.gold + r.stores.stone, s = spoilsOf({ rounds: r.rounds!, cost: 0 });
      expect(took).toBeLessThanOrEqual(Math.ceil(had * RAID.loot * s.time));
      expect(took).toBeLessThanOrEqual(r.force * THREATS.carry.raiders);
      seen.push({ rounds: r.rounds!, share: took / had });
    }
    const quick = seen.filter((x) => x.rounds <= 1), slow = seen.filter((x) => x.rounds >= 3);
    expect(seen.length).toBeGreaterThan(10);
    // The bound itself falls with the rounds, whatever a band of a given size can carry.
    if (quick.length && slow.length) expect(Math.max(...slow.map((x) => x.share))).toBeLessThanOrEqual(RAID.loot * (1 - 2 / 8) + 1e-9);
  });
});
