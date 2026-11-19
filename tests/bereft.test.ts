// Widows, widowers and orphans in a town (src/sim/bereft.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/game';
import { bereftLines, bereftOf } from '../src/sim/bereft';
import { setups, spot, villagers } from './helpers';

const house = (g: Game, family?: string): Building => { const at = spot(g, 'house', 0); const h = g.spawnBuilding('house', 0, at.cx, at.cy, true); if (family) h.family = family; return h; };
const live = (h: Building, u: Unit): void => { h.residents[u.gender as 'm' | 'f'] = u.id; u.homeId = h.id; };
const child = (name: string) => ({ id: 1e6 + name.length, name, family: '', gender: 'f' as const, trait: '', trait2: '', lifespan: 9999, left: 1e9, bornAt: 0 });

describe('widows, widowers and orphans in a town', () => {
  it('a wife whose husband dies is his widow, keeps the house and its children, until she marries again', () => {
    const g = new Game(3, setups);
    const vs = villagers(g, 0), man = vs.find((u) => u.gender === 'm')!, woman = vs.find((u) => u.gender === 'f')!;
    const h = house(g, 'Reed');
    live(h, man); live(h, woman);
    h.young = [child('Ada')];
    g.perish(man);
    expect(h.residents.f).toBe(woman.id);
    expect(bereftOf(g, h)?.who).toBe(woman);
    expect(bereftLines(g, h)[0]).toMatch(new RegExp(`${woman.name} is widowed: her husband ${man.name} is dead`));
    expect(h.young).toHaveLength(1);
    // A man comes to live there: the widowhood is over.
    const other = villagers(g, 0).find((u) => u.gender === 'm' && u !== man)!;
    live(h, other);
    expect(bereftOf(g, h)).toBeNull();
  });

  it('when the last of a couple dies, the children are taken in by a named house of the town, and nothing harms them', () => {
    const g = new Game(3, setups);
    const vs = villagers(g, 0), man = vs.find((u) => u.gender === 'm')!, woman = vs.find((u) => u.gender === 'f')!, other = vs.filter((u) => u.gender === 'f')[1];
    const h = house(g, 'Reed'), taker = house(g, 'Ashe');
    live(h, man); live(h, woman); live(taker, other);
    h.young = [child('Ada'), child('Bran')];
    g.perish(man);
    g.perish(woman);
    expect(h.young).toEqual([]);
    expect(taker.young?.map((c) => c.name)).toEqual(['Ada', 'Bran']);
    expect(taker.young?.every((c) => c.takenFrom === 'Reed')).toBe(true);
    expect(bereftLines(g, taker).join(' ')).toMatch(/Taken in: Ada, of the Reed house; Bran, of the Reed house/);
  });
});

// The rules case by case: who is widowed, who takes the children in, and what the house panel says.
import { bereaved, takerFor } from '../src/sim/bereft';

const msgs = (g: Game): string[] => (g.events as { t: string; text?: string }[]).filter((e) => e.t === 'msg').map((e) => e.text!);
const pair = (g: Game) => { const vs = villagers(g, 0); return { man: vs.find((u) => u.gender === 'm')!, woman: vs.find((u) => u.gender === 'f')!, vs }; };

