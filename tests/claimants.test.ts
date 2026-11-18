// Claimants to the throne (src/sim/noblefaith.ts, wifetaken.ts, claimants.ts, claimantrising.ts; docs/DESIGN.md, the owner's word).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import '../src/sim/wifetaken';
import { beginPlot } from '../src/sim/courtstory';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { choicesFor, choose, intrigueSeason } from '../src/sim/intrigue';
import { kinOf, kinSeason, spouseOf } from '../src/sim/kin';
import { noblesOf } from '../src/sim/nobles';
import { OTHER, leaderCreed, nobleCreed, otherFaith, plotterOf } from '../src/sim/noblefaith';
import { WIFE, mayTake, takeWife } from '../src/sim/wifetaken';
import { bandChildren, claimsOn, ofAgeNow, recordChild } from '../src/sim/claimants';
import { RISING, claimantAt, claimantLine, claimantsSeason, comeOfAge, followers, seatFor, standing } from '../src/sim/claimantrising';
import { FREE, isFree, treatCost } from '../src/sim/freetown';
import { BORN } from '../src/sim/bandborn';
import { judge } from '../src/sim/rivalstories';
import { rollOf } from '../src/sim/roll';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** The player holds a capital and three towns round it: one keeps another creed, and each has its lord. */
const world = (seed = 5) => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 20; c.phase = 'player';
  const cap = c.territories.find((x) => x.capital === 0)!;
  // The map is laid by hand so the lands lie as the tests need: three towns round the capital, four more lands beyond the first, one beyond the second.
  const spare = c.territories.filter((t) => t !== cap && !t.horde && t.capital < 0 && !t.rim).slice(0, 8);
  const ring = spare.slice(0, 3), beyond = spare.slice(3, 7), far = spare[7];
  for (const t of c.territories) t.adj = t.adj.filter((n) => n !== cap.id && !spare.some((x) => x.id === n));
  cap.adj = ring.map((t) => t.id);
  ring[0].adj = [cap.id, ...beyond.map((t) => t.id)]; ring[1].adj = [cap.id, far.id]; ring[2].adj = [cap.id];
  for (const t of beyond) { t.adj = [ring[0].id]; t.owner = -1; }
  far.adj = [ring[1].id]; far.owner = -1;
  for (const t of ring) { t.owner = 0; delete t.free; }
  c.armies = c.armies.filter((a) => a.at === cap.id || !spare.some((t) => t.id === a.at));
  const towns = [cap, ...ring];
  for (const t of towns) { t.virtue = 50; Object.assign(folkOf(c, t.id), { men: 12, women: 12, elders: 2, children: 6 }); Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 }); }
  for (const t of c.territories) if (t.owner === 0 && !towns.includes(t)) t.owner = -1;
  ring[0].virtue = -50; // a worldly town under a devout people
  const k = kinOf(c, 0);
  k.spouse = { name: 'Maren', female: true, born: c.turn - 100, of: k.leader };
  k.circle = [];
  c.factions[0].heroAlive = true;
  c.factions[0].court = { at: cap.id };
  c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn'].map((name, i) => ({ key: `lord:${towns[i].id}:0`, name, female: name === 'Cyra', town: [ring[0], ring[1], ring[2], cap][i].id, rank: 'lord' as const, leaning: 'martial' as const, mood: 0 }));
  const other = noblesOf(c, 0)[0]; // Aldric, lord of the worldly town
  return { c, cap, ring, beyond, far, other, k };
};
const season = (c: Campaign, n = 1): void => { for (let i = 0; i < n; i++) { c.turn++; intrigueSeason(c); claimantsSeason(c); } };
/** A plot over faith by the lord of the worldly town, and the wife taken. */
const taken = (seed = 5) => {
  const w = world(seed);
  w.other.mood = -80;
  const x = beginPlot(w.c, w.other.key)!;
  expect(takeWife(w.c, x)).toBe(true);
  return { ...w, x };
};

describe('a noble who is not of the leader\'s faith', () => {
  it('keeps the creed of his town, and is of another faith where that is not the nation\'s', () => {
    const { c, other } = world();
    expect(leaderCreed(c, 0)).toBe('temperate'); // three devout towns and a worldly one
    expect(nobleCreed(c, other)).toBe('worldly');
    expect(otherFaith(c, 0, other)).toBe(true);
    const mid = c.territories.find((t) => t.owner === 0 && t.capital === 0)!;
    mid.virtue = 0;
    expect(otherFaith(c, 0, noblesOf(c, 0)[3])).toBe(false);
  });
  it('is the likelier to be the plotter, and his plot is a plot over faith', () => {
    const { c, other } = world();
    c.territories.find((t) => t.capital === 0)!.virtue = 0;
    const same = noblesOf(c, 0)[3];
    let his = 0;
    for (let i = 0; i < 100; i++) if (plotterOf(c, 0, [same, other], (i + 0.5) / 100) === other) his++;
    expect(his).toBe(Math.round((100 * OTHER.weight) / (OTHER.weight + 1)));
    expect(plotterOf(c, 0, [], 0.5)).toBeUndefined();
    other.mood = -80;
    expect(beginPlot(c)!.faith).toBe(true);
    const b = world();
    b.c.territories.find((t) => t.capital === 0)!.virtue = 0;
    expect(beginPlot(b.c, noblesOf(b.c, 0)[3].key)!.faith).toBeUndefined();
  });
});

