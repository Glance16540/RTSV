// A widow known on the map is the same widow in the town (src/sim/widowtown.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { bereftOf } from '../src/sim/bereft';
import { seatWidows, widowsBack, widowsOut } from '../src/sim/widowtown';
import type { Widowed } from '../src/sim/widowhood';
import { cleanCensus, folkOf, musterFolk, settleFolk } from '../src/sim/township';
import { setups, spot, villagers } from './helpers';

const ada: Widowed = { name: 'Ada', family: 'Reed', female: true, of: 'Wulf', since: 7, kids: 2 };

describe('a widow known on the map is the same widow in the town', () => {
  it('goes with the town\'s people when it is mustered', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 0)!.id;
    folkOf(c, tid).widowed = [ada];
    expect(musterFolk(c, tid).people.widowed).toEqual([ada]);
  });

  it('is housed alone as the battle begins, the house remembering whom she lost; a husband settled with her is not hers', () => {
    const g = new Game(3, setups);
    const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const vs = villagers(g, 0), her = vs.find((u) => u.gender === 'f')!, him = vs.find((u) => u.gender === 'm')!;
    her.name = 'Ada'; h.residents.f = her.id; her.homeId = h.id; h.residents.m = him.id; him.homeId = h.id;
    expect(seatWidows(g, 0, [ada])).toBe(1);
    expect(h.residents.m).toBe(0);
    expect(him.homeId).toBe(0);
    expect(bereftOf(g, h)?.who).toBe(her);
    expect(bereftOf(g, h)?.lost).toBe('Wulf');
    // Somebody nobody knows by that name takes it, where the town has nobody of it.
    const g2 = new Game(3, setups);
    const at2 = spot(g2, 'house', 0); g2.spawnBuilding('house', 0, at2.cx, at2.cy, true);
    expect(seatWidows(g2, 0, [{ ...ada, name: 'Brenna' }])).toBe(1);
    expect(villagers(g2, 0).some((u) => u.name === 'Brenna')).toBe(true);
  });

  it('comes back out with the census: married again in the town, she is struck off; still widowed, she keeps her season', () => {
    const g = new Game(3, setups);
    const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const her = villagers(g, 0).find((u) => u.gender === 'f')!;
    her.name = 'Ada'; her.homeId = h.id; h.residents.f = her.id;
    seatWidows(g, 0, [ada]);
    const out = widowsOut(g, 0)!;
    expect(out.map((w) => w.name)).toEqual(['Ada']);
    expect(widowsBack([ada], out, 20)[0].since).toBe(7);
    // She marries again: nobody widowed comes out, and the map strikes her off.
    h.residents.m = villagers(g, 0).find((u) => u.gender === 'm')!.id;
    expect(widowsOut(g, 0)).toEqual([]);
    expect(widowsBack([ada], [], 20)).toEqual([]);
  });

  it('written back to the map: the town\'s widowed replace the map\'s, and a battle that seated none leaves them be', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 0)!.id, f = folkOf(c, tid);
    f.widowed = [ada];
    const base = { men: f.men, women: f.women, elders: f.elders, children: f.children, stores: { ...f.stores }, named: [] };
    settleFolk(c, tid, cleanCensus(base)!);
    expect(f.widowed).toEqual([ada]); // no word on them: the map keeps its own
    settleFolk(c, tid, cleanCensus({ ...base, widowed: [{ ...ada, name: 'Cora', since: -1 }] })!);
    expect(f.widowed?.map((w) => [w.name, w.since])).toEqual([['Cora', c.turn]]);
  });
});
