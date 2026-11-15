// Convoys by road between a people's own towns (src/sim/convoys.ts, docs/DESIGN.md "Stores").
import { describe, expect, it } from 'vitest';
import { CONVOYS, cannotSend, convoysTurn, homeTown, onTheRoad, relieve, roadBetween, sendConvoy, worth } from '../src/sim/convoys';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import type { Band } from '../src/sim/threats';
import { OLD_SEASON, agesOf } from '../src/sim/ageing';
import { folkOf, nationStores } from '../src/sim/township';

/** A road of three lands of the player's, a - b - c, with nothing else of theirs and nobody about. */
function road(seed = 5) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.bands = [];
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  // Three lands in a row: a, one next to it, and one next to that which is not next to a.
  let a!: Territory, b!: Territory, z!: Territory;
  for (const x of c.territories) for (const y of x.adj.map((id) => c.territories[id])) for (const w of y.adj.map((id) => c.territories[id]))
    if (!a && w.id !== x.id && !x.adj.includes(w.id) && x.capital < 0 && y.capital < 0 && w.capital < 0) { a = x; b = y; z = w; }
  for (const t of [a, b, z]) {
    t.owner = 0;
    const k = folkOf(c, t.id);
    k.men = 6; k.women = 6; k.elders = 1; k.children = 3; k.stores = { food: 500, wood: 500, gold: 500, stone: 500 }; delete k.ages;
  }
  a.capital = 0;
  return { c, a, b, z };
}
const season = (c: Campaign) => { c.turn++; return convoysTurn(c); };

describe('convoys by road', () => {
  it('a road runs only through the people\'s own lands', () => {
    const { c, a, b, z } = road();
    expect(roadBetween(c, 0, a.id, z.id)).toEqual([a.id, b.id, z.id]);
    expect(cannotSend(c, 0, a.id, z.id, { food: 100 })).toBe('');
    b.owner = 1;
    expect(roadBetween(c, 0, a.id, z.id)).toBeNull();
    expect(cannotSend(c, 0, a.id, z.id, { food: 100 })).toMatch(/no road/);
    expect(sendConvoy(c, 0, a.id, z.id, { food: 100 })).toBeNull();
  });

  it('goods leave at once and come in when the season turns, and nothing is made or lost on the way', () => {
    const { c, a, z } = road();
    const all = worth(nationStores(c, 0));
    const x = sendConvoy(c, 0, a.id, z.id, { food: 200, gold: 50 })!;
    expect(x).toBeTruthy();
    expect(folkOf(c, a.id).stores.food).toBe(300);
    expect(folkOf(c, a.id).stores.gold).toBe(450);
    expect(worth(nationStores(c, 0))).toBe(all - 250); // on the road: in no town
    expect(convoysTurn(c)).toEqual([]); // not this season
    const came = season(c);
    expect(came).toHaveLength(1);
    expect(came[0].at).toBe(z.id);
    expect(folkOf(c, z.id).stores.food).toBe(700);
    expect(folkOf(c, z.id).stores.gold).toBe(550);
    expect(worth(nationStores(c, 0))).toBe(all);
    expect(onTheRoad(c, 0)).toEqual([]);
  });

  it('people go the youngest first with their ages, never the last man or woman and never a child', () => {
    const { c, a, z } = road();
    const ka = folkOf(c, a.id), kz = folkOf(c, z.id);
    expect(cannotSend(c, 0, a.id, z.id, { men: 6 })).toMatch(/keeps at least one/);
    expect(cannotSend(c, 0, a.id, z.id, { food: 501 })).toMatch(/has only/);
    const youngest = Math.min(...agesOf(c, a.id, ka).m);
    const x = sendConvoy(c, 0, a.id, z.id, { men: 2, women: 1 })!;
    expect(x.cargo.men).toHaveLength(2);
    expect(x.cargo.women).toHaveLength(1);
    expect(Math.min(...x.cargo.men)).toBeLessThanOrEqual(youngest);
    for (const s of [...x.cargo.men, ...x.cargo.women]) expect(s).toBeLessThan(OLD_SEASON);
    expect(ka.men).toBe(4); expect(ka.women).toBe(5); expect(ka.children).toBe(3); expect(ka.elders).toBe(1);
    season(c);
    expect(kz.men).toBe(8); expect(kz.women).toBe(7); expect(kz.children).toBe(3);
    for (const s of x.cargo.men) expect(kz.ages!.m).toContain(s + 1); // a season older for the road
  });

  it('highwaymen on the road take half of every store from an unescorted convoy, never its people; an escort as strong sees it through', () => {
    let robbed = 0, safe = 0;
    for (let n = 0; n < 40; n++) {
      const { c, a, b, z } = road();
      c.turn = 10 + n;
      const band: Band = { id: 1, kind: 'highwaymen', name: 'the Night Road', at: b.id, to: z.id, strength: 4, since: 1, held: [] };
      c.bands = [band];
      const escorted = n % 2 === 1;
      if (escorted) c.armies.push({ id: 77, owner: 0, at: b.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
      sendConvoy(c, 0, a.id, z.id, { food: 200, wood: 100, men: 1 });
      const [x] = season(c);
      expect(folkOf(c, z.id).men).toBe(7); // people always come through
      if (x.robbed) {
        expect(escorted).toBe(false);
        expect(x.robbed.took).toEqual({ food: 100, wood: 50, gold: 0, stone: 0 });
        expect(folkOf(c, z.id).stores.food).toBe(600);
        expect(band.strength).toBe(5);
        robbed++;
      } else { expect(folkOf(c, z.id).stores.food).toBe(700); safe++; }
    }
    expect(robbed).toBeGreaterThan(8);
    expect(robbed).toBeLessThanOrEqual(20);
    expect(robbed / 20).toBeGreaterThan(CONVOYS.meet - 0.35);
    expect(safe).toBeGreaterThan(20);
  });

  it('a convoy whose town is lost on the way turns for the chief town; with no town left, it is lost', () => {
    const { c, a, z } = road();
    sendConvoy(c, 0, z.id, a.id, { food: 100 });
    a.owner = 1; a.capital = -1;
    const [x] = season(c);
    expect(x.at).toBe(homeTown(c, 0));
    expect(x.at).not.toBe(a.id);
    const lost = road();
    sendConvoy(lost.c, 0, lost.a.id, lost.z.id, { food: 100 });
    for (const t of lost.c.territories) if (t.owner === 0) t.owner = 1;
    expect(season(lost.c)[0].lost).toBe(true);
  });

  it('a convoy on the road is kept in a saved game', () => {
    const { c, a, z } = road();
    sendConvoy(c, 0, a.id, z.id, { stone: 120, women: 1 });
    const back = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(onTheRoad(back, 0)).toHaveLength(1);
    season(back);
    expect(folkOf(back, z.id).stores.stone).toBe(620);
    expect(folkOf(back, z.id).women).toBe(7);
  });

  it('the computer player sends food to a hungry town from the town with most to spare', () => {
    const { c, a, b, z } = road();
    for (const t of [a, b, z]) t.owner = 1;
    a.capital = 1;
    folkOf(c, z.id).stores.food = 20;
    folkOf(c, b.id).stores.food = 900;
    const sent = relieve(c, 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe(b.id);
    expect(sent[0].to).toBe(z.id);
    expect(relieve(c, 1)).toHaveLength(0); // food is already on the way
    season(c);
    expect(folkOf(c, z.id).stores.food).toBe(20 + CONVOYS.relief);
  });
});
