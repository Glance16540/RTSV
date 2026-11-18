// How many of a town's people stand on the field (src/sim/fieldcap.ts), and that the rest are kept and joined back.
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { GROWN_SEASON, OLD_SEASON, countFrom } from '../src/sim/ageing';
import type { Ages } from '../src/sim/ageing';
import { FIELD_CAP, needsOf, splitField } from '../src/sim/fieldcap';
import { wedOf } from '../src/sim/marriage';
import { Census, Notable, folkOf, musterFolk, settleFolk } from '../src/sim/township';

/** A town of so many men, women, old and children, with ages spread out. */
const ages = (men: number, women: number, old: number, kids: number): Ages => ({
  m: [...Array.from({ length: men }, (_, i) => GROWN_SEASON + ((i * 7) % 160)), ...Array.from({ length: Math.ceil(old / 2) }, (_, i) => OLD_SEASON + 4 + i)],
  f: [...Array.from({ length: women }, (_, i) => GROWN_SEASON + 1 + ((i * 11) % 160)), ...Array.from({ length: Math.floor(old / 2) }, (_, i) => OLD_SEASON + 6 + i)],
  k: Array.from({ length: kids }, (_, i) => i % 50),
});
const mother = (name: string, husband?: string): Notable => ({ name, family: 'Harrow', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 0, kids: 3, ...(husband ? { husband } : {}) });
/** A town of the player's at this size. */
const bigTown = (men: number, women: number, old: number, kids: number) => {
  const c = bareCampaign(5, 1, 1, 'hearth'), t = c.territories.find((x) => x.capital === 0)!, f = folkOf(c, t.id);
  f.notables = []; delete f.widowed; delete f.orphans; delete f.drifted; delete f.fieldHome;
  countFrom(f, ages(men, women, old, kids)); f.wed = Math.min(men, women);
  return { c, tid: t.id, f };
};
/** The census a battle would hand back if nobody on the field died: just what was sent. */
const unchanged = (p: ReturnType<typeof musterFolk>): Census => ({ men: p.people.men, women: p.people.women, elders: p.people.elders, children: p.people.children, stores: p.stores, named: p.people.named ?? [], ages: p.people.ages, ...(p.people.widowed ? { widowed: p.people.widowed } : {}), ...(p.people.orphans ? { orphans: p.people.orphans } : {}) });

describe('the field takes at most FIELD_CAP of a town\'s grown', () => {
  it('a town no larger than the cap goes whole, and nothing is held back', () => {
    const { c, tid, f } = bigTown(16, 16, 6, 28);
    const p = musterFolk(c, tid);
    expect([p.people.men, p.people.women, p.people.elders, p.people.children]).toEqual([16, 16, 6, 28]);
    expect(f.fieldHome).toBeUndefined();
  });

  it('a larger town: at most the cap of its grown, every child, the old in their share, couples before singles', () => {
    const { c, tid, f } = bigTown(70, 70, 40, 90);
    const p = musterFolk(c, tid), g = p.people;
    expect(g.men + g.women + g.elders).toBe(FIELD_CAP);
    expect(g.children).toBe(90);
    expect(g.elders).toBe(Math.round((40 * FIELD_CAP) / 180));
    expect(Math.abs(g.men - g.women)).toBeLessThanOrEqual(1); // in pairs
    expect(f.fieldHome!.m.length + f.fieldHome!.f.length).toBe(180 - FIELD_CAP);
    expect([f.men, f.women, f.elders]).toEqual([70, 70, 40]); // the record is not touched while the battle is fought
  });

  it('a town a little over the cap, as a capital is founded at four times the size: the cap, couples whole, and written back whole', () => {
    const { c, tid, f } = bigTown(20, 20, 8, 28); // 48 grown
    f.notables.push(mother('Aldis', 'Bram'));
    const p = musterFolk(c, tid), g = p.people;
    expect(g.men + g.women + g.elders).toBe(FIELD_CAP);
    expect(g.elders).toBe(Math.round((8 * FIELD_CAP) / 48));
    expect(Math.abs(g.men - g.women)).toBeLessThanOrEqual(1); // couples (the town being all married), and one single where the room is odd
    expect(Math.min(g.men, g.women)).toBe(Math.floor((FIELD_CAP - g.elders) / 2));
    expect(g.children).toBe(28);
    expect(g.named?.map((n) => n.name)).toEqual(['Aldis']);
    expect(f.fieldHome!.m.length + f.fieldHome!.f.length).toBe(48 - FIELD_CAP);
    settleFolk(c, tid, unchanged(p));
    expect([f.men, f.women, f.elders, f.children]).toEqual([20, 20, 8, 28]);
    expect(wedOf(f)).toBe(20);
    expect(f.notables.find((n) => n.name === 'Aldis')?.lost).toBeUndefined();
  });

  it('the young go first among men and women, and the men who take up arms go whatever the cap', () => {
    const a = ages(70, 10, 0, 0);
    const { field } = splitField(a, 10, { men: 60, women: 0 }, 40);
    expect(field.m.length).toBe(60);
    expect(field.m).toEqual([...a.m].sort((x, y) => x - y).slice(0, 60));
    expect(field.f.length).toBe(0); // no room left
    const even = splitField(ages(70, 70, 0, 0), 2, { men: 0, women: 0 }, 20).field;
    expect(even.m.length + even.f.length).toBe(20);
  });

  it('the named, their husbands, the widowed and the drifted must go', () => {
    expect(needsOf({ named: [{ gender: 'f', husband: 'Bram' }, { gender: 'f' }], widowed: [{ female: true }, { female: false }], drifted: { tavern: 2, mines: 3 } }, 1)).toEqual({ men: 1 + 1 + 3, women: 2 + 1 + 2 });
    expect(needsOf({}, 9)).toEqual({ men: 9, women: 0 });
  });
});

