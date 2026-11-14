import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, battleConfig, finishBattle, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { ELDER_AT } from '../src/sim/data';
import { Census, MOTHER_KIDS, TOLL, cleanCensus, folkOf, foundFolk, headcount, living, musterFolk, nationNotables, nationPeople, nationStores, rememberVeteran, settleFolk, tollFolk } from '../src/sim/township';
import { run } from './helpers';

const LONG = 60_000;
const world = (seed = 5): Campaign => newCampaign(seed, 1, 1, 'hearth');
const home = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;
/** A rival army comes against the player's chief town. */
const besieged = (seed = 5): Campaign => {
  const c = world(seed), h = home(c);
  c.armies.push({ id: 99, owner: 1, at: h.adj[0], units: { infantry: 2 }, hero: false, vet: 0, moved: false });
  c.territories[h.adj[0]].owner = 1;
  expect(moveArmy(c, 99, h.id)).toBe('battle');
  c.pending!.mode = 'siege';
  return c;
};
/** The player's army goes against a land of the local tribes. */
const assault = (seed = 5): { c: Campaign; to: number } => {
  const c = world(seed), h = home(c), to = h.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde)!;
  expect(moveArmy(c, armyAt(c, h.id)!.id, to)).toBe('battle');
  c.pending!.mode = 'siege';
  return { c, to };
};
const count = (over: Partial<Census> = {}): Census => ({ men: 3, women: 3, elders: 1, children: 2, stores: { food: 120, wood: 80, gold: 40, stone: 10 }, taken: 0, named: [], ...over });

describe('a town and its people', () => {
  it('every land has a town of its own, the same each time it is asked after, and a capital has more in it', () => {
    const c = world();
    for (const t of c.territories) {
      const f = folkOf(c, t.id);
      expect(f.men, t.name).toBeGreaterThanOrEqual(2);
      expect(f.women, t.name).toBeGreaterThanOrEqual(2);
      expect(f.children, t.name).toBeGreaterThanOrEqual(1);
      expect(f).toEqual(foundFolk(c, t.id));
      expect(folkOf(c, t.id)).toBe(f); // and it is the one town, not a new one each time
    }
    const chief = home(c), plain = { ...chief, capital: -1 };
    const as = (t: typeof chief) => { const k = JSON.parse(JSON.stringify(c)) as Campaign; k.territories[chief.id] = { ...t, folk: undefined }; return foundFolk(k, chief.id); };
    expect(as(chief).men).toBe(as(plain).men + 2);
    expect(as(chief).women).toBe(as(plain).women + 2);
  }, LONG);

  it('a campaign saved before towns kept their people still loads, and one saved after keeps them', () => {
    const c = world(), h = home(c);
    expect(h.folk).toBeUndefined(); // nothing is stored until it is needed
    const old = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(folkOf(old, h.id)).toEqual(foundFolk(c, h.id));
    folkOf(c, h.id).men = 11;
    folkOf(c, h.id).stores.food = 777;
    const kept = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(folkOf(kept, h.id).men).toBe(11);
    expect(folkOf(kept, h.id).stores.food).toBe(777);
  }, LONG);

  it("a nation's stores and people are the sum of its towns'", () => {
    const c = world(), h = home(c), next = c.territories[h.adj[0]];
    const alone = nationStores(c, 0), heads = nationPeople(c, 0).all;
    expect(alone).toEqual(folkOf(c, h.id).stores);
    expect(heads).toBe(headcount(folkOf(c, h.id)));
    next.owner = 0;
    expect(nationStores(c, 0).food).toBe(alone.food + folkOf(c, next.id).stores.food);
    expect(nationPeople(c, 0).all).toBe(heads + headcount(folkOf(c, next.id)));
    expect(nationPeople(c, 0).women).toBe(folkOf(c, h.id).women + folkOf(c, next.id).women);
  }, LONG);
});

