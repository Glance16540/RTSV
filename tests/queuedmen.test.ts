// The very men in a town's training queues come out on the map as themselves (src/sim/queuedmen.ts, src/sim/queueddrill.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { armyAt, endTurn, newCampaign } from '../src/sim/campaign';
import { agesOf } from '../src/sim/ageing';
import { menOf, musterOf } from '../src/sim/armytown';
import { keepOrders } from '../src/sim/governor';
import { queuedOf } from '../src/sim/queuedmen';
import { QUEUED, cleanQueued, drillQueued, drillWithQueued, keepQueued, queuedAt } from '../src/sim/queueddrill';
import { folkOf } from '../src/sim/township';
import { awayMen } from '../src/sim/warhouse';
import { setups, spot, villagers } from './helpers';

/** The player's chief town with a Barracks and a Stable, twenty men of known ages, no army, and nothing in its orders. */
const town = () => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0); c.musters = {};
  home.buildings = ['barracks', 'stable'];
  const f = folkOf(c, home.id);
  Object.assign(f, { men: 20, women: 20, elders: 0, children: 0 }); delete f.ages; delete f.houses;
  const ages = agesOf(c, home.id, f);
  delete home.orders;
  return { c, home, f, ages };
};

describe('on the field: who is in the queues', () => {
  it('each man called to a building to be trained is listed by name, house, age and what he is to be', () => {
    const g = new Game(7, setups);
    const at = spot(g, 'barracks', 0), b = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
    expect(queuedOf(g, 0)).toEqual([]);
    expect(g.cmdTrain(0, b.id, 'clubman')).toBe(true);
    const men = queuedOf(g, 0);
    expect(men).toHaveLength(1);
    const him = g.entities.get(b.queue[0].who!)!;
    expect(him.kind).toBe('unit');
    expect(men[0].as).toBe('clubman');
    expect(men[0].name).toBe((him as { name: string }).name);
    expect(men[0].seasons).toBeGreaterThanOrEqual(60);
    expect(villagers(g, 0).map((v) => v.name)).toContain(men[0].name); // still a villager of the town, not yet a soldier
    expect(g.orders(0).men).toEqual(men);
    expect(queuedOf(g, 1)).toEqual([]); // not another side's
  });
});

