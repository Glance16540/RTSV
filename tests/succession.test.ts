// Who follows a fallen leader, and what each choice costs (src/sim/succession.ts, thronemoods.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import '../src/sim/wifetaken';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { kinOf } from '../src/sim/kin';
import { noblesOf } from '../src/sim/nobles';
import { recordChild } from '../src/sim/claimants';
import { claimantsSeason } from '../src/sim/claimantrising';
import { folkOf } from '../src/sim/township';
import { SUCCESSION } from '../src/sim/bothhouses';
import type { Pact } from '../src/sim/pacts';
import { chooseSuccessor, successionChoices, takeUp } from '../src/sim/succession';
import { THRONE_MOODS } from '../src/sim/thronemoods';

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
/** A grown claimant in arms for the player's throne, his seat the worldly town; then the leader falls with no heir of age. */
const inArms = () => {
  const w = world();
  const cl = recordChild(w.c, { owner: 0, mother: 'Maren', parent: 'noble', by: 'Aldric, Lord of the place', town: w.other.town });
  cl.key = w.other.key;
  w.c.turn += HEIR_AGE;
  claimantsSeason(w.c); // he comes of age, and his seat rises
  expect(cl.towns?.length).toBeGreaterThan(0);
  w.c.factions[0].heroAlive = false;
  houseOf(w.c, 0).heirs = [{ name: 'Elin', female: true, born: w.c.turn - 4 }];
  return { ...w, cl };
};
const captain = (c: Campaign, at: number): void => { c.armies.push({ id: 900, owner: 0, at, units: { spearman: 3 }, hero: false, vet: 3, moved: false }); };
const moods = (c: Campaign): Record<string, number> => Object.fromEntries(noblesOf(c, 0).map((n) => [n.name, n.mood]));

describe('the order of the throne', () => {
  it('an heir of age first, with nothing to pay; a captain after, setting the house aside', () => {
    const { c, cap } = world();
    c.factions[0].heroAlive = false;
    houseOf(c, 0).heirs = [{ name: 'Osric', female: false, born: c.turn - HEIR_AGE - 4 }];
    captain(c, cap.id);
    const all = successionChoices(c, 0);
    expect(all.map((x) => x.kind)).toEqual(['heir', 'captain']);
    expect(all[0].cost).toContain('The house goes on');
    expect(all[1].cost).toContain('Osric is set aside');
    expect(all[1].cost).toContain(`moods fall by ${THRONE_MOODS.setAside}`);
  });

  it('a claimant in arms comes before any captain, once the line has failed, and says what he brings back', () => {
    const { c, cap, cl, ring } = inArms();
    captain(c, cap.id);
    const all = successionChoices(c, 0);
    expect(all.map((x) => x.kind)).toEqual(['rising', 'captain']);
    expect(all[0].name).toBe(cl.name);
    expect(all[0].cost).toContain(ring[0].name);
    expect(all[0].cost).toContain('Aldric');
    expect(all[1].cost).toContain(`The rising for ${cl.name} goes on`);
    expect(all[1].cost).toContain(`${ring[0].name} stays free`);
  });

  it('a claimant in arms has no say while an heir of the house is of age', () => {
    const { c, cl } = inArms();
    houseOf(c, 0).heirs.push({ name: 'Osric', female: false, born: c.turn - HEIR_AGE - 1 });
    expect(successionChoices(c, 0).some((x) => x.rising === cl.id)).toBe(false);
  });

  it('a child of both houses before a claimant in arms, telling the peace it brings', () => {
    const { c, cl } = inArms();
    const p: Pact = { kind: 'marriage', a: 0, b: 1, since: c.turn - HEIR_AGE - 8, until: c.turn - 2, wed: ['Ada', 'Bran'], child: { name: 'Hugo', female: false, born: c.turn - HEIR_AGE - 4 } };
    (c.pacts ??= []).push(p);
    const all = successionChoices(c, 0);
    expect(all.map((x) => x.kind)).toEqual(['blood', 'rising']);
    expect(all[0].cost).toContain(`${SUCCESSION.peace} seasons`);
    expect(all[1].rising).toBe(cl.id);
  });
});

describe('what each choice does', () => {
  it('the claimant in arms taken up: his towns come back, the lord who held him is pleased, the others not', () => {
    const { c, cl, ring } = inArms();
    const was = moods(c);
    const pick = successionChoices(c, 0).find((x) => x.kind === 'rising')!;
    expect(takeUp(c, 0, pick)).toBe(true);
    expect(c.factions[0].heroAlive).toBe(true);
    expect(c.factions[0].hero!.name).toBe(cl.name);
    expect(cl.ended?.how).toBe('crowned');
    expect(ring[0].owner).toBe(0);
    const now = moods(c);
    expect(now.Aldric - was.Aldric).toBe(THRONE_MOODS.raised);
    for (const name of ['Bram', 'Cyra', 'Dunn']) expect(now[name] - was[name]).toBe(-THRONE_MOODS.usurper);
  });

  it('a captain raised over the claimant: the rising stands, and every lord takes the blood set aside ill', () => {
    const { c, cap, cl, ring } = inArms();
    captain(c, cap.id);
    const was = moods(c);
    const pick = successionChoices(c, 0).find((x) => x.kind === 'captain')!;
    expect(takeUp(c, 0, pick)).toBe(true);
    expect(cl.ended).toBeUndefined();
    expect(ring[0].owner).not.toBe(0);
    const now = moods(c);
    for (const name of Object.keys(was)) expect(now[name] - was[name]).toBe(-THRONE_MOODS.setAside);
  });

  it('a captain raised with nobody of the blood to set aside moves nobody', () => {
    const { c, cap } = world();
    c.factions[0].heroAlive = false;
    houseOf(c, 0).heirs = [];
    captain(c, cap.id);
    const was = moods(c);
    expect(successionChoices(c, 0).map((x) => x.kind)).toEqual(['captain']);
    expect(chooseSuccessor(c, 0)).toBe(true);
    expect(moods(c)).toEqual(was);
  });

  it('the computer chooses by the order of the throne: the claimant in arms over a captain', () => {
    const { c, cap, cl } = inArms();
    captain(c, cap.id);
    expect(chooseSuccessor(c, 0)).toBe(true);
    expect(c.factions[0].hero!.name).toBe(cl.name);
  });

  it('a claimant crowned as the season turns, the choice put off, is taken as the lords take it', () => {
    const { c } = inArms();
    const was = moods(c);
    c.turn++; claimantsSeason(c);
    expect(c.factions[0].heroAlive).toBe(true);
    expect(moods(c).Aldric - was.Aldric).toBe(THRONE_MOODS.raised);
  });

  it('nothing to choose while the leader lives', () => {
    const { c } = world();
    expect(successionChoices(c, 0)).toEqual([]);
    expect(chooseSuccessor(c, 0)).toBe(false);
  });
});