describe('widows, widowers and orphans: case by case', () => {
  it('a house nobody has lost from has no widow; a husband whose wife dies is her widower, until a woman comes to live there', () => {
    const g = new Game(3, setups);
    const { man, woman, vs } = pair(g);
    const h = house(g, 'Reed');
    live(h, man); live(h, woman);
    expect(bereftOf(g, h)).toBeNull();
    expect(bereftLines(g, h)).toEqual([]);
    g.perish(woman);
    const w = bereftOf(g, h)!;
    expect(w).toMatchObject({ who: man, lost: woman.name, as: 'wife' });
    expect(bereftLines(g, h)).toEqual([`${man.name} is a widower: his wife ${woman.name} is dead. He keeps the house.`]);
    expect(h.bereft!.at).toBe(g.time);
    live(h, vs.filter((u) => u.gender === 'f')[1]);
    expect(bereftOf(g, h)).toBeNull();
  });

  it('a widow who dies in turn, or leaves, is no longer the house\'s widow', () => {
    const g = new Game(3, setups);
    const { man, woman } = pair(g);
    const h = house(g);
    live(h, man); live(h, woman);
    bereaved(g, h, man); // called by hand: the game strikes him from the house first, so here it is done after
    h.residents.m = 0;
    expect(bereftOf(g, h)?.who).toBe(woman);
    woman.dead = true;
    expect(bereftOf(g, h)).toBeNull();
    woman.dead = false;
    h.residents.f = 0; // moved out
    expect(bereftOf(g, h)).toBeNull();
  });

  it('only a house is bereaved: a death on the record of any other building leaves it as it was', () => {
    const g = new Game(3, setups);
    const { man } = pair(g);
    const at = spot(g, 'barracks', 0);
    const b = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
    b.young = [child('Ada')];
    bereaved(g, b, man);
    expect(b.bereft).toBeUndefined();
    expect(b.young).toHaveLength(1);
  });

  it('the last of a house dying with no children leaves no widow and moves nobody', () => {
    const g = new Game(3, setups);
    const { man, woman } = pair(g);
    const h = house(g, 'Reed');
    live(h, man); live(h, woman);
    g.perish(man);
    expect(h.bereft).toBeDefined();
    const before = msgs(g).length;
    g.perish(woman);
    expect(h.bereft).toBeUndefined(); // nobody left to be widowed
    expect(msgs(g).slice(before).some((m) => /lost both parents/.test(m))).toBe(false);
  });

  it('with no other house with anyone living in it, the orphans stay on their own roof\'s record', () => {
    const g = new Game(3, setups);
    const { man, woman } = pair(g);
    const h = house(g, 'Reed');
    house(g, 'Empty'); // stands empty: cannot take them
    live(h, man); live(h, woman);
    h.young = [child('Ada')];
    g.perish(man); g.perish(woman);
    expect(h.young.map((c) => c.name)).toEqual(['Ada']);
    expect(h.young[0].takenFrom).toBeUndefined();
  });

  it('takerFor: a lived-in, finished house of the same side, a known family\'s before a nearer nameless one, else the nearest', () => {
    const g = new Game(3, setups);
    const { man, vs } = pair(g);
    const others = vs.filter((u) => u !== man);
    const from = house(g, 'Reed');
    expect(takerFor(g, from)).toBeNull();
    const near = house(g); live(near, others[0]);
    expect(takerFor(g, from)).toBe(near);
    const named = house(g, 'Ashe'); live(named, others[1]);
    expect(takerFor(g, from)).toBe(named); // a known family's first, though farther or not
    named.dead = true;
    expect(takerFor(g, from)).toBe(near);
    named.dead = false; named.complete = false;
    expect(takerFor(g, from)).toBe(near); // half-built: nobody's home yet
    named.complete = true; named.owner = 1;
    expect(takerFor(g, from)).toBe(near); // the other side's
    named.owner = 0;
    // Of two houses alike, the nearer.
    named.family = '';
    const d = (b: Building) => Math.hypot(b.x - from.x, b.y - from.y);
    expect(takerFor(g, from)).toBe(d(named) < d(near) ? named : near);
    // A house never takes in its own.
    live(from, man);
    expect(takerFor(g, from)).not.toBe(from);
  });

  it('says so in the town: a child taken in by a named house, and children by a nameless one next door', () => {
    const one = new Game(3, setups);
    {
      const { man, woman, vs } = pair(one);
      const h = house(one, 'Reed'), to = house(one, 'Ashe');
      live(h, man); live(h, woman); live(to, vs.filter((u) => u.gender === 'f')[1]);
      h.young = [child('Ada')];
      one.perish(man); one.perish(woman);
      expect(msgs(one)).toContain('The child of the Reed house has lost both parents, and is taken in by the Ashe house.');
      expect(bereftLines(one, to)).toEqual(['Taken in: Ada, of the Reed house. An orphan, raised here.']);
    }
    const two = new Game(3, setups);
    {
      const { man, woman, vs } = pair(two);
      const h = house(two), to = house(two);
      live(h, man); live(h, woman); live(to, vs.filter((u) => u.gender === 'f')[1]);
      man.family = ''; woman.family = '';
      h.young = [child('Ada'), child('Bran')];
      two.perish(man); two.perish(woman);
      expect(msgs(two)).toContain('The 2 children of the house have lost both parents, and are taken in by the house next door.');
      expect(to.young!.every((c) => c.takenFrom === '')).toBe(true);
      expect(bereftLines(two, to)).toEqual(['Taken in: Ada; Bran. Orphans, raised here.']);
    }
  });

  it('a house\'s own children, born there, are not counted as taken in', () => {
    const g = new Game(3, setups);
    const h = house(g, 'Reed');
    h.young = [child('Ada'), { ...child('Cai'), takenFrom: 'Ashe' }];
    expect(bereftLines(g, h)).toEqual(['Taken in: Cai, of the Ashe house. An orphan, raised here.']);
  });
});
