// Caravans on the roads (src/sim/caravans.ts, docs/DESIGN.md "Caravans on the roads").
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import type { Band } from '../src/sim/threats';
import { CARAVANS, caravanWorth, caravansHome, caravansSeason, caravansThrough, fallOnCaravan, governMarkets, partnerOf, sendCaravans } from '../src/sim/caravans';
import { begunAt } from '../src/sim/townworks';
import { folkOf } from '../src/sim/township';

/** A road of three lands of the player's, a - b - z, with nothing else of theirs and nobody about; a and z keep markets. */
function road(seed = 5, markets = true) {
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
  if (markets) for (const t of [a, z]) t.town!.b.push(['market', 20, 20]);
  return { c, a, b, z };
}
const next = (c: Campaign) => { c.turn++; };

describe('a market\'s partner', () => {
  it('is the nearest other market town by road, its own people\'s; none where there is none', () => {
    const { c, a, b, z } = road();
    expect(partnerOf(c, a.id)).toEqual({ at: z.id, road: [a.id, b.id, z.id] });
    expect(partnerOf(c, z.id)!.at).toBe(a.id);
    expect(partnerOf(c, b.id)).toBeNull(); // no market of its own
    z.town!.b = [];
    expect(partnerOf(c, a.id)).toBeNull();
  });

  it('a road never runs through a people it is not at peace with; through one at truce it may, and trade abroad', () => {
    const { c, a, b, z } = road();
    const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
    b.owner = rival; c.truces = []; c.ally = -1;
    const p = partnerOf(c, a.id);
    expect(p === null || !p.road.includes(b.id)).toBe(true);
    c.truces = [{ with: rival, until: c.turn + 10 }];
    z.owner = rival;
    const q = partnerOf(c, a.id)!;
    expect(q.at).toBe(z.id);
    expect(caravanWorth(c, a.id, z.id, q.road)).toBeGreaterThan(caravanWorth(c, a.id, a.id, q.road)); // more from a partner abroad
  });

  it('is no farther than CARAVANS.reach lands', () => {
    const { c, a } = road();
    const was = CARAVANS.reach;
    try { CARAVANS.reach = 1; expect(partnerOf(c, a.id)).toBeNull(); } finally { CARAVANS.reach = was; }
  });
});

describe('caravans', () => {
  it('a market town sends one a season, takes nothing from its stores for it, and it comes home the season after with gold', () => {
    const { c, a, b, z } = road();
    const gold = folkOf(c, a.id).stores.gold;
    const sent = sendCaravans(c);
    expect(sent.map((x) => x.to).sort()).toEqual([a.id, z.id].sort());
    expect(folkOf(c, a.id).stores.gold).toBe(gold);
    expect(sendCaravans(c)).toEqual([]); // not a second while one is on the road
    expect(caravansThrough(c, b.id)).toHaveLength(2);
    const x = sent.find((y) => y.to === a.id)!;
    expect(x.cargo.gold).toBe(CARAVANS.gold + CARAVANS.perLand * 2);
    next(c);
    caravansHome(c);
    expect(folkOf(c, a.id).stores.gold).toBe(gold + x.worth);
    expect(c.caravans).toEqual([]);
    expect(c.caravanTally).toMatchObject({ sent: 2, came: 2, mine: { sent: 2, came: 2 } });
    expect(c.log.join('\n')).toMatch(/come home from the markets/);
  });

  it('a season of trade: home, then out again', () => {
    const { c, a } = road();
    caravansSeason(c);
    next(c);
    const s = caravansSeason(c);
    expect(s.home).toHaveLength(2);
    expect(s.sent).toHaveLength(2);
    expect(folkOf(c, a.id).stores.gold).toBeGreaterThan(500);
  });

  it('highwaymen on its road meet it as a convoy, and take half its gold; an escort as strong sees it through', () => {
    let robbed = 0, safe = 0;
    for (let n = 0; n < 30; n++) {
      const { c, a, b, z } = road();
      c.turn = 10 + n;
      const band: Band = { id: 1, kind: 'highwaymen', name: 'the Night Road', at: b.id, to: z.id, strength: 4, since: 1, held: [] };
      c.bands = [band];
      const escorted = n % 2 === 1;
      if (escorted) c.armies.push({ id: 77, owner: 0, at: b.id, units: { infantry: 8 }, hero: false, vet: 0, moved: false }); // an escort that beats the band: it is fought out now (roadclash.ts), and an even match may go either way
      const [x] = sendCaravans(c).filter((y) => y.to === a.id);
      const worth = x.worth, before = folkOf(c, a.id).stores.gold;
      next(c);
      caravansHome(c);
      const got = folkOf(c, a.id).stores.gold - before;
      if (got < worth) { expect(escorted).toBe(false); expect(got).toBe(worth - Math.floor(worth * 0.5)); robbed++; } else { expect(got).toBe(worth); safe++; }
    }
    expect(robbed).toBeGreaterThan(5);
    expect(safe).toBeGreaterThan(15);
  });

  it('a band standing on its road may fall on it once, unless an escort as strong stands there', () => {
    const { c, a, b } = road();
    const [x] = sendCaravans(c).filter((y) => y.to === a.id);
    const band = { id: 9, kind: 'raiders', name: 'the Red Hand', at: b.id, strength: 5, since: 1, held: [] } as unknown as Band;
    const took = fallOnCaravan(c, x, band);
    expect(took).toBe(Math.floor(x.worth * 0.5));
    expect(band.strength).toBe(6);
    expect(fallOnCaravan(c, x, band)).toBe(0); // once
    const { c: c2, a: a2, b: b2 } = road();
    c2.armies.push({ id: 77, owner: 0, at: b2.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    const [y] = sendCaravans(c2).filter((w) => w.to === a2.id);
    expect(fallOnCaravan(c2, y, { ...band, strength: 3 } as Band)).toBe(0);
  });

  it('a town lost while its caravan was out has nothing come in', () => {
    const { c, a } = road();
    sendCaravans(c);
    a.owner = 1;
    next(c);
    const home = caravansHome(c);
    expect(home.find((h) => h.convoy.to === a.id)!.lost).toBe(true);
  });

  it('a people of Traders earns more by them', () => {
    const { c, a, z, b } = road();
    const plain = caravanWorth(c, a.id, z.id, [a.id, b.id, z.id]);
    c.factions[0].civ = 'persia';
    expect(caravanWorth(c, a.id, z.id, [a.id, b.id, z.id])).toBe(Math.round(plain * CARAVANS.traders));
  });
});

describe('markets on the map', () => {
  it('a governor with plenty begins a Market where there is a town to trade with in reach; one a season for a people', () => {
    const { c, a, z } = road(5, false);
    c.factions[0].age = Math.max(1, c.factions[0].age ?? 0);
    for (const t of [a, z]) { t.buildings = ['farm']; Object.assign(folkOf(c, t.id).stores, { food: 4000, wood: 4000, gold: 4000, stone: 4000 }); }
    const begun = governMarkets(c);
    expect(begun).toHaveLength(1);
    expect(begunAt(c, begun[0], 'market')).toBe(true);
    expect(governMarkets(c)).toHaveLength(1); // the next season, the next town
    expect([a.id, z.id].every((id) => begunAt(c, id, 'market'))).toBe(true);
  });
});
