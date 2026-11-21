// Threats of men on the map: bands that choose a town and strike it (src/sim/threats.ts).
import { RAID } from '../src/sim/raidclash';
import { bareCampaign } from './helpers';
import { settleRaid } from '../src/sim/raidfought';
import { describe, expect, it } from 'vitest';
import { endTurn, continueAI, eventsAt } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { CHILD_SEASONS, GROWN_SEASON, OLD_SEASON, SEASONS_A_YEAR, agesOf } from '../src/sim/ageing';
import '../src/sim/convoys';
import { THREATS, Band, BandKind, Raid, bandsAt, defenceOf, raidsAt, reachOf, reportLine, reportText, seasonsLeft, wanted } from '../src/sim/threats';
import { threatsOfMen } from '../src/sim/bandseason';
import { attackBand } from '../src/sim/bandfight';
import { resolvePending } from '../src/sim/campaign';
import { needOf } from '../src/sim/larder';
import { TOWN_SCALE as S, folkOf, nationStores } from '../src/sim/township';
import type { Stores } from '../src/sim/township';
import { SUPPLY_UNITS } from '../src/sim/stores';
/** All the goods in a store. */
const goods = (s: Stores): number => s.food + s.wood + s.gold + s.stone;

/** A world with one town of the player's set apart: its neighbours are the local tribes', so a band placed there has only it to strike. */
function world(opts: { men?: number; women?: number; children?: number; virtue?: number; seed?: number } = {}) {
  const c = bareCampaign(opts.seed ?? 11, 2);
  c.fronts = [];
  c.factions[0].virtue = opts.virtue ?? 0;
  c.factions[0].supplies = 20;
  const t = c.territories.find((x) => x.owner === 0)!;
  for (const id of t.adj) c.territories[id].owner = -1;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  t.buildings = ['farm'];
  delete t.town;
  const f = folkOf(c, t.id);
  // People are given as of a town as towns were, and are as many as that is now (township.ts TOWN_SCALE).
  f.men = (opts.men ?? 6) * S; f.women = (opts.women ?? 6) * S; f.elders = 1 * S; f.children = (opts.children ?? 4) * S;
  f.stores = { food: 400, wood: 200, gold: 200, stone: 100 };
  delete f.ages;
  return { c, t, f };
}
const band = (c: Campaign, t: Territory, kind: BandKind, strength: number, to?: number): Band => {
  const b: Band = { id: 900 + (c.bands?.length ?? 0), kind, name: 'the Test Men', at: t.id, ...(to === undefined ? {} : { to }), strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
/** Seasons pass until this band strikes (it does so a little over half the time). Its strength is held where it was set. */
function untilStrike(c: Campaign, b: Band): Raid {
  const strength = b.strength;
  for (let i = 0; i < 60; i++) {
    c.turn++; b.since = c.turn; b.strength = strength;
    for (const h of b.held) h.since = c.turn;
    const r = threatsOfMen(c).find((x) => x.band === b.id) ?? (c.pending?.raid === b.id ? settleRaid(c, 'auto') : null); // a strike on a town of the player's waits on the player now: left to the town, it falls as it did (raidfought.ts)
    if (r) return r;
  }
  throw new Error('the band never struck');
}

/** What a band takes of a town's stores (400 food, 200 wood, 200 gold, 100 stone): its share of each, and no more in all than it can carry. */
/**
 * What a strike may take of a town's stores: its share of each kind, of the food only what is beyond THREATS.larder
 * seasons of the town's own eating, and no more in all than the band can carry.
 */
function checkLoot(c: Campaign, tid: number, r: Raid, share: number, had = { food: 400, wood: 200, gold: 200, stone: 100 }): void {
  const all = r.stores.food + r.stores.wood + r.stores.gold + r.stores.stone;
  expect(all).toBeLessThanOrEqual(r.force * THREATS.carry[r.kind]);
  for (const k of ['food', 'wood', 'gold', 'stone'] as const) expect(r.stores[k]).toBeLessThanOrEqual(Math.floor(had[k] * share));
  expect(all).toBeGreaterThan(0);
  // The larder is left: those still in the town have their seasons of eating.
  expect(folkOf(c, tid).stores.food).toBeGreaterThanOrEqual(Math.min(had.food, THREATS.larder * needOf(c, tid)));
  expect(folkOf(c, tid).stores.food).toBe(had.food - r.stores.food);
}

describe('what a town has to defend itself with', () => {
  it('its men, its fortress and barracks, the towers on its field by how whole they are, an army there, a capital\'s guard, and its people\'s spirit', () => {
    const { c, t } = world({ men: 10 });
    const bare = defenceOf(c, t.id);
    expect(bare.men).toBeCloseTo(10 * THREATS.man, 5);
    expect(bare.total).toBeCloseTo(bare.men + bare.guard, 5);
    t.buildings = ['farm', 'fortress', 'barracks'];
    expect(defenceOf(c, t.id).works).toBe(THREATS.fortress + THREATS.raising);
    t.town = { at: 2, b: [['tower', 5, 5], ['tower', 9, 5, 0.5], ['tower', 12, 5, undefined, 0.4], ['house', 3, 3]] };
    expect(defenceOf(c, t.id).walls).toBe(1.5); // one whole, one half ruined, one never finished
    c.armies.push({ id: 801, owner: 0, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    expect(defenceOf(c, t.id).army).toBe(3);
    const plain = defenceOf(c, t.id).total;
    c.factions[0].virtue = 100;
    expect(defenceOf(c, t.id).total).toBeGreaterThan(plain);
    c.factions[0].virtue = -100;
    expect(defenceOf(c, t.id).total).toBeLessThan(plain * 0.7);
    c.factions[0].virtue = 0;
    c.events = [{ kind: 'plague', at: t.id, turn: c.turn, until: c.turn + 1 }];
    expect(defenceOf(c, t.id).total).toBeCloseTo(plain * THREATS.sick, 0);
  });
});

describe('a band strikes a town', () => {
  it('a town with a fortress and an army holds: the band is weakened, nobody is taken, and its people are the better for it', () => {
    const { c, t, f } = world();
    t.buildings = ['farm', 'fortress'];
    c.armies.push({ id: 801, owner: 0, at: c.territories.find((x) => x.owner === 0 && x.id !== t.id)?.id ?? -5, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    const b = band(c, t, 'raiders', 3);
    const before = { ...f.stores }, virtue = c.factions[0].virtue!;
    const strength = b.strength;
    const r = untilStrike(c, b);
    expect(r.outcome).toBe('held');
    expect(r.taken).toEqual({ men: 0, women: 0 });
    expect(f.stores).toEqual(before);
    expect(t.buildings).toContain('farm');
    expect(b.strength).toBeLessThan(strength);
    expect(r.sway).toBe(THREATS.sway.held);
    expect(c.factions[0].virtue).toBe(virtue + THREATS.sway.held);
    expect(eventsAt(c, t.id).some((e) => e.kind === 'heldoff')).toBe(true);
    expect(reportLine(c, r)).toContain('were beaten back');
  });

  it('a weak band that is beaten off is broken, and gone from the map', () => {
    const { c, t } = world({ men: 20 });
    t.buildings = ['fortress'];
    const b = band(c, t, 'raiders', 1);
    const r = untilStrike(c, b);
    expect(r.broken).toBe(true);
    expect(c.bands!.includes(b)).toBe(false);
  });

  it('an undefended town falls to raiders: men die, women are carried off, stores are lost, and no child is touched', () => {
    const { c, t, f } = world({ men: 6, women: 8, children: 5 });
    const b = band(c, t, 'raiders', 12);
    const had = goods(nationStores(c, 0));
    const r = untilStrike(c, b);
    expect(r.outcome).toBe('taken');
    // The men who die are those its bands lost (militiatoll.ts's rule, at a raid's own share dead): some, never more than
    // that share of the men who stood, and never the town's last.
    expect(r.killed).toBeGreaterThan(0);
    expect(r.killed).toBeLessThanOrEqual(Math.round(6 * S * RAID.dead));
    expect(f.men).toBe(6 * S - r.killed);
    expect(r.taken.women).toBe(Math.ceil(8 * S * THREATS.carried));
    expect(r.taken.men).toBe(0); // raiders take women
    expect(f.women).toBe(8 * S - r.taken.women);
    expect(f.children).toBe(5 * S);
    expect(f.ages!.k.length).toBe(5 * S);
    expect(f.ages!.f.filter((s) => s < OLD_SEASON).length).toBe(f.women);
    checkLoot(c, t.id, r, RAID.loot);
    expect(f.stores.food).toBe(400 - r.stores.food);
    expect(goods(nationStores(c, 0))).toBe(had - goods(r.stores)); // what was looted from the town is all the raid cost: the nation is not charged again
    expect(r.sway).toBe(THREATS.sway.taken);
    // Held at the band's place, with their ages, since this season.
    expect(b.held).toHaveLength(1);
    expect(b.held[0]).toMatchObject({ from: t.id, owner: 0, since: c.turn });
    expect(b.held[0].women).toHaveLength(r.taken.women);
    expect(b.held[0].women.every((s) => s >= 60 && s < OLD_SEASON)).toBe(true);
    expect(eventsAt(c, t.id).some((e) => e.kind === 'carried')).toBe(true);
    expect(raidsAt(c, t.id)[0]).toBe(r);
    const text = reportText(c, r).join(' ');
    expect(text).toContain('The town fell to them.');
    expect(text).toContain(`Taken: ${r.taken.women} women`);
    expect(text).toContain('No child was touched.');
    expect(text).toContain('The people have lost heart');
  });

  it('slavers take men as well as women; pirates loot more; a town in between is raided and nobody is taken', () => {
    const slave = world({ men: 4, women: 6 });
    const s = untilStrike(slave.c, band(slave.c, slave.t, 'slavers', 9));
    expect(s.outcome).toBe('taken');
    expect(s.taken.men).toBeGreaterThan(0);
    expect(s.taken.women).toBeGreaterThan(0);
    expect(slave.f.men).toBe(4 * S - s.killed - s.taken.men);

    const sea = world({ men: 2 });
    sea.t.trait = 'coast';
    const p = untilStrike(sea.c, band(sea.c, sea.t, 'pirates', 9));
    checkLoot(sea.c, sea.t.id, p, RAID.loot + THREATS.pirateLoot);
    // Pirates have ships to fill, slavers come for people, and the marauders take least of all in goods.
    expect(THREATS.carry.pirates).toBeGreaterThan(THREATS.carry.raiders);
    expect(THREATS.carry.raiders).toBeGreaterThan(THREATS.carry.slavers);
    expect(THREATS.carry.slavers).toBeGreaterThan(THREATS.carry.marauders);
    checkLoot(slave.c, slave.t.id, s, RAID.loot);

    const mid = world({ men: 8 });
    mid.t.buildings = ['farm', 'barracks'];
    const d = defenceOf(mid.c, mid.t.id).total;
    const m = untilStrike(mid.c, band(mid.c, mid.t, 'slavers', Math.round(d * 1.4)));
    expect(m.outcome).toBe('raided');
    expect(m.taken).toEqual({ men: 0, women: 0 });
    expect(m.killed).toBeGreaterThan(0);
    checkLoot(mid.c, mid.t.id, m, RAID.loot);
  });

  it('a sacked people loses heart by its creed: the Virtuous least, the Depraved most', () => {
    const sway = (virtue: number) => { const w = world({ men: 1, virtue }); return untilStrike(w.c, band(w.c, w.t, 'raiders', 9)).sway; };
    const holy = sway(100), plain = sway(0), fallen = sway(-100);
    expect(plain).toBe(THREATS.sway.taken);
    expect(holy).toBeGreaterThan(plain);
    expect(holy).toBeLessThan(0);
    expect(fallen).toBeLessThan(plain);
  });

  it('highwaymen rob the road and never take people; an army at either end drives them off', () => {
    const { c, t, f } = world();
    const far = c.territories[t.adj[0]];
    far.owner = 0;
    c.armies = c.armies.filter((a) => a.at !== far.id);
    // Both towns have food well beyond their own eating: a band takes food only above a town's larder.
    for (const id of [t.id, far.id]) folkOf(c, id).stores.food = 2000;
    const b = band(c, t, 'highwaymen', 6, far.id);
    expect(reachOf(c, b).sort()).toEqual([t.id, far.id].sort());
    const people = () => [t.id, far.id].map((id) => { const k = folkOf(c, id); return k.men + k.women + k.children; });
    const before = people();
    const r = untilStrike(c, b);
    expect(r.outcome).toBe('raided');
    expect(r.killed).toBe(0);
    expect(r.taken).toEqual({ men: 0, women: 0 });
    expect(people()).toEqual(before);
    expect(r.stores.food).toBeGreaterThan(0);
    expect(folkOf(c, r.at).stores.food).toBeGreaterThanOrEqual(THREATS.larder * needOf(c, r.at)); // and the larder is left
    expect(r.stores.wood).toBe(0);
    expect(b.held).toHaveLength(0);
    expect(f.women).toBe(6 * S);
    expect(reportLine(c, r)).toContain('robbed the road');
  });

  it('pirates reach only coasts, and a band strikes the softest town it can reach, a decadent people\'s before a holy one\'s', () => {
    const { c, t } = world();
    for (const x of c.territories) x.trait = x.trait === 'coast' ? '' : x.trait;
    const b = band(c, c.territories.find((x) => x.owner < 0)!, 'pirates', 5);
    expect(reachOf(c, b)).toEqual([]);
    t.trait = 'coast';
    expect(reachOf(c, b)).toEqual([t.id]);

    // Two towns alike but for their walls: the open one is struck.
    const two = world();
    const other = two.c.territories[two.t.adj[0]];
    other.owner = 0; other.buildings = ['fortress']; two.c.armies = two.c.armies.filter((a) => a.at !== other.id);
    Object.assign(folkOf(two.c, other.id), { men: 6, women: 6, elders: 1, children: 4 });
    expect(untilStrike(two.c, band(two.c, two.t, 'raiders', 4)).at).toBe(two.t.id);
    // Alike in walls, the other people decadent: they are struck.
    const creed = world();
    const theirs = creed.c.territories[creed.t.adj[0]];
    theirs.owner = 1; theirs.buildings = ['farm']; delete theirs.town; creed.c.armies = creed.c.armies.filter((a) => a.at !== theirs.id);
    Object.assign(folkOf(creed.c, theirs.id), { men: 6, women: 6, elders: 1, children: 4 });
    theirs.capital = creed.t.capital;
    creed.c.factions[1].virtue = -100; creed.c.factions[0].virtue = 100;
    expect(untilStrike(creed.c, band(creed.c, creed.t, 'raiders', 4)).owner).toBe(1);
  });
});

describe('a town is bled, not emptied', () => {
  it('a band leaves a town its larder: one with no more than two seasons of food loses none of it', () => {
    const { c, t, f } = world({ men: 1, women: 6 });
    f.stores.food = Math.floor(THREATS.larder * needOf(c, t.id)) - 1;
    const food = f.stores.food;
    const r = untilStrike(c, band(c, t, 'raiders', 12));
    expect(r.outcome).not.toBe('held');
    expect(r.stores.food).toBe(0);
    expect(f.stores.food).toBe(food);
    expect(r.stores.gold).toBeGreaterThan(0);
  });

  it('it never takes a town\'s last two women or men, never more than half, and a town whose people are still held is raided, not taken again', () => {
    const few = world({ men: 1, women: 2 });
    const a = untilStrike(few.c, band(few.c, few.t, 'slavers', 12));
    expect(a.taken).toEqual({ men: 0, women: 0 });
    expect(a.outcome).toBe('raided'); // nobody to take: it is a raid
    expect(few.f.women).toBe(2 * S);

    const some = world({ men: 1, women: 3 });
    const b = band(some.c, some.t, 'raiders', 12);
    const first = untilStrike(some.c, b);
    expect(first.outcome).toBe('taken');
    // Of three (as towns were): never below the last two, never more than half, a quarter at most.
    const most = Math.min(3 * S - THREATS.last * S, Math.floor(3 * S * (1 - THREATS.left)), Math.ceil(3 * S * THREATS.carried));
    expect(first.taken.women).toBe(most);
    expect(some.f.women).toBe(3 * S - most);
    // Struck again while those are still held: raided, and nobody more is taken.
    const again = untilStrike(some.c, b);
    expect(again.outcome).toBe('raided');
    expect(again.taken).toEqual({ men: 0, women: 0 });
    expect(some.f.women).toBe(3 * S - most);

    const many = world({ men: 1, women: 20 });
    const m = untilStrike(many.c, band(many.c, many.t, 'raiders', 12));
    expect(m.taken.women).toBe(Math.ceil(20 * S * THREATS.carried));
    expect(m.taken.women).toBeLessThanOrEqual(10 * S);
  });
});

describe('those who are taken', () => {
  const sacked = () => {
    const w = world({ men: 2, women: 8, children: 5 });
    const b = band(w.c, w.t, 'slavers', 8);
    const r = untilStrike(w.c, b);
    return { ...w, b, r };
  };

  it('can be got back for THREATS.holdFor seasons: an army that stands at the band\'s place breaks it and they come home, the older for it', () => {
    const { c, t, f, b, r } = sacked();
    const taken = r.taken.men + r.taken.women;
    expect(taken).toBeGreaterThan(0);
    const women = f.women, men = f.men, oldest = Math.max(...b.held[0].women), stored = goods(f.stores);
    expect(seasonsLeft(c, b.held[0])).toBe(THREATS.holdFor);
    c.turn += 2;
    expect(seasonsLeft(c, b.held[0])).toBe(THREATS.holdFor - 2);
    c.armies.push({ id: 801, owner: 0, at: t.id, units: { infantry: 12 }, hero: false, vet: 0, moved: false });
    expect(attackBand(c, 801, b.id)).toBe('battle');
    expect(c.pending).toMatchObject({ band: b.id, armyId: 801, defender: -1 });
    expect(resolvePending(c, 'auto')).toBe(true); // left to the army, which is far the stronger
    expect(c.bands!.includes(b)).toBe(false);
    expect(f.women + f.elders - 1 * S).toBeGreaterThanOrEqual(women); // some may have come home old
    expect(f.men + f.women + f.elders).toBe(men + women + 1 * S + taken);
    expect(f.children).toBe(5 * S);
    // Half the time held: a woman is about fifteen years older, a man ten.
    expect(Math.max(...f.ages!.f)).toBeGreaterThanOrEqual(oldest + Math.round(THREATS.yearsWoman * SEASONS_A_YEAR * 0.5));
    expect(goods(f.stores)).toBe(stored + THREATS.prize * SUPPLY_UNITS); // taken back into the town where the army stands
    expect(c.log.some((l) => l.includes('Your army has broken the Test Men'))).toBe(true);
    expect(c.log.some((l) => l.includes('free and going home'))).toBe(true);
    expect(eventsAt(c, t.id).some((e) => e.kind === 'rescued')).toBe(true);
  });

  it('too weak an army is beaten off and loses a company; the band stays', () => {
    const { c, t, b } = sacked();
    b.strength = 9;
    c.armies.push({ id: 801, owner: 0, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    c.turn++;
    expect(attackBand(c, 801, b.id)).toBe('battle');
    expect(resolvePending(c, 'auto')).toBe(false);
    expect(c.bands!.includes(b)).toBe(true);
    expect(b.strength).toBeLessThan(9);
    expect(c.armies.find((a) => a.id === 801)!.units.infantry).toBeLessThan(3);
  });

  it('after that they are lost: the player is warned a season before, and told when it happens', () => {
    const { c, t, f, b } = sacked();
    const here = f.men + f.women;
    c.turn += THREATS.holdFor - 1;
    b.since = c.turn; // not its season to grow
    threatsOfMen(c);
    expect(c.log.some((l) => l.includes('One season is left to get back'))).toBe(true);
    expect(b.held.filter((h) => h.from === t.id && h.since < c.turn).length).toBe(1);
    c.turn++;
    threatsOfMen(c);
    expect(b.held.some((h) => h.since <= c.turn - THREATS.holdFor)).toBe(false);
    expect(c.log.some((l) => l.includes('sold on, and will not be seen again'))).toBe(true);
    expect(c.chronicle!.some((l) => l.text.includes('never got back'))).toBe(true);
    expect(f.men + f.women).toBeLessThanOrEqual(here);
  });

  it('a woman the nation knows by name who is carried off is marked lost, and is herself again when she is got back', () => {
    let seen = false;
    for (let seed = 1; seed <= 40 && !seen; seed++) {
      const w = world({ men: 1, women: 3, seed });
      w.f.notables = [{ name: 'Mira', gender: 'f', kind: 'mother', deed: 'raised 4 children', turn: 1, kids: 4 }];
      const b = band(w.c, w.t, 'raiders', 9);
      const r = untilStrike(w.c, b);
      if (!r.names.length) continue;
      seen = true;
      expect(r.names).toEqual(['Mira']);
      expect(w.f.notables[0].lost!.how).toBe('carried off by the Test Men');
      expect(reportText(w.c, r).join(' ')).toContain('Mira among them');
      w.c.armies.push({ id: 801, owner: 0, at: w.t.id, units: { infantry: 12 }, hero: false, vet: 0, moved: false });
      w.c.turn++;
      expect(attackBand(w.c, 801, b.id)).toBe('battle');
      expect(resolvePending(w.c, 'auto')).toBe(true);
      expect(w.f.notables[0].lost).toBeUndefined();
    }
    expect(seen).toBe(true);
  });
});

describe('bands on the map', () => {
  it('there is meant to be one for every six held lands, never fewer than one, and one more while any people is worldly or decadent', () => {
    const c = bareCampaign(11, 2);
    const lands = c.territories.filter((t) => t.owner >= 0).length;
    for (const f of c.factions) f.virtue = 0;
    expect(wanted(c)).toBe(Math.max(1, Math.floor(lands / THREATS.lands)));
    c.factions[1].virtue = -100;
    expect(wanted(c)).toBe(Math.max(1, Math.floor(lands / THREATS.lands)) + 1);
    for (const t of c.territories) t.owner = -1;
    expect(wanted(c)).toBe(0);
  });

  it('none before the third season; after it they appear, never more than are wanted, each with a place, and are marked on the map', () => {
    const c = bareCampaign(11, 2);
    c.fronts = [];
    for (c.turn = 1; c.turn < THREATS.from; c.turn++) threatsOfMen(c);
    expect(c.bands).toEqual([]);
    let most = 0;
    const kinds = new Set<string>();
    for (; c.turn < 80; c.turn++) {
      threatsOfMen(c);
      most = Math.max(most, c.bands!.length);
      expect(c.bands!.filter((b) => b.kind !== 'marauders').length).toBeLessThanOrEqual(wanted(c) || 1);
      for (const b of c.bands!) {
        kinds.add(b.kind);
        expect(c.territories[b.at]).toBeDefined();
        if (b.kind === 'pirates') expect(c.territories[b.at].trait).toBe('coast');
        if (b.kind === 'highwaymen') expect(c.territories[b.at].adj).toContain(b.to);
        if (b.kind !== 'marauders') expect(b.strength).toBeLessThanOrEqual(THREATS.max);
        expect(bandsAt(c, b.at)).toContain(b);
      }
    }
    expect(most).toBeGreaterThan(0);
    expect(kinds.size).toBeGreaterThan(1);
    expect(c.log.some((l) => l.includes('have made their'))).toBe(true);
    expect((c.raids ?? []).length).toBeGreaterThan(0);
    expect((c.raids ?? []).length).toBeLessThanOrEqual(THREATS.kept);
  });

  it('a campaign played through its turns meets them, and no town\'s children are ever fewer for a raid', () => {
    let raids = 0;
    for (const seed of [3, 4, 5]) {
      const c = bareCampaign(seed, 2);
      for (let i = 0; i < 40 && c.phase !== 'over' && !c.pending; i++) {
        // Each town's children, and how many of them are due to come of age this season.
        const kids = c.territories.map((t) => t.folk?.children ?? -1);
        const due = c.territories.map((t) => (t.folk ? agesOf(c, t.id, t.folk).k.filter((s) => s + 1 >= CHILD_SEASONS).length : 0));
        const seen = (c.raids ?? []).length;
        endTurn(c);
        while (c.demand) { c.demand = null; continueAI(c); }
        for (const r of (c.raids ?? []).slice(seen)) {
          raids++;
          // Children on the record leave it only by coming of age, or by going down the road with their own family to
          // another town of their people (migration.ts: a raided town is a reason to leave), where they arrive.
          // A town left with nobody grown that season has had its children taken in by the nearest town of their people
          // (orphans.ts): they are gone from this town's record, unharmed, and the chronicle says where they went.
          // Nothing else takes a child: not a raid, not plague, not hunger. So the count is exact, at any size of town.
          const byRoad = (c.convoys ?? []).filter((x) => x.from === r.at && x.since === c.turn).reduce((n, x) => n + (x.cargo.children?.length ?? 0), 0);
          const f = folkOf(c, r.at), takenIn = f.men + f.women + f.elders === 0 && (c.chronicle ?? []).some((x) => x.turn === c.turn && x.text.includes(`of ${c.territories[r.at].name}, left with nobody grown`));
          if (kids[r.at] >= 0 && !takenIn) expect(f.children).toBeGreaterThanOrEqual(kids[r.at] - due[r.at] - byRoad);
          if (takenIn) expect(f.children).toBe(0);
          expect(reportText(c, r).length).toBeGreaterThan(2);
        }
      }
    }
    expect(raids).toBeGreaterThan(0);
  });
});
