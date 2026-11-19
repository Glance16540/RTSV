// Rumours heard in a Tavern (src/sim/tavernrumour.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { RUMOUR, rumourSeason, truthsOf } from '../src/sim/tavernrumour';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';

const was = { ...RUMOUR.chance };
afterEach(() => Object.assign(RUMOUR.chance, was));

/** A campaign where a town of the player's with a Tavern has a rival's town next to it. */
function frontier(): { c: Campaign; home: number; rival: number } {
  const c = newCampaign(5, 2, 1, 'hearth');
  const t = c.territories.find((x) => x.capital === 0)!;
  for (const x of c.territories) if (x.owner === 0) x.buildings = x.buildings.filter((b) => b !== 'tavern');
  t.buildings.push('tavern');
  const rival = t.adj.find((n) => c.territories[n].owner !== 0 && !c.territories[n].capital && c.territories[n].capital !== 0) ?? t.adj[0];
  c.territories[rival].owner = 1; // a land of the first rival's on the border
  return { c, home: t.id, rival };
}

describe('rumours in the tavern', () => {
  it('tell the player something true of a rival town near, and change nothing there', () => {
    const { c, home, rival } = frontier();
    RUMOUR.chance.plain = RUMOUR.chance.worldly = RUMOUR.chance.decadent = 1;
    (c.events ??= []).push({ kind: 'plague', at: rival, until: c.turn + 3 } as never);
    const before = JSON.stringify(c.territories[rival]), armies = JSON.stringify(c.armies);
    const r = rumourSeason(c)!;
    expect(r).not.toBeNull();
    expect(r.from).toBe(home);
    expect(truthsOf(c, r.about, true).map((x) => x.kind)).toContain(r.kind);
    expect(c.log[c.log.length - 1]).toBe(r.text);
    expect(r.text).toContain(c.territories[home].name);
    expect(JSON.stringify(c.territories[rival])).toBe(before);
    expect(JSON.stringify(c.armies)).toBe(armies);
  });

  it('only tells what is true: a quiet rival town gives nothing to tell', () => {
    const { c, rival } = frontier();
    c.events = [];
    c.armies = c.armies.filter((a) => a.owner === 0);
    delete c.territories[rival].folk;
    expect(truthsOf(c, rival, false)).toEqual([]);
    RUMOUR.chance.plain = RUMOUR.chance.worldly = RUMOUR.chance.decadent = 1;
    for (const t of c.territories) if (t.owner > 0) { t.folk = undefined; }
    expect(rumourSeason(c)).toBeNull();
  });

  it('is rarer in an honest house, and gives only the gist there; a gaudy one tells the numbers', () => {
    expect(RUMOUR.chance.plain).toBeLessThan(RUMOUR.chance.worldly);
    expect(RUMOUR.chance.worldly).toBeLessThan(RUMOUR.chance.decadent);
    const { c, rival } = frontier();
    const owner = c.territories[rival].owner;
    c.armies.push({ id: 990, owner, at: rival, units: { spearman: 5 }, hero: false, vet: 0, moved: false });
    const gist = truthsOf(c, rival, true).find((x) => x.kind === 'army')!, told = truthsOf(c, rival, false).find((x) => x.kind === 'army')!;
    expect(gist.text).not.toMatch(/\d/);
    expect(told.text).toMatch(/\d+ companies/);
    // Over many seasons an honest house hears less often than one that never shuts.
    const heard = (virtue: number): number => {
      const { c: d, home } = frontier();
      d.territories[home].virtue = virtue;
      (d.events ??= []).push({ kind: 'plague', at: d.territories[home].adj.find((n) => d.territories[n].owner > 0)!, until: 10_000 } as never);
      let n = 0;
      for (let s = 0; s < 400; s++) { d.turn++; if (rumourSeason(d)) n++; }
      return n;
    };
    expect(heard(0)).toBeLessThan(heard(-90));
  });
});