describe('a battle is fought by the town and goes home to it', () => {
  it('the town fought over turns out with its own people and stores; an army in the field or in camp brings neither', () => {
    const c = besieged(), h = home(c), f = folkOf(c, h.id);
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].bonus!.people).toMatchObject({ men: f.men, women: f.women, elders: f.elders, children: f.children });
    expect(cfg.setups[0].bonus!.stores).toEqual(f.stores);
    expect(cfg.setups[1].bonus!.people).toBeUndefined(); // the attackers are an army, not a town
    c.pending!.mode = 'field';
    expect(battleConfig(c)!.setups[0].bonus!.people).toBeUndefined();
    const far = assault();
    expect(battleConfig(far.c)!.setups[1].bonus!.people).toMatchObject({ men: folkOf(far.c, far.to).men }); // the tribe's town is a town too
    expect(battleConfig(far.c)!.setups[0].bonus!.people).toBeUndefined();
  }, LONG);

  it('the people on the field are the population: so many men, women and old, the children on the record, the stores as kept', () => {
    const c = besieged(), h = home(c), f = folkOf(c, h.id);
    f.men = 5; f.women = 4; f.elders = 3; f.children = 6;
    f.stores = { food: 321, wood: 210, gold: 55, stone: 7 };
    const cfg = battleConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea);
    const mine = g.units.filter((u) => u.owner === 0 && u.type === 'villager');
    expect(mine.length).toBe(12);
    expect(mine.filter((u) => u.age >= u.lifespan * ELDER_AT).length).toBe(3);
    expect(mine.filter((u) => u.gender === 'm' && u.age < u.lifespan * ELDER_AT).length).toBe(5);
    expect(g.players[0].res).toMatchObject({ food: 321, wood: 210, gold: 55, stone: 7 });
    expect(g.census(0)).toMatchObject({ men: 5, women: 4, elders: 3, children: 6, taken: 0, stores: { food: 321, wood: 210, gold: 55, stone: 7 } });
    expect(g.units.filter((u) => u.owner === 1 && u.type === 'villager').length).toBe(4); // a camp still has its four
  }, LONG);

  it('what the battle leaves of the town is the town from then on', () => {
    const c = besieged(), h = home(c), f = folkOf(c, h.id);
    f.men = 4; f.women = 4; f.elders = 1; f.children = 3;
    const cfg = battleConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea);
    run(g, 40);
    const women = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'f' && u.age < u.lifespan * ELDER_AT);
    const had = g.census(0).women;
    const fell = g as unknown as { kill(u: unknown): void };
    fell.kill(women[0]); fell.kill(women[1]); // two women are lost in the fighting
    g.players[0].res.food = 999;
    const census = g.census(0);
    expect(census.women).toBe(had - 2);
    finishBattle(c, true, { clubman: 4 }, { folk: JSON.parse(JSON.stringify(census)) as Census });
    const after = folkOf(c, h.id);
    expect(after.women).toBe(had - 2);
    expect(after.men).toBe(census.men);
    expect(after.children).toBe(census.children);
    expect(after.stores).toEqual(census.stores);
    expect(after.stores.food).toBe(999);
    expect(c.log.join('\n')).toMatch(/Of your people at .* died/);
    // And the next time it is fought over, that is who turns out.
    expect(musterFolk(c, h.id).people).toMatchObject({ women: had - 2, men: census.men });
  }, LONG);

  it('a town taken keeps the people who lived, and an empty one is settled by those who followed the army', () => {
    const { c, to } = assault();
    finishBattle(c, true, { clubman: 6, warlord: 1 }, { folk: count({ men: 1, women: 2, elders: 0, children: 1 }) });
    expect(c.territories[to].owner).toBe(0);
    expect(folkOf(c, to)).toMatchObject({ men: 1, women: 2, elders: 0, children: 1, stores: { food: 120 } });
    const waste = assault(9);
    finishBattle(waste.c, true, { clubman: 6, warlord: 1 }, { folk: count({ men: 0, women: 0, elders: 0, children: 0 }) });
    expect(folkOf(waste.c, waste.to)).toMatchObject({ men: 2, women: 2 });
    expect(waste.c.log.join('\n')).toContain('have settled there');
  }, LONG);

  it('a battle that sends nothing home about the town leaves it as it was, and nonsense is not believed', () => {
    const c = besieged(), h = home(c), was = JSON.parse(JSON.stringify(folkOf(c, h.id)));
    finishBattle(c, true, { clubman: 4 });
    expect(folkOf(c, h.id)).toEqual(was);
    expect(cleanCensus(null)).toBeUndefined();
    expect(cleanCensus({ men: 3 })).toBeUndefined();
    const odd = cleanCensus({ men: -4, women: 1e9, elders: NaN, children: 2.6, stores: { food: -1, wood: 1e12, gold: 5, stone: 'x' as unknown as number }, named: [{ name: '<b>Ada</b>', gender: 'f', kids: 4 }, { name: '', gender: 'f' }] })!;
    expect(odd).toMatchObject({ men: 0, women: 60, elders: 0, children: 3, stores: { food: 0, wood: 20000, gold: 5, stone: 0 } });
    expect(odd.named).toEqual([{ name: 'bAda/b', gender: 'f', kids: 4 }]);
  }, LONG);

  it('a battle nobody watched costs the town men, and half its stores if it falls', () => {
    const c = besieged(), h = home(c), f = folkOf(c, h.id);
    f.men = 10; f.stores = { food: 400, wood: 200, gold: 100, stone: 50 };
    expect(tollFolk(c, h.id, false)).toBe(Math.ceil(10 * TOLL.held));
    expect(f.stores.food).toBe(400);
    const left = f.men;
    expect(tollFolk(c, h.id, true)).toBe(Math.ceil(left * TOLL.taken));
    expect(f.stores).toEqual({ food: 200, wood: 100, gold: 50, stone: 25 });
    // And settling a battle from the map does it.
    const d = besieged(11), dh = home(d), women = folkOf(d, dh.id).women;
    folkOf(d, dh.id).men = 10;
    resolvePending(d, 'auto');
    expect(folkOf(d, dh.id).men).toBeLessThan(10);
    expect(folkOf(d, dh.id).women).toBe(women); // war takes the men
  }, LONG);
});