describe('the leader\'s wife taken into a lord\'s house', () => {
  it('only in a plot over faith, by a lord, of a wife who is at court', () => {
    const { c, other, k } = world();
    other.mood = -80;
    const x = beginPlot(c, other.key)!;
    expect(mayTake(c, x)).toBe(true);
    k.spouse!.female = false; // a husband: the owner's word is of a wife
    expect(mayTake(c, x)).toBe(false);
    k.spouse!.female = true;
    other.rank = 'captain';
    expect(mayTake(c, x)).toBe(false);
    other.rank = 'lord';
    delete x.faith;
    expect(mayTake(c, x)).toBe(false);
    x.faith = true; x.found = true; // found first, he takes nobody
    expect(mayTake(c, x)).toBe(false);
  });
  it('is told as the plain fact, names him, and leaves the leader with no wife beside him', () => {
    const { c, x, other, k } = taken();
    expect(spouseOf(c, 0)).toBeUndefined();
    expect(k.spouse!.lost).toMatchObject({ how: 'taken', house: other.key });
    expect(c.log[c.log.length - 1]).toMatch(new RegExp(`^${x.nobles![x.culprit].title} has taken Maren, wife of .+, into his house at ${c.territories[other.town].name}\\. It is he who plotted for the leader's place\\.$`));
    expect(x.cleared).toHaveLength(x.nobles!.length - 1);
    expect(rollOf(c).spouse?.lost?.house).toBe(other.key);
    // The household's own season does not think her free, or marry the leader again.
    for (let i = 0; i < 12; i++) { c.turn++; kinSeason(c, 0); }
    expect(k.spouse!.name).toBe('Maren');
    expect(k.spouse!.lost?.house).toBe(other.key);
  });
  it('comes in the season the plot is two seasons old, by a chance a loyal marshal halves', () => {
    const count = (loyal: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 120; seed++) {
        const { c, other, k } = world(seed);
        if (loyal) k.circle = [{ post: 'marshal', name: 'Hale', female: false, town: other.town, loyalty: 100, feeling: 'content', since: 0 }];
        other.mood = -80;
        const x = beginPlot(c, other.key)!;
        x.cleared = []; // nothing comes out meanwhile
        for (let i = 0; i < WIFE.after; i++) { c.turn++; if (!x.found && !x.ended) intrigueSeason(c); }
        if (x.wifeTaken !== undefined) { n++; expect(x.wifeTaken - x.since).toBe(WIFE.after); }
      }
      return n;
    };
    const plain = count(false), guarded = count(true);
    expect(plain).toBeGreaterThan(15);
    expect(plain).toBeLessThan(60);
    expect(guarded).toBeLessThan(plain);
  });
  it('she can be demanded back with gifts: he yields or he refuses, and will not hear it again at once', () => {
    let home = 0, refused = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { c, x, k } = taken(seed);
      expect(choicesFor(c, x).map((o) => o.id)).toEqual(['demand', 'march']);
      expect(choicesFor(c, x)[1].bar).toContain('No army of yours');
      expect(choose(c, x.id, 'demand')).toBe(true);
      if (x.ended) { home++; expect(x.ended.how).toBe('bought'); expect(spouseOf(c, 0)?.name).toBe('Maren'); expect(k.alone).toBeUndefined(); }
      else { refused++; expect(choicesFor(c, x)[0].bar).toContain('will not hear it again'); expect(choose(c, x.id, 'demand')).toBe(false); c.turn += WIFE.again; expect(choicesFor(c, x)[0].bar).toBeUndefined(); }
    }
    expect(home).toBeGreaterThan(8);
    expect(refused).toBeGreaterThan(8);
  });
  it('an army standing in his town takes him: she comes home, and he waits on judgement like any plotter found', () => {
    const { c, x, other } = taken();
    c.armies.push({ id: 900, owner: 0, at: other.town, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(choose(c, x.id, 'march')).toBe(true);
    expect(spouseOf(c, 0)?.name).toBe('Maren');
    expect(x.found).toBe(true);
    expect(x.wife).toBeUndefined();
    expect(choicesFor(c, x).map((o) => o.id)).toEqual(['pardon', 'death']);
    expect(choose(c, x.id, 'pardon')).toBe(true);
    expect(x.ended?.how).toBe('pardoned');
  });
  it('left alone she is not seen at court again, and the leader may marry again in time', () => {
    const { c, x, k } = taken();
    season(c, WIFE.keeps);
    expect(x.ended?.how).toBe('lost');
    expect(k.spouse!.lost).toMatchObject({ final: true });
    expect(rollOf(c).spouse?.lost?.final).toBe(true);
  });
  it('if his town is lost she is lost with it; if he is no longer its lord she comes home', () => {
    const a = taken();
    a.c.territories[a.other.town].owner = 1;
    season(a.c);
    expect(a.x.ended?.how).toBe('lost');
    expect(spouseOf(a.c, 0)).toBeUndefined();
    const b = taken();
    b.c.factions[0].nobles = noblesOf(b.c, 0).filter((n) => n !== b.other);
    season(b.c);
    expect(b.x.ended?.how).toBe('nothing');
    expect(spouseOf(b.c, 0)?.name).toBe('Maren');
  });
  it('a child may be born in his house after two seasons, one at most: a record and nothing more', () => {
    let born = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { c, x, other } = taken(seed);
      const before = JSON.stringify(folkOf(c, other.town));
      season(c, BORN.after - 1);
      expect(claimsOn(c, 0)).toHaveLength(0);
      season(c, WIFE.keeps - BORN.after);
      const cl = claimsOn(c, 0);
      expect(cl.length).toBeLessThanOrEqual(1);
      if (!cl.length) continue;
      born++;
      expect(cl[0]).toMatchObject({ owner: 0, mother: 'Maren', parent: 'noble', town: other.town });
      expect(cl[0].name).toBeUndefined(); // no name, no figure, until grown
      expect(JSON.stringify(folkOf(c, other.town))).toBe(before); // in no town's count
      expect(x.wife?.child ?? true).toBe(true);
      expect(c.log.some((l) => l === `A child is born to Maren in the house of ${x.nobles![x.culprit].title}.`)).toBe(true);
    }
    expect(born).toBeGreaterThan(15);
  });
  it('a rival ruler answers it by his lights: by arms where his army stands there, else by asking', () => {
    const { c, x, other } = taken();
    x.owner = 1; // as a rival's story
    c.factions[1].supplies = 0;
    c.armies.push({ id: 901, owner: 1, at: other.town, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(judge(c, x)).toBe('march');
  });
});

describe('a child who may claim the throne', () => {
  it('born to the wife while a band holds her, one at most; home with her, it is raised in the leader\'s house and claims nothing', () => {
    let born = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { c, k, cap } = world(seed);
      const band = { id: 7, kind: 'slavers' as const, name: 'the Red Hand', at: cap.adj[0], strength: 5, since: c.turn, held: [{ from: cap.id, owner: 0, men: [], women: [30], since: c.turn, names: ['Maren'] }] };
      c.bands = [band];
      k.spouse!.lost = { turn: c.turn, how: 'taken', band: 7 };
      c.turn += BORN.after - 1;
      expect(bandChildren(c)).toHaveLength(0);
      for (let i = 0; i < 3 && !claimsOn(c, 0).length; i++) { c.turn++; bandChildren(c); }
      if (!claimsOn(c, 0).length) continue;
      born++;
      c.turn++;
      expect(bandChildren(c)).toHaveLength(0); // one at most
      expect(claimsOn(c, 0)[0]).toMatchObject({ parent: 'band', by: 'the Red Hand', mother: 'Maren', town: cap.adj[0] });
      band.held = []; delete k.spouse!.lost; // got back
      bandChildren(c);
      expect(claimsOn(c, 0)).toHaveLength(0);
      expect(c.claims![0].ended?.how).toBe('home');
    }
    expect(born).toBeGreaterThan(10);
  });
  it('is of age at the age any child of a house is grown, and not a season before', () => {
    const { c, other } = world();
    const cl = recordChild(c, { owner: 0, mother: 'Maren', parent: 'noble', by: 'Aldric, Lord of the place', town: other.town });
    c.turn += HEIR_AGE - 1;
    expect(ofAgeNow(c, cl)).toBe(false);
    claimantsSeason(c);
    expect(cl.name).toBeUndefined();
    c.turn++;
    expect(ofAgeNow(c, cl)).toBe(true);
  });
});

