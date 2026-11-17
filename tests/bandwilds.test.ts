// Bands from the far wilds (src/sim/bandwilds.ts): born far from any town, they march in, are seen coming, and can be met on the way.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Army, Campaign } from '../src/sim/campaign';
import { MARCH, WILDS, farWilds, landsFromHeld, marchOf, marched, townsThatSee } from '../src/sim/bandmarch';
import { farPlace, setOutFromAfar, wayIn } from '../src/sim/bandwilds';
import { roamSeason } from '../src/sim/bandroam';
import { fightByMeans, huntBands } from '../src/sim/bandfight';
import { threatsOfMen } from '../src/sim/bandseason';
import { heraldSeason } from '../src/sim/raidnews';
import { softest } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

/** A world where the player holds one open town and every other land began wild and is empty (wilds.ts), with no armies, bands or marauders. */
function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.bands = []; c.turn = 20;
  const home = c.territories.find((x) => x.capital === 0)!;
  for (const t of c.territories) {
    t.capital = -1; t.owner = t.id === home.id ? 0 : -1; t.buildings = []; t.trait = ''; delete t.town; delete t.horde;
    const lived = t.id === home.id;
    Object.assign(folkOf(c, t.id), lived ? { men: 6, women: 6, elders: 0, children: 2 } : { men: 0, women: 0, elders: 0, children: 0 });
    delete folkOf(c, t.id).ages;
    t.militia = 0; t.wild = !lived; // every land but the town began wild, and is empty
  }
  for (const f of c.factions) f.alive = f.id === 0;
  return { c, home };
}
let ids = 900;
const band = (c: Campaign, at: number, strength = 4): Band => {
  const b: Band = { id: ids++, kind: 'raiders', name: 'the Far Men', at, strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
const army = (c: Campaign, at: number, n: number, owner = 0): Army => { const a: Army = { id: 800 + c.armies.length, owner, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };
/** A far wild with a way in, the farthest there is, in any of a few worlds. */
function far() {
  for (let seed = 11; seed < 40; seed++) {
    const w = world(seed), d = landsFromHeld(w.c);
    const at = farWilds(w.c).filter((id) => wayIn(w.c, id)).sort((x, y) => d[y] - d[x] || x - y)[0];
    if (at !== undefined && d[at] >= 3) return { ...w, at, d };
  }
  throw new Error('no world with a far wild three lands off');
}

describe('the far wilds', () => {
  it('are the lands that began wild and are still empty, with no band or army in them; a tribe\'s land is not', () => {
    const { c, home } = world();
    const d = landsFromHeld(c);
    expect(d[home.id]).toBe(0);
    for (const n of home.adj) expect(d[n]).toBe(1);
    const wilds = farWilds(c);
    expect(wilds.length).toBeGreaterThan(0);
    for (const id of wilds) { expect(c.territories[id].wild).toBe(true); expect(c.territories[id].owner).toBe(-1); }
    expect(wilds).not.toContain(home.id);
    // A land where a tribe lives, or one settlers have taken, is not the far wilds.
    const tribe = wilds.at(-2)!;
    Object.assign(folkOf(c, tribe), { men: 3, women: 3 });
    expect(farWilds(c)).not.toContain(tribe);
    Object.assign(folkOf(c, tribe), { men: 0, women: 0 });
    delete c.territories[tribe].wild;
    expect(farWilds(c)).not.toContain(tribe);
    c.territories[tribe].wild = true;
    expect(farWilds(c)).toContain(tribe);
    band(c, wilds[0]);
    expect(farWilds(c)).not.toContain(wilds[0]);
    if (wilds[1] !== undefined) { army(c, wilds[1], 1); expect(farWilds(c)).not.toContain(wilds[1]); }
    c.territories[wilds.at(-1)!].horde = true;
    expect(farWilds(c)).not.toContain(wilds.at(-1));
  });

  it('a new camp is born there a share of the time, when there is a way in; pirates and highwaymen never', () => {
    const { c } = far();
    const share = WILDS.share;
    try {
      WILDS.share = 1;
      const at = farPlace(c, 'raiders');
      expect(at).not.toBeNull();
      expect(farWilds(c)).toContain(at![0]);
      expect(wayIn(c, at![0])).not.toBeNull();
      expect(farPlace(c, 'pirates')).toBeNull();
      expect(farPlace(c, 'highwaymen')).toBeNull();
      WILDS.share = 0;
      expect(farPlace(c, 'raiders')).toBeNull();
      // With no town left to make for there is no way in, and nobody is born out there.
      WILDS.share = 1;
      for (const t of c.territories) t.owner = -1;
      expect(farPlace(c, 'raiders')).toBeNull();
    } finally { WILDS.share = share; }
  });
});

describe('a band from the far wilds', () => {
  it('sets out at once for a mark, marches in season by season striking nobody, and its march is on record', () => {
    const { c, home, at, d } = far();
    const b = band(c, at);
    expect(setOutFromAfar(c, b)).toBe(true);
    expect(b.afar).toBe(true);
    const m = marchOf(c, b.id)!;
    expect(m).toMatchObject({ band: b.id, born: c.turn, from: at, bound: b.bound });
    expect(m.lands).toBeGreaterThan(1);
    expect(m.lands).toBeLessThanOrEqual(MARCH.long);
    expect([m.bound, ...c.territories[m.bound].adj]).toContain(home.id); // it is making for the only town there is
    expect(softest(c, b)).toBeNull(); // nothing in reach out here
    let seasons = 0;
    while (b.afar && seasons < 12) { c.turn++; roamSeason(c, []); seasons++; expect(d[b.at]).toBeLessThanOrEqual(d[at]); }
    expect(b.afar).toBeUndefined();
    expect(b.at).toBe(m.bound);
    expect(m.arrived).toBe(c.turn);
    expect(seasons).toBeGreaterThanOrEqual(Math.ceil(m.lands / MARCH.pace));
    expect(softest(c, b)!.id).toBe(home.id); // and now the town is in its reach
    // A band born beside a town, or pirates, do not set out so.
    const beside = home.adj.find((n) => n !== b.at);
    if (beside !== undefined) {
      const near = band(c, beside);
      expect(setOutFromAfar(c, near)).toBe(false);
      expect(marchOf(c, near.id)).toBeUndefined();
    }
  });

  it('is seen coming by a town within two lands of its way, a season or more before it is there', () => {
    const { c, home, at } = far();
    const b = band(c, at);
    setOutFromAfar(c, b);
    const m = marchOf(c, b.id)!;
    while (b.afar) { c.turn++; roamSeason(c, []); }
    expect(m.seen).toBeDefined();
    expect(m.seen!).toBeLessThanOrEqual(m.arrived!);
    const seen = (c.bandNews ?? []).filter((n) => n.kind === 'seen');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].owners).toEqual([0]);
    expect(seen[0].text).toContain('Your people');
    expect(seen[0].text).toContain('on the march');
    expect(townsThatSee(c, [home.adj[0]]).map((x) => x.owner)).toEqual([0]);
    expect(townsThatSee(c, [home.adj[0]], [0])).toEqual([]); // not told twice when an army of theirs saw it
  });

  it('heralds hear of its mark while it is still on the way', () => {
    const { c, home, at } = far();
    c.factions[0].studies = ['heralds'];
    const b = band(c, at);
    setOutFromAfar(c, b);
    expect(softest(c, b)).toBeNull();
    const out: string[] = [];
    expect(heraldSeason(c, out)).toEqual([home.id]);
    expect(out.join(' ')).toContain('Heralds bring word');
  });

  it('an army that goes out against it before it has struck has met it; one it falls on, or that fights it after, has not', () => {
    const { c, home, at } = far();
    const b = band(c, at, 2);
    setOutFromAfar(c, b);
    const m = marchOf(c, b.id)!;
    const a = army(c, home.id, 8);
    fightByMeans(c, a, b, [], true); // the band came against the army
    expect(m.met).toBeUndefined();
    const b2 = band(c, at, 2);
    setOutFromAfar(c, b2);
    const m2 = marchOf(c, b2.id)!;
    marched(c, b2.id, 'struck');
    fightByMeans(c, a, b2, []); // it had struck already
    expect(m2.met).toBeUndefined();
    const b3 = band(c, at, 2);
    setOutFromAfar(c, b3);
    fightByMeans(c, a, b3, []);
    expect(marchOf(c, b3.id)).toMatchObject({ met: c.turn, broken: true });
  });

  it('a computer people\'s army goes out to meet a band on the march as soon as it comes beside their land', () => {
    const { c, home, at } = far();
    c.factions[1].alive = true; c.factions[1].isAI = true;
    home.owner = 1;
    const b = band(c, at, 2);
    b.since = c.turn; // only just come: an idle band this young would be left alone
    setOutFromAfar(c, b);
    const a = army(c, home.id, 8, 1);
    expect(huntBands(c, [])).toBe(0); // still far off
    while (b.afar && !c.territories[b.at].adj.includes(home.id)) { c.turn++; roamSeason(c, []); }
    expect(c.territories[b.at].adj).toContain(home.id);
    b.bound = b.bound ?? home.id; // (if it arrived on that step it has stopped marching; keep it on the march for the test)
    expect(huntBands(c, [])).toBe(1);
    expect(c.bands).not.toContain(b);
    expect(a.units.infantry).toBeGreaterThan(0);
  });

  it('in a season of the threats of men, a camp born out there is told of to nobody', () => {
    const { c } = far();
    const share = WILDS.share;
    try {
      WILDS.share = 1;
      let born: Band | undefined;
      for (let i = 0; i < 40 && !born; i++) { c.turn++; const logged = c.log.length; threatsOfMen(c); born = (c.bands ?? []).find((x) => x.afar); if (born) expect(c.log.slice(logged).join(' ')).not.toContain(born.name); }
      expect(born).toBeDefined();
      expect(marchOf(c, born!.id)).toBeDefined();
    } finally { WILDS.share = share; }
  });
});
