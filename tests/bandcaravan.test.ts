// A band falls on a caravan whose road crosses the land it stands on (src/sim/bandcaravan.ts, src/sim/caravans.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import type { Band, BandKind } from '../src/sim/threats';
import { caravansThrough, sendCaravans } from '../src/sim/caravans';
import { BANDCARAVAN, caravanSeason, waylays } from '../src/sim/bandcaravan';
import { folkOf } from '../src/sim/township';

/** A road of three lands of the player's, a - b - z, with nobody else about; a and z keep markets (as tests/caravans.test.ts). */
function road(seed = 5) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.bands = []; c.caravans = []; delete c.caravanTally;
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  let a!: Territory, b!: Territory, z!: Territory;
  for (const x of c.territories) for (const y of x.adj.map((id) => c.territories[id])) for (const w of y.adj.map((id) => c.territories[id]))
    if (!a && w.id !== x.id && !x.adj.includes(w.id) && x.capital < 0 && y.capital < 0 && w.capital < 0 && !x.rim && !y.rim && !w.rim) { a = x; b = y; z = w; }
  for (const t of [a, b, z]) {
    t.owner = 0; t.horde = false;
    const k = folkOf(c, t.id);
    k.men = 6; k.women = 6; k.elders = 1; k.children = 3; k.stores = { food: 500, wood: 500, gold: 500, stone: 500 }; delete k.ages;
    t.town = { at: t.id, b: [] };
  }
  a.capital = 0;
  for (const t of [a, z]) t.town!.b.push(['market', 20, 20]);
  return { c, a, b, z };
}
const band = (c: Campaign, at: number, kind: BandKind, strength = 5, id = 9): Band => {
  const b = { id, kind, name: 'the Red Hand', at, strength, since: 1, held: [] } as Band;
  (c.bands ??= []).push(b);
  return b;
};
/** Seasons of the bands' looking, until gold is taken or the tries run out: the caravans stay on the road meanwhile. */
function until(c: Campaign, tries = 40): number {
  for (let i = 0; i < tries; i++) { c.turn++; const took = caravanSeason(c); if (took) return took; }
  return 0;
}

