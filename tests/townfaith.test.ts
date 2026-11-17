// Faith is a town's (docs/DESIGN.md; src/sim/townfaith.ts).
import { describe, expect, it } from 'vitest';
import { folkOf } from '../src/sim/township';
import { BATTLE_VIRTUE, CHURCH_VIRTUE, Campaign, TAVERN_VIRTUE, answerDemand, battleConfig, continueAI, endTurn, finishBattle, moveArmy, newCampaign, resolvePending, shiftVirtue, virtueOf } from '../src/sim/campaign';
import { PULL, faithAt, faithSpread, nationVirtue, pullTogether, seasonOfFaith, settleFaith, swayNation, swayTown, townDrift } from '../src/sim/townfaith';

const LONG = 60_000;
const turn = (c: Campaign) => {
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};
/** A nation of three towns: its capital and two lands beside it, with no army of anyone's about. */
const realm = (seed = 7) => {
  const c = newCampaign(seed, 1, 0, 'steppe'), home = c.territories.find((t) => t.capital === 0)!;
  const [a, b] = c.territories.filter((t) => t.id !== home.id && t.capital < 0 && !t.wild).slice(0, 2);
  a.owner = b.owner = 0; a.buildings = []; b.buildings = []; home.buildings = [];
  c.places = [];
  c.truces = [{ with: 1, until: 999 }];
  return { c, home, a, b };
};

