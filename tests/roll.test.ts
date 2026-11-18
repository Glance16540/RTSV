// The roll of a people, for the "Your people" screen (src/sim/roll.ts).
import { yearsFromBirth } from '../src/sim/ageing';
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { RECENT, rollOf } from '../src/sim/roll';
import { folkOf } from '../src/sim/township';
import { THREATS } from '../src/sim/threats';

/** A named nation of two towns, with known people, men away, captives held and one lost. */
function world(): { c: Campaign; home: number; other: number } {
  const c = newCampaign(7, 1, 1, 'japan', { names: { people: 'Ashfolk', house: 'Varn' } });
  const home = c.territories.find((t) => t.capital === 0)!;
  const other = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id))!;
  other.owner = 0;
  const f = folkOf(c, home.id);
  f.notables = [
    { name: 'Aiko', gender: 'f', kind: 'mother', deed: 'raised four children', turn: 1, kids: 4 },
    { name: 'Ren', gender: 'm', kind: 'veteran', deed: 'felled 9 in battle as a spearman', turn: 2, kills: 9, unit: 'Spearman' },
    { name: 'Old Sora', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 1, lost: { turn: c.turn, how: 'killed' } },
    { name: 'Long Gone', gender: 'm', kind: 'veteran', deed: 'felled 5', turn: 1, lost: { turn: c.turn - RECENT - 1, how: 'fell in battle' } },
  ];
  c.musters = { 77: { size: 1, men: { [home.id]: [80, 90] } } };
  (c.bands ??= []).push({ id: 5, kind: 'slavers', name: 'the Chain', at: other.adj.find((x) => x !== home.id) ?? home.adj[0], strength: 3, since: c.turn, held: [{ from: other.id, owner: 0, men: [70], women: [80, 90], since: c.turn - 1, names: ['Mai'] }] });
  houseOf(c, 0);
  return { c, home: home.id, other: other.id };
}

describe('the roll of your people', () => {
  it('names the people and their house, who leads them and where, and the heirs with their ages', () => {
    const { c } = world();
    const r = rollOf(c);
    expect(r.people).toBe('Ashfolk');
    expect(r.house).toBe('Varn');
    expect(r.leader.alive).toBe(true);
    expect(r.leader.name.length).toBeGreaterThan(0);
    const h = houseOf(c, 0).heirs[0];
    expect(r.heirs[0]).toEqual({ name: h.name, female: h.female, years: Math.floor(yearsFromBirth(c.turn - h.born)), ofAge: c.turn - h.born >= HEIR_AGE, toAge: Math.ceil(Math.max(0, HEIR_AGE - (c.turn - h.born)) / 4), parent: h.parent }); // a child's years run 1.2 a year (ageing.ts)
    expect(h.parent).toBe(r.spouse!.name); // the other parent is the leader's husband or wife (kin.ts)
  });

  it('lists every person known by name town by town, and counts the children without listing them', () => {
    const { c, home, other } = world();
    const r = rollOf(c);
    expect(r.towns.map((t) => t.id)).toEqual([home, other]); // the capital first
    const t = r.towns[0], f = folkOf(c, home);
    expect(t).toMatchObject({ men: f.men, women: f.women, elders: f.elders, children: f.children });
    expect(t.notables.map((p) => p.name)).toEqual(['Aiko', 'Ren']); // the lost are not among the living
    expect(t.notables[1]).toMatchObject({ kind: 'veteran', unit: 'Spearman', townName: c.territories[home].name });
    expect(r.totals.children).toBe(r.towns.reduce((n, x) => n + x.children, 0));
    expect(r.totals.known).toBe(2);
    for (const x of r.towns) for (const p of x.notables) expect(['mother', 'veteran']).toContain(p.kind); // nobody listed is a child
  });

  it('counts the men away with the armies by town, and the captives held, with the seasons left to get them back', () => {
    const { c, home, other } = world();
    const r = rollOf(c);
    expect(r.towns.find((t) => t.id === home)!.away).toBe(2);
    expect(r.totals.away).toBe(2);
    expect(r.captives).toEqual([{ band: 'the Chain', kind: 'Slavers', place: c.territories[c.bands![0].at].name, from: c.territories[other].name, men: 1, women: 2, seasonsLeft: THREATS.holdFor - 1, names: ['Mai'] }]);
    expect(r.totals.held).toBe(3);
  });

  it('lists those lost of late, newest first, and not those lost long ago', () => {
    const { c } = world();
    const r = rollOf(c);
    expect(r.lost.map((p) => p.name)).toEqual(['Old Sora']);
    expect(r.lost[0]).toMatchObject({ how: 'killed', turn: c.turn });
  });

  it('changes nothing it reads', () => {
    const { c } = world();
    const before = JSON.stringify(c);
    rollOf(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});
