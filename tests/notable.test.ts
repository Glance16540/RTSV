// Who a town knows by name (src/sim/notable.ts) and how it is said (src/client/notables.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { CHAMPION_KILLS } from '../src/sim/champion';
import { RENOWN_CHILDREN } from '../src/sim/data';
import { extra, notableOf, notables } from '../src/sim/notable';
import { notableLine, notableList } from '../src/client/notables';
import { setups, spot, villagers } from './helpers';

const town = () => {
  const g = new Game(5, setups);
  const vs = villagers(g, 0), man = vs.find((v) => v.gender === 'm')!, woman = vs.find((v) => v.gender === 'f')!;
  const hs = spot(g, 'house', 0), house = g.spawnBuilding('house', 0, hs.cx, hs.cy, true);
  house.residents = { m: man.id, f: woman.id }; man.homeId = woman.homeId = house.id; house.family = 'Reed';
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const soldier = g.spawnUnit('swordsman', 0, tc.x + 3, tc.y + 5);
  return { g, house, man, woman, soldier };
};

describe('notable people', () => {
  it('most people are ordinary', () => {
    const { g, man, woman, soldier } = town();
    expect([notableOf(g, man), notableOf(g, woman), notableOf(g, soldier)]).toEqual([null, null, null]);
    expect(notables(g, 0)).toEqual([]);
    expect(notableList(g, 0)).toContain('No one of this town has yet made a name');
    expect(notableLine(g, soldier)).toBe('');
  });
  it('a soldier who has felled enough is a veteran, brighter the more he has done', () => {
    const { g, soldier } = town();
    soldier.name = 'Odo'; soldier.kills = CHAMPION_KILLS;
    expect(notableOf(g, soldier)).toMatchObject({ kind: 'veteran', rank: 1, name: 'Odo' });
    soldier.kills = CHAMPION_KILLS * 5;
    expect(notableOf(g, soldier)!.rank).toBe(3);
    expect(notableLine(g, soldier)).toContain('★★★');
  });
  it('the mother of a house of renown is notable; her husband and a woman of an ordinary house are not', () => {
    const { g, house, man, woman } = town();
    house.children = RENOWN_CHILDREN * 2;
    expect(notableOf(g, woman)).toMatchObject({ kind: 'matron', rank: 2 });
    expect(notableOf(g, woman)!.known).toContain('Reed');
    expect(notableOf(g, man)).toBe(null);
    house.children = 0;
    expect(notableOf(g, woman)).toBe(null);
  });
  it('the town\'s list puts veterans before matrons, takes what other modules add, and writes names safely', () => {
    const { g, house, woman, soldier } = town();
    house.children = RENOWN_CHILDREN; soldier.name = '<Odo>'; soldier.kills = CHAMPION_KILLS;
    expect(notables(g, 0).map((n) => n.kind)).toEqual(['veteran', 'matron']);
    const add = () => [{ id: -1, name: 'Old Wren', kind: 'veteran' as const, rank: 3, known: 'remembered from an earlier season' }];
    extra.push(add);
    try {
      expect(notables(g, 0)[0].name).toBe('Old Wren');
      const html = notableList(g, 0);
      expect(html).toContain('&lt;Odo&gt;');
      expect(html).toContain(woman.name);
    } finally { extra.splice(extra.indexOf(add), 1); }
    expect(notables(g, 1)).toEqual([]);
  });
});