describe('on the map: they come out as themselves', () => {
  it('a queued man is the man of a company of his kind: taken at his own age, on the roll, and on a house\'s record by his name', () => {
    const { c, home, f, ages } = town();
    const his = ages.m[7]; // not the youngest: the ordinary drill would never have chosen him
    expect(his).toBeGreaterThan(Math.min(...ages.m));
    keepOrders(c, home.id, { train: ['clubman'] });
    expect(keepQueued(c, home.id, [{ as: 'clubman', name: 'Osric', family: 'Ashdown', seasons: his }])).toHaveLength(1);
    const goods = { ...f.stores };
    const raised = drillQueued(c, home.id);
    expect(raised).toMatchObject([{ at: home.id, kind: 'infantry', men: 1 }]);
    const a = armyAt(c, home.id)!;
    expect(a.units).toEqual({ infantry: 1 });
    expect(f.men).toBe(19);
    expect(agesOf(c, home.id, f).m.filter((s) => s === his).length).toBe(ages.m.filter((s) => s === his).length - 1);
    expect(musterOf(c, a.id)!.men[home.id]).toEqual([his]);
    expect(menOf(c, a).town).toBe(1);
    expect(awayMen(c, home.id)).toMatchObject([{ name: 'Osric', family: 'Ashdown', army: a.id }]);
    expect(f.stores).toEqual(goods); // his training was paid for in the town
    expect(c.log.at(-1)).toContain('Osric Ashdown');
    expect(c.log.at(-1)).toContain('was training as a clubman when you left');
    expect(queuedAt(c, home.id)).toEqual([]); // he is out: not raised twice
    expect(drillQueued(c, home.id)).toEqual([]);
  });

  it('a rider makes a company of cavalry, and several men come out together', () => {
    const { c, home, ages } = town();
    keepQueued(c, home.id, [{ as: 'rider', name: 'Bram', seasons: ages.m[3] }, { as: 'clubman', name: 'Corin', seasons: ages.m[9] }, { as: 'clubman', name: 'Dunn', seasons: ages.m[12] }]);
    expect(drillQueued(c, home.id).map((d) => d.kind)).toEqual(['cavalry', 'infantry', 'infantry']);
    expect(armyAt(c, home.id)!.units).toEqual({ cavalry: 1, infantry: 2 });
    expect(awayMen(c, home.id).map((m) => m.name).sort()).toEqual(['Bram', 'Corin', 'Dunn']);
  });

  it('he is found a season older for every season that has passed', () => {
    const { c, home, f, ages } = town();
    const his = ages.m[5];
    keepOrders(c, home.id, { train: ['clubman'] });
    keepQueued(c, home.id, [{ as: 'clubman', name: 'Edric', seasons: his }]);
    // Two seasons go by before the drill: everyone on the record is two seasons older.
    f.ages!.m = f.ages!.m.map((s) => s + 2); c.turn += 2;
    expect(drillQueued(c, home.id)).toHaveLength(1);
    expect(musterOf(c, armyAt(c, home.id)!.id)!.men[home.id]).toEqual([his + 2]);
  });

  it('a man no longer in the town raises nobody, and the log says so', () => {
    const { c, home, f } = town();
    keepQueued(c, home.id, [{ as: 'clubman', name: 'Fenn', family: 'Marsh', seasons: 399 }]); // nobody in the town is that age
    expect(drillQueued(c, home.id)).toEqual([]);
    expect(armyAt(c, home.id)).toBeUndefined();
    expect(f.men).toBe(20);
    expect(c.log.at(-1)).toContain('Fenn Marsh');
    expect(c.log.at(-1)).toContain('no longer in the town');
    expect(queuedAt(c, home.id)).toEqual([]);
  });

  it('with no yard for his kind he waits, and comes out when there is one', () => {
    const { c, home, ages } = town();
    home.buildings = ['barracks'];
    keepQueued(c, home.id, [{ as: 'rider', name: 'Garrick', seasons: ages.m[4] }]);
    expect(drillQueued(c, home.id)).toEqual([]);
    expect(queuedAt(c, home.id)).toHaveLength(1);
    home.buildings.push('stable');
    expect(drillQueued(c, home.id).map((d) => d.kind)).toEqual(['cavalry']);
  });

  it('what comes back from the field is not believed blindly', () => {
    expect(cleanQueued(null)).toEqual([]);
    expect(cleanQueued([{ as: 'dragon', name: 'X', seasons: 80 }, { as: 'clubman', name: '', seasons: 80 }, { as: 'clubman', name: 'Holt', seasons: 'old' }, 7, null])).toEqual([]);
    expect(cleanQueued([{ as: 'clubman', name: 'Ivo<b>', family: 'Barrow', seasons: 3 }])).toEqual([{ as: 'clubman', name: 'Ivob', family: 'Barrow', seasons: 60 }]);
    expect(cleanQueued(Array.from({ length: 30 }, (_, i) => ({ as: 'clubman', name: `N${i}`, seasons: 80 })))).toHaveLength(QUEUED.most);
  });

  it('the season sends the queued men first, and the town\'s ordinary drill only where none went', () => {
    const { c, home, f, ages } = town();
    f.stores = { food: 4000, wood: 4000, gold: 4000, stone: 4000 };
    keepOrders(c, home.id, { train: ['clubman'] });
    keepQueued(c, home.id, [{ as: 'clubman', name: 'Joss', seasons: ages.m[8] }]);
    expect(drillWithQueued(c)).toHaveLength(1); // Joss, and no second company by the ordinary drill that season
    expect(armyAt(c, home.id)!.units).toEqual({ infantry: 1 });
    expect(drillWithQueued(c)).toHaveLength(1); // the season after, the town goes on by its last orders
    expect(armyAt(c, home.id)!.units).toEqual({ infantry: 2 });
  });

  it('a campaign\'s turn carries it: the man is out when the season has turned', () => {
    const { c, home, ages } = town();
    keepOrders(c, home.id, { train: ['clubman'] });
    keepQueued(c, home.id, [{ as: 'clubman', name: 'Kell', family: 'Harrow', seasons: ages.m[6] }]);
    endTurn(c);
    expect(c.log.join('\n')).toContain('Kell Harrow');
    expect(queuedAt(c, home.id)).toEqual([]);
  }, 60_000);
});
