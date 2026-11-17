// A man home on leave comes home to his own door (src/sim/leavehome.ts).
import { describe, expect, it } from 'vitest';
import { Building, Game, Unit } from '../src/sim/game';
import { armyAt, newCampaign } from '../src/sim/campaign';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { comeHome, doorOf } from '../src/sim/leavehome';
import { run, spot, villagers } from './helpers';

/** The player's chief town, visited, with the army it began with standing in it. */
const town = (): Game => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  expect(armyAt(c, home.id)).toBeTruthy();
  expect(beginVisit(c, home.id)).toBe(true);
  const cfg = visitConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  while (houses(g).length < 3) { const at = spot(g, 'house', 0); g.spawnBuilding('house', 0, at.cx, at.cy, true); } // three roofs at the least
  return g;
};
const houses = (g: Game): Building[] => g.buildings.filter((b) => b.owner === 0 && b.type === 'house' && b.complete && !b.dead);
/** Every house of the town with a man and a woman in it already, but those named: no door is free by chance. */
const fill = (g: Game, but: Building[] = []): void => {
  for (const h of houses(g)) {
    if (but.includes(h)) continue;
    for (const s of ['m', 'f'] as const) if (!h.residents[s]) { const u = g.spawnUnit('villager', 0, h.x, h.y + 2, s); h.residents[s] = u.id; u.homeId = h.id; }
  }
};
const empty = (g: Game, h: Building): void => { for (const s of ['m', 'f'] as const) { const u = g.entities.get(h.residents[s]); if (u && u.kind === 'unit') u.homeId = 0; h.residents[s] = 0; } };
const man = (g: Game, name: string, family: string, by: Building): Unit => { const v = g.spawnUnit('villager', 0, by.x + 3, by.y + 3, 'm'); v.name = name; v.family = family; return v; };

