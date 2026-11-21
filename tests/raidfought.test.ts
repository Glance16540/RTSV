// A band's strike on a town of the player's waits on the player, who may fight it in person (src/sim/raidfought.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, finishBattle, newCampaign, resolvePending } from '../src/sim/campaign';
import { COMPANIES } from '../src/sim/campaignbase';
import { CLASH } from '../src/sim/mapbattle';
import { RAID } from '../src/sim/raidclash';
import type { RaidFight } from '../src/sim/raidclash';
import { foughtAs, offerRaid, raidBattle, raidCompanies, raidPending, raidUnits, settleRaid, waitsOnPlayer } from '../src/sim/raidfought';
import { STRIKES, defenceOf, strike, strikeSeason } from '../src/sim/threats';
import type { Band, Defence } from '../src/sim/threats';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one town of the player's, not the capital, with no army in it and nothing built. */
const world = (men = 12 * S, seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.bands = []; c.armies = []; c.phase = 'player'; c.pending = null; c.demand = null;
  const t = c.territories.find((x) => x.owner === 0)!;
  t.capital = -1; t.buildings = []; delete t.town;
  Object.assign(folkOf(c, t.id), { men, women: 12 * S, elders: 0, children: 4 * S, stores: { food: 400, wood: 200, gold: 200, stone: 100 } }); delete folkOf(c, t.id).ages;
  return { c, at: t.id };
};
const band = (c: Campaign, at: number, strength: number, kind: Band['kind'] = 'raiders'): Band => { const b = { id: 7, kind, name: 'the Grey Band', at, strength, since: 1, held: [] } as Band; c.bands = [b]; return b; };
const count = (r: Record<string, number>): number => Object.values(r).reduce((n, v) => n + v, 0);
/** A share of the band's soldiers still standing, by unit. */
const left = (strength: number, share: number): Record<string, number> => Object.fromEntries(Object.entries(raidUnits(strength)).map(([u, n]) => [u, Math.round(n * share)]));

describe('a strike on a town of the player\'s waits on the player', () => {
  it('the season\'s strikes ask before one falls, and a strike that waits is not struck', () => {
    expect(STRIKES.waits).toBe(offerRaid);
    let waited = 0;
    for (let seed = 1; seed <= 40 && !waited; seed++) {
      const { c, at } = world(12 * S, seed);
      band(c, at, 6);
      const raids = strikeSeason(c, []);
      if (!c.pending) continue;
      waited++;
      expect(c.pending).toMatchObject({ raid: 7, to: at, attacker: -1, defender: 0, armyId: -1 });
      expect(raids).toEqual([]);
      expect(c.raids ?? []).toEqual([]);
      expect(raidPending(c)?.id).toBe(7);
    }
    expect(waited).toBe(1);
  });
  it('not a rival\'s town, not a road, and not while something else waits', () => {
    const { c, at } = world();
    const b = band(c, at, 6);
    expect(waitsOnPlayer(c, b, at)).toBe(true);
    const theirs = c.territories.find((x) => x.owner > 0)!.id;
    expect(waitsOnPlayer(c, b, theirs)).toBe(false);
    expect(waitsOnPlayer(c, { ...b, kind: 'highwaymen' }, at)).toBe(false);
    c.demand = { from: 1, amount: 3 } as Campaign['demand'];
    expect(waitsOnPlayer(c, b, at)).toBe(false);
    c.demand = null;
    expect(offerRaid(c, b, at, [])).toBe(true);
    expect(offerRaid(c, b, at, [])).toBe(false); // one at a time
    const out: string[] = [];
    c.pending = null;
    offerRaid(c, b, at, out);
    expect(out[0]).toContain('are coming against');
    expect(c.pending!.dStr).toBe(defenceOf(c, at).total);
  });
  it('a player the computer plays as a rival is not asked', () => {
    const { c, at } = world();
    c.factions[0].isAI = true;
    expect(waitsOnPlayer(c, band(c, at, 6), at)).toBe(false);
  });
});

describe('left to the town, it is the strike as it always was', () => {
  it('the same report, the same town and the same band as the strike falling at once', () => {
    for (const strength of [3, 6, 12]) {
      const one = world(), two = world();
      const b1 = band(one.c, one.at, strength), b2 = band(two.c, two.at, strength);
      const now = strike(one.c, b1, one.at, []);
      offerRaid(two.c, b2, two.at, []);
      const won = resolvePending(two.c, 'auto');
      expect(two.c.pending).toBeNull();
      expect(two.c.raids!.at(-1)).toEqual(now);
      expect(won).toBe(now.outcome !== 'held');
      expect(folkOf(two.c, two.at)).toEqual(folkOf(one.c, one.at));
      if (!now.broken) expect(two.c.bands![0].strength).toBe(b1.strength);
      expect(two.c.territories[two.at].owner).toBe(0);
    }
  });
  it('a band broken in the attempt is gone, and a band that is gone before it is settled strikes nobody', () => {
    const { c, at } = world(40 * S);
    c.territories[at].buildings.push('fortress', 'walls');
    offerRaid(c, band(c, at, 1), at, []);
    const raid = settleRaid(c, 'auto')!;
    expect(raid.outcome).toBe('held');
    expect(raid.broken).toBe(true);
    expect(c.bands).toEqual([]);
    const gone = world();
    offerRaid(gone.c, band(gone.c, gone.at, 6), gone.at, []);
    gone.c.bands = [];
    expect(settleRaid(gone.c, 'auto')).toBeNull();
    expect(gone.c.pending).toBeNull();
    expect(gone.c.raids ?? []).toEqual([]);
  });
});

