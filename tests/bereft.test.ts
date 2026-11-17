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
