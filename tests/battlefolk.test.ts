// A town's people in a battle (src/sim/battlefolk.ts): set down on the field at the ages the town's record has them,
// its children on its roofs' records, and the count of the side's town that a battle hands back.
import { describe, expect, it } from 'vitest';
import { SEASONS_A_YEAR, childSeasons, leftFor, yearsOf } from '../src/sim/ageing';
import { censusOf, cradled, cradledOf, peopled } from '../src/sim/battlefolk';
import { ELDER_AT, GROW_TIME } from '../src/sim/data';
import { Game, Unit } from '../src/sim/game';
import { setups } from './helpers';

const fresh = () => {
  const g = new Game(7, setups);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  return g;
};
const folkOf = (g: Game, owner: number) => g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead);
/** Who peopled() added: everyone of the side's villagers not there before. */
const added = (g: Game, owner: number, before: Unit[]) => folkOf(g, owner).filter((u) => !before.includes(u));
const seasonsOf = (u: Unit) => yearsOf(u.age, u.lifespan) * SEASONS_A_YEAR;
const st = { x: 40, y: 40 };
const roofs = (g: Game, owner: number) => g.buildings.filter((b) => b.owner === owner && !b.dead && b.complete && (b.type === 'house' || b.type === 'towncenter'));
const young = (g: Game, owner: number) => roofs(g, owner).flatMap((b) => b.young ?? []);

describe('peopled', () => {
  it('sets down the town\'s men, women and old, with no record of ages: the old in the last part of their lives, the rest before it', () => {
    const g = fresh(), before = folkOf(g, 0);
    peopled(g, 0, { men: 3, women: 2, elders: 2, children: 0 }, st, 1);
    const now = added(g, 0, before);
    expect(now.length).toBe(7);
    expect(now.filter((u) => u.gender === 'm').length).toBe(4); // three men and one of the old
    expect(now.filter((u) => u.gender === 'f').length).toBe(3);
    const old = now.filter((u) => u.age >= u.lifespan * ELDER_AT);
    expect(old.length).toBe(2);
    for (const u of now) expect(Math.hypot(u.x - st.x, u.y - st.y)).toBeLessThan(10); // about where they were set
  });

  it('counts that are not counts are nought, and none is set down for them', () => {
    const g = fresh(), before = folkOf(g, 0);
    peopled(g, 0, { men: -3, women: 'many' as never, elders: NaN, children: 0 }, st, 1);
    expect(added(g, 0, before).length).toBe(0);
    peopled(g, 0, { men: 1.6, women: 0.2, elders: 0, children: 0 }, st, 1); // rounded
    expect(added(g, 0, before).length).toBe(2);
  });

  it('with a record of ages that counts them all, each is set down at the age the record has them', () => {
    const g = fresh(), before = folkOf(g, 0);
    peopled(g, 0, { men: 2, women: 1, elders: 0, children: 0, ages: { m: [100, 200], f: [150], k: [] } }, st, 1);
    const now = added(g, 0, before);
    expect(now.length).toBe(3);
    const men = now.filter((u) => u.gender === 'm').map(seasonsOf).sort((a, b) => a - b);
    expect(men[0]).toBeCloseTo(100, 6);
    expect(men[1]).toBeCloseTo(200, 6);
    expect(seasonsOf(now.find((u) => u.gender === 'f')!)).toBeCloseTo(150, 6);
  });

  it('a record of ages that does not count them all is not used', () => {
    const g = fresh(), before = folkOf(g, 0);
    peopled(g, 0, { men: 2, women: 2, elders: 0, children: 0, ages: { m: [100], f: [150], k: [] } }, st, 1);
    const now = added(g, 0, before);
    expect(now.length).toBe(4);
    expect(now.filter((u) => u.gender === 'm').length).toBe(2);
  });

  it('those the nation knows by name are among them, with their house and their children; a name that is no name is passed over', () => {
    const g = fresh(), before = folkOf(g, 0);
    const long = 'A'.repeat(60);
    peopled(g, 0, {
      men: 2, women: 2, elders: 0, children: 0,
      named: [{ name: 'Aelfrun', gender: 'f', family: 'Ash', kids: 4 }, { name: long, gender: 'm', kids: 2.6 }, { name: '', gender: 'f', kids: 1 }, { name: 5 as never, gender: 'm' }],
    }, st, 1);
    const now = added(g, 0, before);
    const a = now.find((u) => u.name === 'Aelfrun')!;
    expect(a).toBeTruthy();
    expect(a.gender).toBe('f');
    expect(a.family).toBe('Ash');
    expect(a.kids).toBe(4);
    const m = now.find((u) => u.name === long.slice(0, 40))!;
    expect(m.gender).toBe('m');
    expect(m.kids).toBe(3);
    expect(now.filter((u) => (u.kids ?? 0) > 0).length).toBe(2);
  });
});