describe('fought in person, the field is the town against the band alone', () => {
  it('the band\'s companies are raidclash\'s own count, as soldiers', () => {
    expect(raidCompanies(1)).toEqual({ infantry: 1 });
    const six = raidCompanies(6);
    expect(six.archers).toBe(Math.round(6 * RAID.bows));
    expect(count(six)).toBe(6);
    const per = (type: string): number => Object.values(COMPANIES[type].units)[0];
    expect(count(raidUnits(6))).toBe(six.infantry * per('infantry') + six.archers * per('archers'));
  });
  it('battleConfig lays the player\'s town as it defends, and the band where an attacker would stand', () => {
    const { c, at } = world();
    const b = band(c, at, 6);
    c.armies.push({ id: 31, owner: 0, at, units: { infantry: 2 }, vet: 0, moved: false, hero: false } as Campaign['armies'][number]);
    c.armies.push({ id: 32, owner: 0, at: c.territories[at].adj.find((id) => c.territories[id].owner === 0) ?? c.territories[at].adj[0], units: { infantry: 3 }, vet: 0, moved: false, hero: false } as Campaign['armies'][number]);
    offerRaid(c, b, at, []);
    const cfg = battleConfig(c)!;
    expect(cfg.humanAttacks).toBe(false);
    expect(cfg.field).toBe(false);
    expect(cfg.title).toContain('come against');
    expect(cfg.setups).toHaveLength(2); // no army from next door
    const [mine, theirs] = cfg.setups;
    expect(mine.isAI).toBe(false);
    expect(mine.bonus!.units!.clubman ?? mine.bonus!.units![Object.keys(COMPANIES.infantry.units)[0]]).toBeGreaterThan(0); // the army standing there
    expect(theirs.name).toBe('The Grey Band');
    expect(theirs.team).toBe(1);
    expect(theirs.besieger).toBe(true);
    expect(theirs.tribe).toBeUndefined();
    expect(theirs.civ).not.toBe(c.factions[0].civ);
    expect(theirs.bonus!.units).toEqual(raidUnits(6));
    expect(theirs.bonus!.buildings).toEqual([]);
    expect(theirs.start).not.toBe(mine.start);
    expect(raidBattle({ ...c, pending: null } as Campaign, cfg)).toBe(cfg); // nothing waiting: as laid
  });
});