describe('notable people are kept by name', () => {
  it('a woman who has raised enough children is remembered, turns out by name, and her loss is written down', () => {
    const c = besieged(), h = home(c);
    settleFolk(c, h.id, count({ named: [{ name: 'Maren', family: 'Holt', gender: 'f', kids: MOTHER_KIDS }, { name: 'Ysolt', gender: 'f', kids: MOTHER_KIDS - 1 }] }));
    expect(living(folkOf(c, h.id)).map((n) => n.name)).toEqual(['Maren']);
    expect(nationNotables(c, 0)).toEqual([{ at: h.id, who: expect.objectContaining({ name: 'Maren', kind: 'mother', kids: MOTHER_KIDS }) }]);
    expect(c.chronicle!.some((x) => x.text.includes('Maren'))).toBe(true);
    // She is on the field the next time, under her own name.
    const cfg = battleConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea);
    const her = g.units.filter((u) => u.owner === 0 && u.name === 'Maren');
    expect(her.length).toBe(1);
    expect(her[0]).toMatchObject({ gender: 'f', family: 'Holt', kids: MOTHER_KIDS });
    expect(g.census(0).named).toContainEqual(expect.objectContaining({ name: 'Maren', kids: MOTHER_KIDS }));
    // She raises another, and then is not among those counted.
    settleFolk(c, h.id, count({ named: [{ name: 'Maren', gender: 'f', kids: MOTHER_KIDS + 1 }] }));
    expect(living(folkOf(c, h.id))[0].deed).toBe(`raised ${MOTHER_KIDS + 1} children`);
    const told = c.chronicle!.length;
    const tally = settleFolk(c, h.id, count({ women: 2, taken: 1 }));
    expect(tally.lost.map((n) => n.name)).toEqual(['Maren']);
    expect(living(folkOf(c, h.id))).toEqual([]);
    expect(folkOf(c, h.id).notables[0].lost).toMatchObject({ turn: c.turn, how: 'killed or carried off' }); // the record of her is kept
    expect(c.chronicle!.length).toBe(told + 1);
    expect(musterFolk(c, h.id).people.named).toBeUndefined();
  }, LONG);

  it('a soldier who made a name is one of the notable people of the chief town, and is lost with the army', () => {
    const { c } = assault(), h = home(c);
    finishBattle(c, true, { clubman: 6, warlord: 1 }, { champion: { name: 'Osric', kills: 7, unit: 'Clubman' } });
    expect(living(folkOf(c, h.id))).toEqual([expect.objectContaining({ name: 'Osric', kind: 'veteran', kills: 7 })]);
    rememberVeteran(c, h.id, { name: 'Osric', kills: 9, unit: 'Clubman' }); // the same man, and more to his name: still one record
    expect(folkOf(c, h.id).notables.length).toBe(1);
    expect(folkOf(c, h.id).notables[0].kills).toBe(9);
    // The army he marches with goes against another land and does not come back.
    const army = c.armies.find((a) => a.owner === 0 && a.champion)!;
    army.moved = false;
    const next = army.at;
    army.at = h.id; // home again, and the land it took has risen behind it
    Object.assign(c.territories[next], { owner: -1, horde: false, militia: 2 });
    c.demand = null;
    expect(moveArmy(c, army.id, next)).toBe('battle');
    finishBattle(c, false);
    expect(living(folkOf(c, h.id))).toEqual([]);
    expect(folkOf(c, h.id).notables[0].lost).toMatchObject({ how: 'fell in battle' });
    expect(c.chronicle!.some((x) => x.text.includes('Osric') && x.text.includes('fell in battle'))).toBe(true);
  }, LONG);
});
