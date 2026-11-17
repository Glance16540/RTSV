// The map's orphans are the town's taken-in children (src/sim/orphantown.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { orphansBack, orphansOut, seatOrphans } from '../src/sim/orphantown';
import type { Orphans } from '../src/sim/widowhood';
import { cleanCensus, folkOf, musterFolk, settleFolk } from '../src/sim/township';
import { setups, spot, villagers } from './helpers';

const reed: Orphans = { family: 'Reed', into: 'Ashe', since: 9, count: 2 };
const child = (id: number) => ({ id, name: `C${id}`, family: '', gender: 'f' as const, trait: '', trait2: '', lifespan: 9999, left: 1e9, bornAt: 0 });

describe('the map\'s orphans are the town\'s taken-in children', () => {
  it('go with the town\'s people when it is mustered', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 0)!.id;
    folkOf(c, tid).orphans = [reed];
    expect(musterFolk(c, tid).people.orphans).toEqual([reed]);
  });

  it('are set on the record of the house that keeps them, marked as taken in, and the town\'s children are as many as before', () => {
    const g = new Game(3, setups);
    const a = spot(g, 'house', 0), keeper = g.spawnBuilding('house', 0, a.cx, a.cy, true);
    const b = spot(g, 'house', 0), other = g.spawnBuilding('house', 0, b.cx, b.cy, true);
    keeper.family = 'Ashe'; keeper.residents.f = villagers(g, 0).find((u) => u.gender === 'f')!.id;
    other.young = [child(1), child(2), child(3)];
    const before = g.buildings.reduce((n, x) => n + (x.young?.length ?? 0), 0);
    expect(seatOrphans(g, 0, [reed])).toBe(2);
    expect(keeper.young?.filter((c) => c.takenFrom === 'Reed')).toHaveLength(2);
    expect(g.buildings.reduce((n, x) => n + (x.young?.length ?? 0), 0)).toBe(before);
    expect(orphansOut(g, 0)).toEqual([{ family: 'Reed', into: 'Ashe', since: -1, count: 2 }]);
    expect(orphansBack([reed], orphansOut(g, 0)!, 30)[0].since).toBe(9);
    // One comes of age: the record keeps one.
    keeper.young = keeper.young!.filter((c) => c.id !== 1);
    expect(orphansOut(g, 0)?.[0].count).toBe(1);
  });

  it('written back to the map: the town\'s replace the map\'s, and a battle that set none and took in none leaves them be', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 0)!.id, f = folkOf(c, tid);
    f.orphans = [reed];
    const base = { men: f.men, women: f.women, elders: f.elders, children: f.children, stores: { ...f.stores }, named: [] };
    settleFolk(c, tid, cleanCensus(base)!);
    expect(f.orphans).toEqual([reed]);
    settleFolk(c, tid, cleanCensus({ ...base, orphans: [{ family: 'Tull', into: 'Ashe', since: -1, count: 1 }] })!);
    expect(f.orphans).toEqual([{ family: 'Tull', into: 'Ashe', since: c.turn, count: 1 }]);
  });
});
