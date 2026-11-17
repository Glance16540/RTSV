// A rim of true wilderness at the map's edge (src/sim/rim.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { MAP_H, MAP_W, dominionNeed } from '../src/sim/campaignbase';
import { RIM, landsWithin, makeRim, outOf, rimPlaces } from '../src/sim/rim';
import { wilderness } from '../src/sim/wilds';
import { emptyLand, settleable } from '../src/sim/founding';
import { holdable } from '../src/sim/ruin';
import { campsBorne } from '../src/sim/bandhorde';
import { farWilds } from '../src/sim/bandmarch';
import { warriorsOf } from '../src/sim/tribes';

const worlds = (n = 24) => Array.from({ length: n }, (_, i) => newCampaign(i + 1, 2, 1, 'hearth'));

describe('the rim of true wilderness', () => {
  it('most worlds have one, of new lands at the map\'s edge, each empty, nobody\'s, and true wilderness whatever its climate', () => {
    let rims = 0, withOne = 0;
    for (const c of worlds()) {
      const rim = c.territories.filter((t) => t.rim);
      rims += rim.length; if (rim.length) withOne++;
      expect(rim.length).toBeLessThanOrEqual(RIM.lands);
      for (const t of rim) {
        expect(t.wild).toBe(true);
        expect(t.owner).toBe(-1);
        expect(t.capital).toBe(-1);
        expect(t.buildings).toEqual([]);
        expect(warriorsOf(c, t.id)).toBe(0);
        expect(emptyLand(c, t.id)).toBe(true);
        expect(wilderness(c, t.id)).toBe(true);
        expect(settleable(c, t.id)).toBe(false);
        const edge = Math.min(t.x, t.y, MAP_W - t.x, MAP_H - t.y);
        expect(edge).toBeLessThanOrEqual(Math.max(MAP_W, MAP_H) * RIM.inset + 1);
      }
    }
    expect(withOne).toBeGreaterThanOrEqual(20);
    expect(rims / 24).toBeGreaterThan(2);
  });

  it('takes nothing from anyone: every land the world was made with is where, whose and what it was, and nothing of the world\'s chances is spent', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      const own = c.territories.filter((t) => !t.rim);
      // The rim's lands come after all the others: no land's number is changed.
      expect(c.territories.findIndex((t) => t.rim)).toBe(own.length === c.territories.length ? -1 : own.length);
      own.forEach((t, i) => expect(t.id).toBe(i));
      // Made again from the same seed with the rim taken off, the world is the same world.
      const again = newCampaign(seed, 2, 1, 'hearth');
      expect(again.rngState).toBe(c.rngState);
      expect(again.territories.map((t) => [t.name, t.x, t.y, t.owner, t.militia, t.seed])).toEqual(c.territories.map((t) => [t.name, t.x, t.y, t.owner, t.militia, t.seed]));
      // No land lies under a rim land, and no chief town has the wilderness at its door.
      for (const r of c.territories.filter((t) => t.rim)) {
        for (const t of own) expect(Math.hypot(t.x - r.x, t.y - r.y)).toBeGreaterThanOrEqual(RIM.apart);
        expect(r.adj).toEqual([]); // it is nobody's neighbour
        expect(r.down!.length).toBeGreaterThanOrEqual(1);
        expect(r.down!.length).toBeLessThanOrEqual(RIM.joins);
        expect(outOf(c, r.id)).toEqual(r.down);
        for (const n of r.down!) {
          expect(c.territories[n].capital).toBe(-1);
          expect(c.territories[n].rim).toBeFalsy();
          expect(c.territories[n].adj).not.toContain(r.id);
          expect(outOf(c, n)).toEqual(c.territories[n].adj);
          expect(Math.hypot(c.territories[n].x - r.x, c.territories[n].y - r.y)).toBeLessThanOrEqual(RIM.near);
        }
      }
    }
  });

  it('is counted in nothing a people wins, holds or is ruined by, nor in how many camps the marauders may keep', () => {
    for (const c of worlds(12)) {
      const rim = c.territories.filter((t) => t.rim).length, within = c.territories.length - rim;
      expect(landsWithin(c)).toBe(within);
      expect(holdable(c).some((t) => t.rim)).toBe(false);
      expect(campsBorne(c)).toBe(Math.max(1, Math.floor(within / 10)));
      const need = dominionNeed(c);
      c.territories = c.territories.filter((t) => !t.rim);
      expect(dominionNeed(c)).toBe(need);
    }
  });

  it('is somewhere for a band to be born far off: its lands are far wilds while a held land can be reached from them', () => {
    let far = 0;
    for (const c of worlds()) far += farWilds(c).filter((id) => c.territories[id].rim).length;
    expect(far).toBeGreaterThan(24);
  });

  it('the places are drawn from the seed alone, the same every time, cold and parched ones first; made twice it adds nothing over what is there', () => {
    expect(rimPlaces(7)).toEqual(rimPlaces(7));
    expect(rimPlaces(7)).not.toEqual(rimPlaces(8));
    const p = rimPlaces(31), firstGreen = p.findIndex((x) => !x.waste);
    if (firstGreen >= 0) expect(p.slice(firstGreen).some((x) => x.waste)).toBe(false);
    const c = newCampaign(5, 2, 1, 'hearth'), n = c.territories.length;
    makeRim(c); // every place free before is taken, or too near one that is
    for (const t of c.territories.slice(n)) for (const r of c.territories.slice(0, n)) expect(Math.hypot(t.x - r.x, t.y - r.y)).toBeGreaterThanOrEqual(RIM.apart);
  });
});

describe('the rim and the world\'s named places', () => {
  it('no place of the world is in the rim, and the places are those the world would have had without it', async () => {
    const { placesOf } = await import('../src/sim/places');
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      const with_ = placesOf(c).map((p) => [p.at, p.kind, p.name]);
      for (const [at] of with_) expect(c.territories[at as number].rim).toBeFalsy();
      const bare = newCampaign(seed, 2, 1, 'hearth');
      bare.territories = bare.territories.filter((t) => !t.rim);
      delete bare.places;
      expect(placesOf(bare).map((p) => [p.at, p.kind, p.name])).toEqual(with_);
    }
  });
});