describe('a man home on leave comes home to his own door', () => {
  it('a soldier who goes home walks to the house of his name and is its man', () => {
    const g = town();
    const mine = houses(g)[1], first = g.players[0].furlough!.men[0];
    empty(g, mine); fill(g, [mine]);
    mine.family = first.family ?? 'Ashdown'; first.family = mine.family; first.tie = 'husband'; // the man of his house
    const wife = g.spawnUnit('villager', 0, mine.x, mine.y + 2, 'f'); mine.residents.f = wife.id; wife.homeId = mine.id;
    const soldier = g.units.find((u) => u.owner === 0 && !u.dead && !!g.players[0].furlough!.per[u.type])!;
    expect(g.cmdGoHome(0, [soldier.id])).toBe(1);
    const him = villagers(g, 0).find((v) => v.onLeave)!;
    expect(him.order).toMatchObject({ t: 'movein', id: mine.id });
    run(g, 60);
    expect(mine.residents.m).toBe(him.id);
    expect(him.homeId).toBe(mine.id);
    expect(mine.residents.f).toBe(wife.id); // beside his wife
  }, 60_000);

  it('a man seated in his place under his name gives it up, and has a name of his own again', () => {
    const g = town();
    const mine = houses(g)[0];
    empty(g, mine); fill(g, [mine]);
    mine.family = 'Barrow';
    const other = man(g, 'Edric', 'Barrow', mine); mine.residents.m = other.id; other.homeId = mine.id;
    const him = man(g, 'Edric', 'Barrow', mine);
    expect(doorOf(g, him)).toMatchObject({ house: mine, as: 'husband' });
    expect(comeHome(g, him)).toBe(mine);
    expect(other.homeId).toBe(0);
    expect(other.name).not.toBe('Edric');
    expect(other.family).toBe('');
    run(g, 30);
    expect(mine.residents.m).toBe(him.id);
  }, 60_000);

  it('a son of a house that has its man is of that house, and under no roof of his own', () => {
    const g = town();
    const mine = houses(g)[0];
    empty(g, mine); fill(g, [mine]);
    mine.family = 'Barrow';
    const father = man(g, 'Holt', 'Barrow', mine); mine.residents.m = father.id; father.homeId = mine.id;
    const him = man(g, 'Edric', 'Barrow', mine);
    expect(doorOf(g, him)).toMatchObject({ house: mine, as: 'son' });
    expect(comeHome(g, him)).toBe(mine);
    expect(him.bornAt).toBe(mine.id);
    expect(him.homeId).toBe(0);
    expect(mine.residents.m).toBe(father.id);
    expect(him.order?.t).not.toBe('movein');
  });

  it('his house gone, he takes the nearest empty one, and never a woman\'s alone', () => {
    const g = town();
    const [a, b, c] = houses(g);
    expect(c).toBeTruthy();
    fill(g); empty(g, a); empty(g, b); empty(g, c);
    const widow = g.spawnUnit('villager', 0, a.x, a.y + 2, 'f'); a.residents.f = widow.id; widow.homeId = a.id;
    const him = man(g, 'Edric', 'Nowhere', a); // nearest the woman's house
    const door = doorOf(g, him)!;
    expect(door.as).toBe('new');
    expect([b, c]).toContain(door.house);
    const far = door.house === b ? c : b;
    expect(Math.hypot(door.house.x - him.x, door.house.y - him.y)).toBeLessThanOrEqual(Math.hypot(far.x - him.x, far.y - him.y));
    expect(comeHome(g, him)).toBe(door.house);
    run(g, 60);
    expect(door.house.residents.m).toBe(him.id);
    expect(a.residents.m).toBe(0);
  }, 60_000);

  it('a town with no door for him leaves him as he was, and a housed man is not moved', () => {
    const g = town();
    fill(g);
    const him = man(g, 'Edric', 'Nowhere', houses(g)[0]);
    expect(doorOf(g, him)).toBeNull();
    expect(comeHome(g, him)).toBeNull();
    expect(him.homeId).toBe(0);
    const housed = g.entities.get(houses(g)[0].residents.m) as Unit;
    expect(comeHome(g, housed)).toBeNull();
    expect(housed.homeId).toBe(houses(g)[0].id);
  });

  it('he takes up arms again: his place in the house is free', () => {
    const g = town();
    const mine = houses(g)[0], first = g.players[0].furlough!.men[0];
    empty(g, mine); fill(g, [mine]);
    mine.family = first.family ?? 'Ashdown'; first.family = mine.family; first.tie = 'husband'; // the man of his house
    const soldier = g.units.find((u) => u.owner === 0 && !u.dead && !!g.players[0].furlough!.per[u.type])!;
    g.cmdGoHome(0, [soldier.id]);
    const him = villagers(g, 0).find((v) => v.onLeave)!;
    run(g, 60);
    expect(mine.residents.m).toBe(him.id);
    expect(g.cmdRejoin(0, [him.id])).toBe(1);
    run(g, 10);
    expect(mine.residents.m).toBe(0);
  }, 60_000);

  it('a son of the house does not take the place of its man, who is away too', () => {
    const g = town();
    const mine = houses(g)[0];
    empty(g, mine); fill(g, [mine]);
    mine.family = 'Barrow';
    const mother = g.spawnUnit('villager', 0, mine.x, mine.y + 2, 'f'); mine.residents.f = mother.id; mother.homeId = mine.id; // her husband is with the army
    const son = man(g, 'Edric', 'Barrow', mine); son.onLeave = { as: 'clubman', n: 2, tie: 'son' };
    expect(doorOf(g, son)).toMatchObject({ house: mine, as: 'son' });
    son.onLeave = undefined; // comeHome seats whoever is not yet housed; the tie is read from onLeave
    son.onLeave = { as: 'clubman', n: 2, tie: 'son' };
    expect(comeHome(g, son)).toBe(mine);
    expect(mine.residents.m).toBe(0);
    expect(son.bornAt).toBe(mine.id);
    const husband = man(g, 'Holt', 'Barrow', mine); husband.onLeave = { as: 'clubman', n: 2, tie: 'husband' };
    expect(doorOf(g, husband)).toMatchObject({ house: mine, as: 'husband' });
  });
});