describe('written back, those held back are the town\'s still', () => {
  it('nobody on the field died: the town is as it was, every count and age, its couples and its named', () => {
    const { c, tid, f } = bigTown(70, 70, 40, 90);
    f.notables.push(mother('Aldis', 'Bram'));
    f.widowed = [{ name: 'Wenna', family: 'Cole', female: true, of: 'Oswin', since: 3, kids: 1 }];
    f.orphans = [{ family: 'Cole', into: 'Harrow', since: 3, count: 2 }];
    const was = { m: [...f.ages!.m].sort(), f: [...f.ages!.f].sort(), k: [...f.ages!.k].sort() };
    const p = musterFolk(c, tid);
    expect(p.people.named?.map((n) => n.name)).toEqual(['Aldis']);
    expect(p.people.widowed?.map((w) => w.name)).toEqual(['Wenna']);
    settleFolk(c, tid, unchanged(p));
    expect([f.men, f.women, f.elders, f.children]).toEqual([70, 70, 40, 90]);
    expect({ m: [...f.ages!.m].sort(), f: [...f.ages!.f].sort(), k: [...f.ages!.k].sort() }).toEqual(was);
    expect(f.fieldHome).toBeUndefined();
    expect(wedOf(f)).toBe(70); // no couple unmade
    expect(f.notables.find((n) => n.name === 'Aldis')?.lost).toBeUndefined(); // she was on the field, and lives
    expect(f.widowed?.map((w) => w.name)).toEqual(['Wenna']);
    expect(f.widowed?.[0].since).toBe(3);
    expect(f.orphans?.[0].count).toBe(2);
  });

  it('those who fell on the field are gone; those held back are not touched', () => {
    const { c, tid, f } = bigTown(70, 70, 40, 90);
    const p = musterFolk(c, tid), back = unchanged(p);
    back.ages = { m: back.ages!.m.slice(5), f: back.ages!.f, k: back.ages!.k }; // five men fell
    back.men -= p.people.ages!.m.slice(0, 5).filter((s) => s < OLD_SEASON).length; back.elders -= p.people.ages!.m.slice(0, 5).filter((s) => s >= OLD_SEASON).length;
    settleFolk(c, tid, back);
    expect(f.men + f.elders).toBe(70 + 40 - 5); // all the town's men and old, less the five
    expect(f.women).toBe(70);
  });

  it('a census with no ages still joins the held-back counts', () => {
    const { c, tid, f } = bigTown(70, 70, 40, 90);
    const p = musterFolk(c, tid), back = unchanged(p);
    delete back.ages;
    settleFolk(c, tid, back);
    expect([f.men, f.women, f.elders]).toEqual([70, 70, 40]);
  });

  it('the held-back are saved with the campaign while the battle is fought', () => {
    const { c, tid } = bigTown(70, 70, 40, 90);
    const p = musterFolk(c, tid);
    const saved = JSON.parse(JSON.stringify(c));
    settleFolk(saved, tid, unchanged(p));
    const g = folkOf(saved, tid);
    expect([g.men, g.women, g.elders]).toEqual([70, 70, 40]);
  });
});
