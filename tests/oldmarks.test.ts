// The old people of a taken town are people, marked by name (src/sim/oldmarks.ts, with oldfolk.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { OLD, oldSeason } from '../src/sim/oldfolk';
import { namedOf, oldLine, oldOut, seatOld } from '../src/sim/oldmarks';
import { townTaken } from '../src/sim/conquered';
import { Census, folkOf, musterFolk, settleFolk } from '../src/sim/township';
import { Game } from '../src/sim/game';
import { setups } from './helpers';

/** A town of a rival's, with some of its people known by name, taken by the player. */
const taken = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner === 1)!;
  const f = folkOf(c, t.id); f.men = 16; f.women = 16; f.elders = 0; f.children = 6; delete f.ages; f.wed = 16;
  f.notables = [{ name: 'Aldis', family: 'Harrow', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 0, kids: 3 }];
  f.widowed = [{ name: 'Wenna', family: 'Cole', female: true, of: 'Oswin', since: 0, kids: 1 }];
  (f as { households?: unknown }).households = { turn: 0, list: [{ at: [1, 1], family: 'Fenn', m: { name: 'Bram', seasons: 100 }, f: { name: 'Edda', seasons: 96 } }] };
  townTaken(c, t.id, 1, 0); t.owner = 0;
  return { c, tid: t.id };
};

describe('the old people of a taken town, by name', () => {
  it('when it is taken, those it knows by name are its old people by name; the rest are counted', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    for (const n of ['Aldis', 'Bram', 'Edda', 'Wenna']) expect(namedOf(t)).toContain(n);
    expect(t.oldFolk!.n).toBeGreaterThan(t.oldFolk!.names!.length);
    expect(t.oldFolk!.names!.sort()).toEqual(namedOf(t).slice(0, t.oldFolk!.n).sort()); // every one it knows by name
  });

  it('they become the holder\'s at the rate they always did, the named among them in their share', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    const was = t.oldFolk!.n, named = t.oldFolk!.names!.length;
    t.yoke!.resent = 0;
    oldSeason(c, t);
    const go = Math.ceil(was * (OLD.ease + OLD.settled));
    expect(t.oldFolk!.n).toBe(Math.max(0, was - go)); // the count as it always was
    expect(t.oldFolk!.names!.length).toBe(named - Math.round((go * named) / was));
    expect(t.oldFolk!.names!.length).toBeLessThanOrEqual(t.oldFolk!.n);
  });

  it('a campaign saved when they were only a count still turns: the count is the rest', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    t.oldFolk = { from: 1, n: 30 };
    oldSeason(c, t);
    expect(t.oldFolk!.names).toEqual([]);
    expect(t.oldFolk!.n).toBeLessThan(30);
  });

  it('on the field the named are marked by name and the rest\'s share by lot; as it ends the marked who live are the named', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    const before = t.oldFolk!.n;
    const m = musterFolk(c, tid), old = m.people.old!;
    expect(old.from).toBe(1);
    expect(old.names.length).toBe(t.oldFolk!.names!.length);
    expect(old.rest).toBeGreaterThan(0);
    expect(old.who).toBeTruthy();
    // The field: villagers, two of them by the names the map knows.
    const g = new Game(7, setups);
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    for (let k = 0; k < 12; k++) { const u = g.spawnUnit('villager', 0, tc.x + 3 + (k % 4), tc.y + 3 + Math.floor(k / 4), k % 2 ? 'm' : 'f'); if (k === 0) u.name = 'Edda'; if (k === 1) u.name = 'Bram'; }
    const marked = seatOld(g, 0, { ...old, rest: 3 });
    const mine = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.oldOf === 1);
    expect(marked).toBe(mine.length);
    expect(mine.some((u) => u.name === 'Edda') && mine.some((u) => u.name === 'Bram')).toBe(true);
    expect(oldLine(mine[0])).toContain('not yet of yours');
    expect(oldLine(g.units.find((u) => u.owner === 0 && u.type === 'villager' && u.oldOf === undefined)!)).toBe('');
    // As it ends: the marked who live are handed back by name, and the share held at home stays.
    const out = oldOut(g, 0).old!;
    expect(out.names.length).toBe(mine.length);
    const home = t.oldFolk!.home!;
    const census: Census = { men: m.people.men, women: m.people.women, elders: m.people.elders, children: m.people.children, stores: m.stores, named: m.people.named ?? [], ages: m.people.ages, old: out };
    settleFolk(c, tid, census);
    expect(t.oldFolk!.names!.sort()).toEqual([...new Set(out.names)].sort());
    expect(t.oldFolk!.n).toBe(t.oldFolk!.names!.length + home);
    expect(t.oldFolk!.home).toBeUndefined();
    expect(before).toBeGreaterThan(0);
  });

  it('a field that hands none of them back: those sent are gone, those at home stay', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    const m = musterFolk(c, tid), home = t.oldFolk!.home!;
    settleFolk(c, tid, { men: m.people.men, women: m.people.women, elders: m.people.elders, children: m.people.children, stores: m.stores, named: m.people.named ?? [], ages: m.people.ages });
    expect(t.oldFolk!.names).toEqual([]);
    expect(t.oldFolk!.n).toBe(home);
  });
});
