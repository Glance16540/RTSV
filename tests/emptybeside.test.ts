// Every people begins with one empty land beside its chief town (src/sim/emptybeside.ts; the owner's word of 21 November 2026).
import { describe, expect, it } from 'vitest';
import { moveArmy, newCampaign } from '../src/sim/campaign';
import { BESIDE, besideChoices, besideFor, makeEmptyBeside, mayStandEmpty } from '../src/sim/emptybeside';
import { emptyLand, nobodyThere, settleable } from '../src/sim/founding';
import { placeAt } from '../src/sim/places';
import { headcount } from '../src/sim/township';

const WORLDS = 40;

describe('when the world is made', () => {
  it('each people, the player and every rival alike, has one empty land beside its chief town', () => {
    let peoples = 0, given = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const c = newCampaign(seed, 2, 1);
      for (const f of c.factions) {
        peoples++;
        const t = besideFor(c, f.id);
        if (!t) continue;
        given++;
        const cap = c.territories.find((x) => x.capital === f.id)!;
        expect(cap.adj).toContain(t.id);
        expect(c.territories.filter((x) => x.beside === f.id)).toHaveLength(BESIDE.each);
      }
    }
    expect(given / peoples).toBeGreaterThan(0.95); // all but a people hemmed in by chief towns and the rim
  });
  it('nobody lives there: no tribe, no warriors, no works, and settlers may found a town on it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = newCampaign(seed, 2, 1);
      for (const f of c.factions) {
        const t = besideFor(c, f.id);
        if (!t) continue;
        expect(t.owner).toBe(-1);
        expect(headcount(t.folk!)).toBe(0);
        expect(t.militia).toBe(0);
        expect(t.buildings).toEqual([]);
        expect(nobodyThere(c, t.id)).toBe(true);
        expect(emptyLand(c, t.id)).toBe(true);
        expect(settleable(c, t.id)).toBe(true);
      }
    }
  });
  it('it is never a chief town, a marauders\' land, a land of the rim or a wild land, and no land serves two peoples; a named place only where there was no other', () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const c = newCampaign(seed, 3, 1);
      const lands = c.territories.filter((t) => t.beside !== undefined);
      expect(new Set(lands.map((t) => t.id)).size).toBe(lands.length);
      expect(new Set(lands.map((t) => t.beside)).size).toBe(lands.length);
      for (const t of lands) {
        expect(t.capital).toBeLessThan(0);
        expect(!!t.horde).toBe(false);
        expect(!!t.rim).toBe(false);
        expect(!!t.wild).toBe(false);
        if (placeAt(c, t.id)) { const cap = c.territories.find((x) => x.capital === t.beside)!; for (const n of cap.adj) { const o = c.territories[n]; if (o.id !== t.id && mayStandEmpty(c, o)) expect(!!placeAt(c, o.id)).toBe(true); } }
      }
    }
  });
  it('the same seed leaves the same lands empty', () => {
    const a = newCampaign(11, 2, 1), b = newCampaign(11, 2, 1);
    expect(a.territories.filter((t) => t.beside !== undefined).map((t) => [t.id, t.beside])).toEqual(b.territories.filter((t) => t.beside !== undefined).map((t) => [t.id, t.beside]));
  });
  it('an army cannot march on it: there is nobody there to conquer', () => {
    const c = newCampaign(7, 2, 1);
    const t = besideFor(c, 0)!, army = c.armies.find((a) => a.owner === 0)!;
    expect(t).toBeDefined();
    expect(c.territories[army.at].adj).toContain(t.id);
    expect(moveArmy(c, army.id, t.id)).toBe('invalid');
  });
});

describe('which land is chosen', () => {
  it('a land touching no other people\'s chief town before one that does', () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const c = newCampaign(seed, 3, 1);
      for (const f of c.factions) {
        const t = besideFor(c, f.id);
        if (!t) continue;
        const touches = (x: { adj: number[] }) => x.adj.some((n) => c.territories[n].capital >= 0 && c.territories[n].capital !== f.id);
        if (!touches(t) || placeAt(c, t.id)) continue;
        // It touches another chief town: then nothing else beside this people's own could have stood empty without doing so.
        const cap = c.territories.find((x) => x.capital === f.id)!;
        for (const n of cap.adj) { const o = c.territories[n]; if (o.id !== t.id && mayStandEmpty(c, o) && !placeAt(c, o.id)) expect(touches(o)).toBe(true); }
      }
    }
  });
  it('a people whose chief town has no land that may stand empty gets none, and nothing else is touched', () => {
    const c = newCampaign(7, 2, 1);
    for (const t of c.territories) delete t.beside;
    const cap = c.territories.find((t) => t.capital === 1)!;
    for (const n of cap.adj) c.territories[n].horde = true;
    expect(besideChoices(c, 1)).toEqual([]);
    const made = makeEmptyBeside(c);
    expect(made[1]).toBe(-1);
    expect(besideFor(c, 1)).toBeUndefined();
  });
  it('asked twice, it gives nothing more: a land given is not given again', () => {
    const c = newCampaign(7, 2, 1);
    const was = c.territories.filter((t) => t.beside !== undefined).map((t) => t.id);
    for (const t of c.territories) if (t.beside !== undefined) expect(mayStandEmpty(c, t)).toBe(false);
    expect(was.length).toBeGreaterThan(0);
  });
});
