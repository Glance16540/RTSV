// The player's nation carries people off when its standing is Dissolute or Depraved, by the rule rivals have
// (src/sim/carriedoff.ts): the grown only, never a child, held as a record and told plainly; nothing of it is shown.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { CARRY, carriedAt, carriedOf, carriedSeason, carriesOff, townFell } from '../src/sim/carriedoff';
import { heldLeft } from '../src/sim/rivalcaptives';
import { folkOf, headcount } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** The player at `virtue`, a rival's town it is about to take, and the player's own town its army came from. */
const world = (virtue: number): { c: Campaign; town: number; home: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.turn = 10;
  const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
  c.factions[0].virtue = virtue;
  for (const t of c.territories) if (t.owner === 0) delete t.virtue;
  const home = c.territories.find((x) => x.owner === 0)!, t = c.territories.find((x) => x.owner === rival)!;
  Object.assign(folkOf(c, t.id), { men: 10, women: 12, elders: 2, children: 5 }); delete folkOf(c, t.id).ages;
  Object.assign(folkOf(c, home.id), { men: 6, women: 6, elders: 0, children: 2 }); delete folkOf(c, home.id).ages;
  return { c, town: t.id, home: home.id, rival };
};
const seasons = (c: Campaign, k: number): void => { for (let i = 0; i < k; i++) { c.turn++; carriedSeason(c); } };

describe('the player\'s nation carries people off by the rivals\' rule', () => {
  it('only at a Dissolute or Depraved standing, as a rival does', () => {
    for (const [virtue, does] of [[90, false], [40, false], [0, false], [-40, true], [-90, true]] as [number, boolean][]) {
      const { c, town, home, rival } = world(virtue);
      expect(carriesOff(c, 0)).toBe(does);
      expect(!!townFell(c, town, rival, 0, home)).toBe(does);
    }
  });
  it('the grown only: no child is taken, the town keeps its children and its old, and is left men and women of its own', () => {
    const { c, town, home, rival } = world(-90), f = folkOf(c, town);
    const kids = f.children, old = f.elders;
    const x = townFell(c, town, rival, 0, home)!;
    expect(x.by).toBe(0);
    expect(x.at).toBe(home);
    expect(x.held.owner).toBe(rival);
    expect(folkOf(c, town).children).toBe(kids);
    expect(folkOf(c, town).elders).toBe(old);
    for (const age of [...x.held.men, ...x.held.women]) expect(age).toBeGreaterThanOrEqual(18 * 4 - 12); // seasons of age: grown people, of working age
    expect(folkOf(c, town).men).toBeGreaterThanOrEqual(1);
    expect(folkOf(c, town).women).toBeGreaterThanOrEqual(1);
    expect(x.held.women.length).toBeLessThanOrEqual(Math.ceil(12 * CARRY.women) + 1);
    expect(x.held.men.length).toBeLessThanOrEqual(Math.ceil(10 * CARRY.men) + 1);
  });
  it('the player is told plainly what was done and what follows, and nothing more', () => {
    const { c, town, home, rival } = world(-90);
    townFell(c, town, rival, 0, home);
    const line = c.log[c.log.length - 1];
    expect(line).toMatch(/^Your people led away .* of .* to .* when the town fell\. Held 4 seasons, they are yours for good; if .* is lost before then they go home\.$/);
    expect(line).not.toMatch(/child/i);
  });
  it('they can be got back for four seasons: lose the land they are held in and they go home; after that they are the player\'s people', () => {
    const lost = world(-90);
    const x = townFell(lost.c, lost.town, lost.rival, 0, lost.home)!;
    const gone = x.held.men.length + x.held.women.length;
    const was = headcount(folkOf(lost.c, lost.town));
    seasons(lost.c, 2);
    expect(heldLeft(lost.c, lost.rival, lost.home)).toBe(CARRY.seasons - 2); // their own people weigh the clock (rivalcaptives.ts)
    townFell(lost.c, lost.home, 0, lost.rival, lost.town); // the land they are held in falls to their people
    expect(carriedOf(lost.c, lost.rival).length).toBe(0);
    expect(headcount(folkOf(lost.c, lost.town))).toBe(was + gone); // home again
    const kept = world(-90);
    const y = townFell(kept.c, kept.town, kept.rival, 0, kept.home)!;
    const n = y.held.men.length + y.held.women.length, before = folkOf(kept.c, kept.home).men + folkOf(kept.c, kept.home).women;
    seasons(kept.c, CARRY.seasons);
    expect(carriedAt(kept.c, kept.home).length).toBe(0);
    expect(folkOf(kept.c, kept.home).men + folkOf(kept.c, kept.home).women).toBe(before + n); // on the holding town's record
    expect(kept.c.log.some((l) => /of your people now, at /.test(l))).toBe(true);
  });
  it('a people at an ordinary standing that takes a town leads nobody away, and frees anyone held there', () => {
    const { c, town, home, rival } = world(0);
    const before = headcount(folkOf(c, town));
    expect(townFell(c, town, rival, 0, home)).toBeNull();
    expect(headcount(folkOf(c, town))).toBe(before);
    expect((c.carried ?? []).length).toBe(0);
  });
});