describe('a claimant grown raises a rebellion', () => {
  const grown = (seed = 5) => {
    const w = world(seed);
    const cl = recordChild(w.c, { owner: 0, mother: 'Maren', parent: 'noble', by: 'Aldric, Lord of the place', town: w.other.town });
    w.c.turn += HEIR_AGE;
    return { ...w, cl };
  };
  it('his seat is the town he grew up in; with it rise the towns beside it of another creed that are not held down', () => {
    const w = grown(), { c, cl, ring, cap } = w;
    expect(seatFor(c, cl)).toBe(ring[0].id);
    expect(followers(c, cl)).toEqual([ring[0].id]); // four towns: one in three is one
    const more = w.beyond;
    for (const t of more) { t.owner = 0; t.virtue = -50; }
    c.armies = c.armies.filter((a) => !more.some((t) => t.id === a.at));
    const all = followers(c, cl);
    expect(all[0]).toBe(ring[0].id);
    expect(all.length).toBe(Math.min(1 + more.length, Math.floor((4 + more.length) / RISING.share)));
    expect(all).not.toContain(cap.id);
    more[0].virtue = 0; // of the nation's creed: it does not follow
    expect(leaderCreed(c, 0)).toBe('temperate');
    expect(followers(c, cl)).not.toContain(more[0].id);
  });
  it('the towns rise as free towns marked as his, he is named and told of, and the town asks more to give him up', () => {
    const { c, cl, ring } = grown();
    claimantsSeason(c);
    expect(cl.name).toBeTruthy();
    expect(cl.grown).toBe(c.turn);
    expect(isFree(c, ring[0].id)).toBe(true);
    expect(claimantAt(c, ring[0].id)).toBe(cl);
    expect(standing(c, 0)).toEqual([cl]);
    expect(c.log[c.log.length - 1]).toContain(`${cl.name}, ${cl.female ? 'daughter' : 'son'} of Maren, raised in the house of Aldric, Lord of the place at ${ring[0].name}, has come of age and claims the throne`);
    expect(c.log[c.log.length - 1]).toContain(`${ring[0].name} has risen for`);
    expect(claimantLine(c, ring[0].id)).toContain('claims the throne');
    const price = treatCost(c, ring[0].id);
    delete c.territories[ring[0].id].free!.claimant;
    expect(price).toBeGreaterThanOrEqual(treatCost(c, ring[0].id));
    expect(FREE.claimant).toBe(2);
  });
  it('a seat held down does not rise: the claim is told, and nobody follows', () => {
    const a = grown();
    a.c.armies.push({ id: 902, owner: 0, at: a.ring[0].id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(comeOfAge(a.c, a.cl)).toEqual([]);
    expect(a.cl.ended?.how).toBe('nofollowing');
    expect(a.ring[0].owner).toBe(0);
    const b = grown();
    b.ring[0].owner = 1; // his town is another people's now
    expect(comeOfAge(b.c, b.cl)).toEqual([]);
  });
  it('born among a band, the claimant raises the people\'s town nearest where the band stood, never the capital', () => {
    const { c, far, ring } = world();
    const cl = recordChild(c, { owner: 0, mother: 'Maren', parent: 'band', by: 'the Red Hand', town: far.id });
    expect(seatFor(c, cl)).toBe(ring[1].id);
  });
  it('ends when his seat is the people\'s again, when it falls to another, or after ten years unbeaten', () => {
    const a = grown(); claimantsSeason(a.c);
    a.ring[0].owner = 0; delete a.ring[0].free;
    season(a.c);
    expect(a.cl.ended?.how).toBe('putdown');
    const b = grown(); claimantsSeason(b.c);
    b.ring[0].owner = 1;
    season(b.c);
    expect(b.cl.ended?.how).toBe('swallowed');
    const d = grown(); claimantsSeason(d.c);
    d.c.turn += RISING.lapse; claimantsSeason(d.c);
    expect(d.cl.ended?.how).toBe('lapsed');
    expect(isFree(d.c, d.ring[0].id)).toBe(true); // the town stays free
    expect(claimantAt(d.c, d.ring[0].id)).toBeUndefined();
  });
  it('takes the throne if the leader is dead with no child of the house of age, and his towns come back', () => {
    const { c, cl, ring } = grown(); claimantsSeason(c);
    c.factions[0].heroAlive = false;
    houseOf(c, 0).heirs = [{ name: 'Elin', female: true, born: c.turn - 4 }];
    c.turn++; claimantsSeason(c);
    expect(cl.ended?.how).toBe('crowned');
    expect(c.factions[0].heroAlive).toBe(true);
    expect(c.factions[0].hero!.name).toBe(cl.name);
    expect(ring[0].owner).toBe(0);
    expect(ring[0].free).toBeUndefined();
    // With an heir of age the house keeps its own.
    const b = grown(); claimantsSeason(b.c);
    b.c.factions[0].heroAlive = false;
    houseOf(b.c, 0).heirs = [{ name: 'Elin', female: true, born: b.c.turn - HEIR_AGE - 4 }];
    b.c.turn++; claimantsSeason(b.c);
    expect(b.cl.ended).toBeUndefined();
  });
});