describe('a band and a caravan on the road', () => {
  it('raiders, slavers and marauders fall on caravans this way; highwaymen and pirates meet them as they meet a convoy; a band still on its march in does not', () => {
    const b = (kind: BandKind, afar = false) => ({ id: 1, kind, name: 'x', at: 0, strength: 3, since: 0, held: [], ...(afar ? { afar: true } : {}) }) as Band;
    expect(waylays(b('raiders'))).toBe(true);
    expect(waylays(b('slavers'))).toBe(true);
    expect(waylays(b('marauders'))).toBe(true);
    expect(waylays(b('highwaymen'))).toBe(false);
    expect(waylays(b('pirates'))).toBe(false);
    expect(waylays(b('raiders', true))).toBe(false);
  });

  it('a camp on a land the road crosses takes its share of the gold, once, and grows on it', () => {
    const { c, a, b } = road();
    const [x] = sendCaravans(c).filter((y) => y.to === a.id || y.from === a.id);
    expect(caravansThrough(c, b.id)).toContain(x);
    const gold = x.cargo.gold, red = band(c, b.id, 'raiders');
    const took = until(c);
    expect(took).toBeGreaterThan(0);
    expect(x.cargo.gold).toBe(gold - took);
    expect(x.fallen).toBe(true);
    expect(red.strength).toBe(6);
    expect(c.caravanTally!.robbed).toBeGreaterThan(0);
    // It is fallen on once: no more is taken from it however long the band sits there.
    const left = x.cargo.gold;
    for (let i = 0; i < 20; i++) { c.turn++; caravanSeason(c); }
    expect(x.cargo.gold).toBe(left);
    // (The caravan coming the other way on the same road may be fallen on in its turn: one each, never one twice.)
    expect(red.strength).toBe(5 + caravansThrough(c, b.id).filter((y) => y.fallen).length);
  });

  it('it dares about half the time, by BANDCARAVAN.dare', () => {
    let fell = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { c, a, b } = road(5);
      c.seed = seed * 7919;
      const [x] = sendCaravans(c).filter((y) => y.to === a.id || y.from === a.id);
      band(c, b.id, 'slavers', 5, seed);
      caravanSeason(c);
      if (x.fallen) fell++;
    }
    expect(fell / 60).toBeGreaterThan(BANDCARAVAN.dare - 0.2);
    expect(fell / 60).toBeLessThan(BANDCARAVAN.dare + 0.2);
  });

  it('a band off the road takes nothing; one on the road is seen off by an army of the caravan\'s people as strong as it is', () => {
    const { c, a, b } = road();
    const [x] = sendCaravans(c).filter((y) => y.to === a.id || y.from === a.id);
    const off = c.territories.find((t) => !x.road.includes(t.id) && !t.rim)!;
    band(c, off.id, 'raiders');
    expect(until(c)).toBe(0);
    expect(x.fallen).toBeFalsy();
    const two = road();
    two.c.armies.push({ id: 77, owner: 0, at: two.b.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    const [y] = sendCaravans(two.c).filter((w) => w.to === two.a.id || w.from === two.a.id);
    const weak = band(two.c, two.b.id, 'marauders', 3), gold = y.cargo.gold;
    expect(until(two.c)).toBe(0);
    expect(y.cargo.gold).toBe(gold);
    expect(weak.strength).toBeLessThan(3); // seen off, and the weaker for the fight (roadclash.ts)
    expect(weak.strength).toBeGreaterThanOrEqual(1);
    expect(two.c.armies[0].units.infantry).toBeGreaterThanOrEqual(4); // the escort paid a company at the most for each of the two caravans it saw through
  });

  it('one band falls on one caravan a season: the richest whose road it stands on', () => {
    const { c, a, b } = road();
    const sent = sendCaravans(c);
    const here = caravansThrough(c, b.id);
    if (here.length < 2) { expect(sent.length).toBeGreaterThan(0); return; }
    here[0].cargo.gold = 10; here[1].cargo.gold = 400;
    band(c, b.id, 'raiders');
    void a;
    until(c, 60);
    expect(here[1].fallen).toBe(true);
    expect(here.filter((x) => x.fallen).length).toBe(1);
  });
});

describe('the news of a caravan robbed', () => {
  it('is in the season\'s news of the caravan\'s people, and of whoever holds the land, with the band, the place and the gold; nobody else hears', async () => {
    const { seasonNews } = await import('../src/sim/raidnews');
    const { c, a, b } = road();
    const [x] = sendCaravans(c).filter((y) => y.to === a.id || y.from === a.id);
    band(c, b.id, 'raiders');
    const logged = c.log.length;
    const took = until(c);
    expect(took).toBeGreaterThan(0);
    const mine = seasonNews(c).filter((n) => n.kind === 'robbed');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ at: b.id, band: 9, tone: 'bad' });
    expect(mine[0].headline).toContain('your caravan');
    expect(mine[0].headline).toContain(`${took} gold`);
    expect(mine[0].headline).toContain(c.territories[x.to].name);
    // The log has caravans.ts's own line and no second one from here.
    expect(c.log.slice(logged).filter((l) => l.includes('caravan')).length).toBe(1);
    const other = c.factions.find((f) => f.id > 0 && f.alive)!.id;
    expect(seasonNews(c, c.turn, other).filter((n) => n.kind === 'robbed')).toHaveLength(0);
    // Robbed in another people's land, that people hears of it too, in other words.
    const two = road();
    const [y] = sendCaravans(two.c).filter((w) => w.to === two.a.id || w.from === two.a.id);
    const rival = two.c.factions.find((f) => f.id > 0 && f.alive)!.id;
    two.b.owner = rival;
    band(two.c, two.b.id, 'slavers');
    if (until(two.c)) {
      expect(y.fallen).toBe(true);
      const theirs = seasonNews(two.c, two.c.turn, rival).filter((n) => n.kind === 'robbed');
      expect(theirs).toHaveLength(1);
      expect(theirs[0].headline).toContain('a caravan of the');
      expect(seasonNews(two.c).filter((n) => n.kind === 'robbed')).toHaveLength(1);
    }
  });
});
