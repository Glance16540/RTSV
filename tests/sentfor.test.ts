// Goods sent for: a thing bought at a town waits for what the town lacks to come in by road (src/sim/sentfor.ts).
import { describe, expect, it } from 'vitest';
import { SITES, build, companyCost, continueAI, endTurn, newCampaign, raise } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { CONVOYS, cannotSend, convoysTurn } from '../src/sim/convoys';
import type { Band } from '../src/sim/threats';
import { fundFor, payFor, paysHere } from '../src/sim/prices';
import { sentForSeason, waitingFor } from '../src/sim/sentfor';
import { SUPPLY_UNITS, settleStores } from '../src/sim/stores';
import { folkOf, nationStores } from '../src/sim/township';

/** The player's chief town with timber to spare, and a town beside it with too little for a Barracks. */
const world = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const land = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id))!;
  land.owner = 0; land.buildings = [];
  settleStores(c);
  fundFor(c, 0, 'dealing', 10);
  folkOf(c, land.id).stores.wood += 200;
  folkOf(c, home.id).stores.wood += 600;
  settleStores(c);
  return { c, home, land };
};
const season = (c: Campaign) => { c.turn++; convoysTurn(c); return sentForSeason(c, (w) => paysHere(c, w.f, w.what, w.n, { at: w.at }) && build(c, w.f, w.at, String(w.act.arg))); };

describe('a thing bought waits for the goods sent for', () => {
  it('the season\'s turn of a campaign does it when they come in', () => {
    const { c, land } = world();
    expect(build(c, 0, land.id, 'barracks')).toBe(false);
    expect(waitingFor(c, 0, land.id, 'barracks')).toBeTruthy();
    expect(c.log.some((l) => l.includes(land.name) && l.includes('sent for by road'))).toBe(true);
    endTurn(c);
    for (let i = 0; i < 40 && c.phase === 'ai'; i++) continueAI(c);
    expect(land.buildings).toContain('barracks');
    expect(waitingFor(c, 0, land.id, 'barracks')).toBeUndefined();
    expect(c.log.some((l) => l.includes('have come in to') && l.includes(land.name))).toBe(true);
  });

  it('goods lost on the road leave it undone, and the player is told', () => {
    const { c, land } = world();
    build(c, 0, land.id, 'barracks');
    const x = (c.convoys ?? []).find((y) => y.pays !== undefined)!;
    x.cargo.wood = Math.floor(x.cargo.wood / 2); // a band took half of it on the road
    expect(season(c)).toHaveLength(0);
    expect(land.buildings).not.toContain('barracks');
    expect(waitingFor(c, 0, land.id, 'barracks')).toBeUndefined(); // let go: it can be ordered again
    expect(c.log.some((l) => l.includes('did not all come in'))).toBe(true);
    expect(folkOf(c, land.id).stores.wood).toBeGreaterThan(200); // its own share back, and what did come in
  });

  it('a town that has the goods itself pays at once, as before', () => {
    const { c, land } = world();
    folkOf(c, land.id).stores.wood += SITES.barracks.cost * SUPPLY_UNITS;
    settleStores(c);
    expect(build(c, 0, land.id, 'barracks')).toBe(true);
    expect((c.convoys ?? []).some((x) => x.pays !== undefined)).toBe(false);
  });

  it('a dealing, not done at a town, is still paid at once from wherever the goods are', () => {
    const { c } = world();
    const gold = nationStores(c, 0).gold;
    expect(payFor(c, 0, 'dealing', 3)).toBe(true);
    expect(nationStores(c, 0).gold).toBeLessThan(gold);
    expect(c.sentFor ?? []).toHaveLength(0);
  });

  it('the convoys that pay are not counted among the people\'s own on the road', () => {
    const { c, home, land } = world();
    build(c, 0, land.id, 'barracks');
    const ours = (c.convoys ?? []).filter((x) => x.owner === 0 && !x.movers && x.pays === undefined).length;
    expect(ours).toBe(0);
    for (let i = 0; i < CONVOYS.most; i++) (c.convoys ??= []).push({ id: 900 + i, owner: 0, from: home.id, to: land.id, road: [home.id, land.id], cargo: { food: 1, wood: 0, gold: 0, stone: 0, men: [], women: [] }, since: c.turn });
    expect(cannotSend(c, 0, home.id, land.id, { food: 1 })).toContain('No more than');
    expect(cannotSend(c, 0, home.id, land.id, { food: 1 }, { pays: 1 })).toBe('');
  });

  it('a company is raised at once, what its town lacks taken from the nation\'s towns that moment', () => {
    const { c, land } = world();
    land.buildings = ['barracks'];
    for (const k of ['food', 'wood', 'gold', 'stone'] as const) folkOf(c, land.id).stores[k] = 0;
    settleStores(c);
    expect(raise(c, 0, land.id, 'infantry')).toBe(true);
    expect((c.convoys ?? []).some((x) => x.pays !== undefined)).toBe(false);
    expect(c.sentFor ?? []).toHaveLength(0);
    expect(companyCost(land, 'infantry', c.factions[0].civ)).toBeGreaterThan(0);
  });

  it('a band that robs a paying convoy grows no stronger for it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { c, home, land } = world(seed);
      if (!build(c, 0, land.id, 'barracks') && (c.convoys ?? []).some((x) => x.pays !== undefined)) {
        const band = { id: 1, kind: 'highwaymen', name: 'the Night Road', at: home.id, to: land.id, strength: 4, since: 1, held: [] } as Band;
        c.bands = [band]; c.armies = c.armies.filter((a) => a.at !== home.id && a.at !== land.id);
        c.turn++;
        const robbed = convoysTurn(c).some((a) => a.robbed);
        if (!robbed) continue;
        expect(band.strength).toBe(4);
        return;
      }
    }
    throw new Error('no paying convoy was robbed in 40 seeds');
  });
});