describe('what the field came to is written back by the strike\'s own rule', () => {
  const clashed: RaidFight = { outcome: 'raided', rounds: 3, broke: 'defender', bandLost: 1, cost: 0.3, pressed: 0.6, works: 0.2, body: 0.5, garrisonLost: { infantry: 1 } };
  const open: Defence = { men: 3, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 3 };
  it('won, the town held, and the band is the weaker by those of its men who did not get away', () => {
    const f = foughtAs(clashed, open, 10, { won: true, foes: left(10, 0) });
    expect(f.outcome).toBe('held');
    expect(f.broke).toBe('attacker');
    expect(f.cost).toBe(1);
    expect(f.bandLost).toBe(Math.round(10 * RAID.rally));
    expect(foughtAs(clashed, open, 10, { won: true, foes: left(10, 1) }).bandLost).toBe(1); // never less than a point where it broke
    expect(f.body).toBe(clashed.body); // the town's dead are still the map's own fight's
  });
  it('lost cheaply, the town is taken; where the band had to fight for it, raided; and a held Fortress is never taken', () => {
    expect(foughtAs(clashed, open, 10, { won: false, foes: left(10, 1) }).outcome).toBe('taken');
    expect(foughtAs(clashed, open, 10, { won: false, foes: left(10, 0.5) }).outcome).toBe('raided');
    expect(foughtAs(clashed, { ...open, stronghold: true }, 10, { won: false, foes: left(10, 1) }).outcome).toBe('raided');
    expect(foughtAs(clashed, open, 10, { won: false, foes: left(10, 1) }).broke).toBe('defender');
  });
  it('a town the map\'s fight has holding stood the whole day before it fell; where the field does not say what the band has left, the map\'s fight does', () => {
    const held: RaidFight = { ...clashed, outcome: 'held', broke: 'attacker', rounds: 2 };
    expect(foughtAs(held, open, 10, { won: false, foes: left(10, 1) }).rounds).toBe(CLASH.rounds);
    expect(foughtAs(clashed, open, 10, { won: false, foes: left(10, 1) }).rounds).toBe(3);
    expect(foughtAs(clashed, open, 10, { won: false }).cost).toBe(clashed.cost);
    expect(foughtAs(clashed, open, 10, { won: false }).outcome).toBe('raided');
  });
  it('the army standing there keeps the companies that lived', () => {
    const [unit, per] = Object.entries(COMPANIES.infantry.units)[0];
    expect(foughtAs(clashed, open, 10, { won: true, survivors: { [unit]: per * 3 } }, { infantry: 3 }).garrisonLost).toEqual({});
    expect(foughtAs(clashed, open, 10, { won: true, survivors: { [unit]: per } }, { infantry: 3 }).garrisonLost).toEqual({ infantry: 2 });
    expect(foughtAs(clashed, open, 10, { won: true }, { infantry: 3 }).garrisonLost).toEqual(clashed.garrisonLost); // not told: the map's fight
  });

  it('finishBattle won: held, nothing taken, the band weaker, and the land the player\'s still', () => {
    const { c, at } = world();
    const b = band(c, at, 8);
    offerRaid(c, b, at, []);
    const women = folkOf(c, at).women, food = folkOf(c, at).stores.food;
    finishBattle(c, true, {}, { foes: left(8, 0.2) });
    expect(c.pending).toBeNull();
    const raid = c.raids!.at(-1)!;
    expect(raid.outcome).toBe('held');
    expect(raid.taken).toEqual({ men: 0, women: 0 });
    expect(folkOf(c, at).women).toBe(women);
    expect(folkOf(c, at).stores.food).toBe(food);
    expect(b.strength).toBe(8 - Math.max(1, Math.round(8 * 0.8 * RAID.rally)));
    expect(c.territories[at].owner).toBe(0);
    expect(c.phase).toBe('player');
  });
  it('finishBattle lost to a band that hardly bled: taken, grown people led away and stores lost, never a child', () => {
    const { c, at } = world();
    const b = band(c, at, 8);
    offerRaid(c, b, at, []);
    const kids = folkOf(c, at).children, women = folkOf(c, at).women;
    finishBattle(c, false, {}, { foes: left(8, 1) });
    const raid = c.raids!.at(-1)!;
    expect(raid.outcome).toBe('taken');
    expect(raid.taken.women).toBeGreaterThan(0);
    expect(folkOf(c, at).women).toBe(women - raid.taken.women);
    expect(folkOf(c, at).children).toBe(kids);
    expect(b.held[0].from).toBe(at);
    expect(raid.stores.food + raid.stores.gold).toBeGreaterThan(0);
    expect(c.territories[at].owner).toBe(0); // a raid takes no land
    expect(b.strength).toBe(9);
  });
  it('finishBattle lost to a band that paid for it: raided, and nobody led away', () => {
    const { c, at } = world();
    const b = band(c, at, 8);
    offerRaid(c, b, at, []);
    finishBattle(c, false, {}, { foes: left(8, 0.4) });
    const raid = c.raids!.at(-1)!;
    expect(raid.outcome).toBe('raided');
    expect(raid.taken).toEqual({ men: 0, women: 0 });
    expect(b.held).toEqual([]);
  });
  it('the army in the town loses the companies that did not live, never its last; its leader may fall there', () => {
    const { c, at } = world();
    const b = band(c, at, 8);
    c.armies.push({ id: 31, owner: 0, at, units: { infantry: 3 }, vet: 0, moved: false, hero: true } as Campaign['armies'][number]);
    c.factions[0].heroAlive = true; c.factions[0].heroRank = 2;
    offerRaid(c, b, at, []);
    const [unit, per] = Object.entries(COMPANIES.infantry.units)[0];
    finishBattle(c, true, { [unit]: per }, { foes: left(8, 0), fell: true });
    expect(c.armies.find((a) => a.id === 31)!.units).toEqual({ infantry: 1 });
    expect(c.raids!.at(-1)!.garrison).toBe(2);
    expect(c.factions[0].heroAlive).toBe(false);
    expect(c.factions[0].heroRank).toBe(1);
    expect(c.armies.find((a) => a.id === 31)!.hero).toBe(false);
    const all = world();
    all.c.armies.push({ id: 31, owner: 0, at: all.at, units: { infantry: 2 }, vet: 0, moved: false, hero: false } as Campaign['armies'][number]);
    offerRaid(all.c, band(all.c, all.at, 8), all.at, []);
    finishBattle(all.c, false, {}, { foes: left(8, 0.5) });
    expect(all.c.armies.find((a) => a.id === 31)!.units).toEqual({ infantry: 1 });
  });
});