describe('faith is a town\'s', () => {
  it('a town nobody has asked after stands where its nation does, and a tribe\'s town in the middle', () => {
    const { c, home, a } = realm();
    c.factions[0].virtue = 30;
    expect(faithAt(c, home.id)).toBe(30);
    expect(faithAt(c, a.id)).toBe(30);
    expect(faithAt(c, c.territories.find((t) => t.owner < 0)!.id)).toBe(0);
    settleFaith(c);
    expect(home.virtue).toBe(30);
    expect(virtueOf(c, 0)).toBe(30); // nothing has moved by writing it down
  }, LONG);

  it('the nation\'s standing is its towns\' taken together, and towns of one nation may stand apart', () => {
    const { c, home, a, b } = realm();
    expect(swayTown(c, a.id, 60)).toBe(60);
    expect(faithAt(c, home.id)).toBe(0);
    expect(faithAt(c, b.id)).toBe(0);
    expect(nationVirtue(c, 0)).toBe(20);
    expect(virtueOf(c, 0)).toBe(20);
    swayTown(c, b.id, -90);
    expect(virtueOf(c, 0)).toBe(-10);
    expect(faithSpread(c, 0)).toEqual({ low: -90, high: 60, spread: 150, towns: 3 });
    swayTown(c, a.id, 500);
    expect(faithAt(c, a.id)).toBe(100); // the scale ends where it always did
  }, LONG);

  it('a church or a tavern moves the town it stands in, season by season, and no other', () => {
    const { c, home, a, b } = realm();
    a.buildings = ['church']; b.buildings = ['tavern'];
    expect(townDrift(c, a.id)).toBe(CHURCH_VIRTUE);
    expect(townDrift(c, b.id)).toBe(-TAVERN_VIRTUE);
    expect(townDrift(c, home.id)).toBe(0);
    turn(c);
    // Each moved by its own house, and was then drawn a little way back toward the nation (which stands at 0).
    expect(faithAt(c, a.id)).toBe(CHURCH_VIRTUE - Math.round(CHURCH_VIRTUE * PULL));
    expect(faithAt(c, b.id)).toBe(-TAVERN_VIRTUE + Math.round(TAVERN_VIRTUE * PULL));
    expect(faithAt(c, home.id)).toBe(0);
    // The nation stands at the mean of its towns: a Church and a Tavern of different weight leave it a point off 0 at most.
    expect(Math.abs(virtueOf(c, 0))).toBeLessThanOrEqual(1);
  }, LONG);

  it('the pull: a church or a tavern holds a town apart from its nation only so far', () => {
    const { c, home, a, b } = realm();
    a.buildings = ['church']; b.buildings = ['tavern'];
    // Eighty seasons of faith alone: nothing else that befalls a town on the map is in play here.
    for (let i = 0; i < 80; i++) seasonOfFaith(c, (f, by, at) => shiftVirtue(c, f, by, { at }));
    // Where a season's move is what the pull takes back: a Church's and a Tavern's each its own.
    const mean = virtueOf(c, 0), up = CHURCH_VIRTUE / PULL, down = TAVERN_VIRTUE / PULL, limit = Math.max(up, down);
    expect(faithAt(c, a.id) - mean).toBeGreaterThan(up - 12);
    expect(faithAt(c, a.id) - mean).toBeLessThanOrEqual(up + 4);
    expect(mean - faithAt(c, b.id)).toBeGreaterThan(down - 12);
    expect(mean - faithAt(c, b.id)).toBeLessThanOrEqual(down + 4);
    expect(a.owner).toBe(0); expect(b.owner).toBe(0);
    // A town with neither stands with its nation, behind it only as far as the nation moves a season (the Church and the
    // Tavern of unequal weight move it (C - T) / 3 a season) against the pull.
    expect(Math.abs(faithAt(c, home.id) - mean)).toBeLessThanOrEqual(4 + Math.abs(CHURCH_VIRTUE - TAVERN_VIRTUE) / 3 / PULL);
    expect(faithSpread(c, 0).spread).toBeLessThanOrEqual(2 * limit + 8);
  }, LONG);

  it('the pull draws towns together and leaves the nation where it stood', () => {
    const { c, home, a, b } = realm();
    swayTown(c, a.id, 90); swayTown(c, b.id, -60);
    const mean = virtueOf(c, 0), gap = faithSpread(c, 0).spread;
    pullTogether(c);
    expect(faithAt(c, a.id)).toBe(90 + Math.round((mean - 90) * PULL));
    expect(faithAt(c, b.id)).toBe(-60 + Math.round((mean + 60) * PULL));
    expect(faithSpread(c, 0).spread).toBeLessThan(gap);
    expect(Math.abs(virtueOf(c, 0) - mean)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 60; i++) pullTogether(c);
    expect(faithSpread(c, 0).spread).toBeLessThanOrEqual(8); // left alone they come to stand together (to within rounding)
    // A nation of one town has nothing to be drawn toward.
    const one = realm(9);
    for (const t of [one.a, one.b]) t.owner = -1;
    swayTown(one.c, one.home.id, 40);
    pullTogether(one.c);
    expect(faithAt(one.c, one.home.id)).toBe(40);
    expect(home.owner).toBe(0);
  }, LONG);

  it('what befalls the whole people moves every town; what happens in one town moves that town', () => {
    const { c, home, a, b } = realm();
    shiftVirtue(c, 0, 10);
    expect([home, a, b].map((t) => faithAt(c, t.id))).toEqual([10, 10, 10]);
    shiftVirtue(c, 0, -30, { at: b.id });
    expect([home, a, b].map((t) => faithAt(c, t.id))).toEqual([10, 10, -20]);
    expect(virtueOf(c, 0)).toBe(0);
    swayNation(c, 0, 5);
    expect([home, a, b].map((t) => faithAt(c, t.id))).toEqual([15, 15, -15]);
    // A town that is not theirs is not moved in their name.
    const other = c.territories.find((t) => t.owner === 1)!, was = faithAt(c, other.id);
    shiftVirtue(c, 0, 40, { at: other.id });
    expect(faithAt(c, other.id)).toBe(was);
  }, LONG);

  it('a nation\'s figure set by hand is still honoured: every town moves by the difference', () => {
    const { c, home, a, b } = realm();
    swayTown(c, a.id, 30);
    expect(virtueOf(c, 0)).toBe(10);
    c.factions[0].virtue = 40; // as older code and saved games do
    settleFaith(c);
    expect([home, a, b].map((t) => faithAt(c, t.id))).toEqual([30, 60, 30]);
    expect(virtueOf(c, 0)).toBe(40);
  }, LONG);

  it('a town taken keeps its own standing under its new holder', () => {
    const { c, home } = realm();
    const foe = c.territories.find((t) => t.owner === 1 && t.capital < 0) ?? c.territories.find((t) => t.capital === 1)!;
    c.factions[0].virtue = 50; c.factions[1].virtue = -60;
    settleFaith(c);
    const towns = c.territories.filter((t) => t.owner === 0).length;
    foe.owner = 0;
    settleFaith(c);
    expect(faithAt(c, foe.id)).toBe(-60);
    expect(faithAt(c, home.id)).toBe(50);
    expect(virtueOf(c, 0)).toBe(Math.round((50 * towns - 60) / (towns + 1)));
  }, LONG);

  it('a town defended in person fights as that town stands, and it is that town the fighting moves', () => {
    const { c, home, a } = realm();
    c.truces = [];
    swayTown(c, a.id, -60); // one worldly town in a middling nation
    expect(virtueOf(c, 0)).toBe(-20);
    c.armies.push({ id: 99, owner: 1, at: a.adj.find((n) => n !== home.id) ?? a.adj[0], units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    c.territories[c.armies[c.armies.length - 1].at].owner = 1;
    expect(moveArmy(c, 99, a.id)).toBe('battle');
    c.pending!.mode = 'siege';
    expect(battleConfig(c)!.setups[0].virtue).toBe(-60);
    finishBattle(c, true, { clubman: 2 }, { virtue: -20 });
    expect(faithAt(c, a.id)).toBe(-60 + (-20 - -60) * BATTLE_VIRTUE);
    expect(faithAt(c, home.id)).toBe(0);
  }, LONG);

  it('a campaign played by the computer keeps every nation\'s figure equal to its towns\'', () => {
    const c = newCampaign(11, 2, 1, 'hearth');
    for (let i = 0; i < 25 && c.phase !== 'over'; i++) {
      turn(c);
      for (const f of c.factions) if (f.alive && c.territories.some((t) => t.owner === f.id)) expect(virtueOf(c, f.id), `turn ${c.turn} ${f.name}`).toBe(nationVirtue(c, f.id));
      for (const t of c.territories) { expect(faithAt(c, t.id)).toBeGreaterThanOrEqual(-100); expect(faithAt(c, t.id)).toBeLessThanOrEqual(100); }
    }
  }, 120_000);
});