describe('cradled and cradledOf', () => {
  it('sets the children down on the records of the town\'s roofs, some way toward being grown', () => {
    const g = fresh(), was = young(g, 0).length, pop = g.players[0].pop;
    cradled(g, 0, 5);
    const kids = young(g, 0);
    expect(kids.length).toBe(was + 5);
    for (const k of kids.slice(was)) {
      expect(k.left).toBeGreaterThanOrEqual(GROW_TIME * 0.1);
      expect(k.left).toBeLessThanOrEqual(GROW_TIME);
    }
    expect(g.players[0].pop).toBeGreaterThan(pop);
  });

  it('at the ages the record has them, when it has one for each', () => {
    const g = fresh(), was = young(g, 0).length;
    cradled(g, 0, 3, [0, 20, 50]);
    const kids = young(g, 0).slice(was);
    expect(kids.map((k) => k.left).sort((a, b) => b - a)).toEqual([0, 20, 50].map((s) => leftFor(s, GROW_TIME)));
    expect(kids.map((k) => childSeasons(k.left, GROW_TIME)).sort((a, b) => a - b)).toEqual([0, 20, 50]);
  });

  it('a count that is not a count is nought, and a side with no roof takes no children', () => {
    const g = fresh(), was = young(g, 0).length;
    cradled(g, 0, -4);
    cradled(g, 0, 'x' as never);
    expect(young(g, 0).length).toBe(was);
    for (const b of roofs(g, 1)) b.dead = true;
    cradled(g, 1, 3);
    expect(g.buildings.filter((b) => b.owner === 1).flatMap((b) => b.young ?? []).length).toBe(0);
  });

  it('cradledOf takes the children and their ages from what the campaign sent', () => {
    const g = fresh(), was = young(g, 0).length;
    cradledOf(g, 0, { men: 0, women: 0, elders: 0, children: 2, ages: { m: [], f: [], k: [10, 40] } });
    expect(young(g, 0).slice(was).map((k) => childSeasons(k.left, GROW_TIME)).sort((a, b) => a - b)).toEqual([10, 40]);
  });
});

describe('censusOf', () => {
  it('counts the side\'s men, women and old, its children and stores, and gives each grown one an age', () => {
    const g = fresh();
    g.players[0].res.food = 123.9;
    const a = censusOf(g, 0);
    peopled(g, 0, { men: 3, women: 2, elders: 2, children: 0 }, st, 1);
    cradled(g, 0, 4);
    const b = censusOf(g, 0);
    expect(b.men + b.women + b.elders).toBe(a.men + a.women + a.elders + 7);
    expect(b.elders).toBeGreaterThanOrEqual(a.elders + 2);
    expect(b.children).toBe(a.children + 4);
    expect(b.stores.food).toBe(123);
    expect(b.ages!.m.length + b.ages!.f.length).toBe(b.men + b.women + b.elders);
    expect(b.ages!.k.length).toBe(b.children);
  });

  it('hands back the ages it was given, near enough to the season', () => {
    const g = fresh();
    for (const u of folkOf(g, 0)) u.dead = true; // only those set down here are counted
    peopled(g, 0, { men: 2, women: 1, elders: 1, children: 0, ages: { m: [100, 260], f: [150, 90], k: [] } }, st, 1);
    const c = censusOf(g, 0);
    expect(c.ages!.m.sort((x, y) => x - y)).toEqual([100, 260]);
    expect(c.ages!.f.sort((x, y) => x - y)).toEqual([90, 150]);
    expect(c.elders).toBe(1); // sixty-five years and more is old
  });

  it('the women who have raised children are named, the most children first, twelve at the most', () => {
    const g = fresh();
    peopled(g, 0, { men: 0, women: 15, elders: 0, children: 0 }, st, 1);
    const women = folkOf(g, 0).filter((u) => u.gender === 'f');
    women.forEach((u, i) => { u.kids = i + 1; });
    const named = censusOf(g, 0).named!;
    expect(named.length).toBe(12);
    for (let i = 1; i < named.length; i++) expect(named[i - 1].kids!).toBeGreaterThanOrEqual(named[i].kids!);
    expect(named[0].kids).toBe(women.length);
    expect(named.every((n) => n.gender === 'f')).toBe(true);
  });

  it('those of the side held captive by the other are counted as taken', () => {
    const g = fresh();
    const u = folkOf(g, 0)[0];
    u.captive = { from: 0 } as never;
    u.owner = 1;
    expect(censusOf(g, 0).taken).toBe(1);
  });

  it('a side whose people were not set on the field says so; one whose were does not; a side that is not there counts nobody', () => {
    expect(censusOf(fresh(), 0).unfielded).toBe(true);
    const people = { men: 2, women: 2, elders: 0, children: 1 };
    const g = new Game(7, [{ ...setups[0], bonus: { people } }, setups[1]]);
    expect(censusOf(g, 0).unfielded).toBeUndefined();
    const none = censusOf(g, 9);
    expect({ men: none.men, women: none.women, elders: none.elders, children: none.children }).toEqual({ men: 0, women: 0, elders: 0, children: 0 });
  });
});
