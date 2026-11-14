// Children are a record under a roof, never people on the map (src/sim/nursery.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { BIRTH_TIME, GROW_TIME } from '../src/sim/data';
import { GROWN_AT, ageYoung, wardFor, yearsLeft, yearsOld } from '../src/sim/nursery';
import type { Child } from '../src/sim/nursery';
import { run, setups, spot, villagers } from './helpers';

const child = (over: Partial<Child> = {}): Child => ({ id: 1, name: 'Small', family: 'Reed', gender: 'f', trait: 'strong', trait2: '', lifespan: 9999, left: GROW_TIME, bornAt: 0, ...over });
/** A town with a couple in a house, fed, and the house's record. */
const family = () => {
  const g = new Game(5, setups);
  for (const q of g.players) q.dilemmaT = 1e9;
  const vs = villagers(g, 0), man = vs.find((v) => v.gender === 'm')!, woman = vs.find((v) => v.gender === 'f')!;
  const hs = spot(g, 'house', 0), house = g.spawnBuilding('house', 0, hs.cx, hs.cy, true);
  house.residents = { m: man.id, f: woman.id };
  g.players[0].res.food = 99999;
  return { g, house, man, woman };
};

describe('the record itself', () => {
  it('counts a child\'s years towards fifteen', () => {
    expect([yearsOld(child()), yearsLeft(child())]).toEqual([0, GROWN_AT]);
    expect(yearsOld(child({ left: GROW_TIME / 2 }))).toBe(7);
    expect(yearsLeft(child({ left: 0.01 }))).toBe(1);
  });
  it('hands back those grown and keeps the rest: no child is ever lost', () => {
    const young = [child({ id: 1, left: 1 }), child({ id: 2, left: 30 }), child({ id: 3, left: 10 })];
    const grown = ageYoung(young, 1);
    expect([grown.map((c) => c.id), young.map((c) => c.id)]).toEqual([[1], [2, 3]]);
  });
  it('sends the children of a fallen house to the nearest house, then the Town Center, then any roof, and never to a stranger', () => {
    const roof = (id: number, type: string, x: number, owner = 0) => ({ id, owner, type, complete: true, dead: false, x, y: 0 });
    const from = roof(1, 'house', 0);
    expect(wardFor([from, roof(2, 'towncenter', 1), roof(3, 'house', 9), roof(4, 'house', 5)], from)!.id).toBe(4);
    expect(wardFor([from, roof(2, 'towncenter', 1), roof(5, 'barracks', 0.5)], from)!.id).toBe(2);
    expect(wardFor([from, roof(5, 'barracks', 3)], from)!.id).toBe(5);
    expect(wardFor([from, roof(6, 'house', 1, 1)], from)).toBe(null);
  });
});

describe('children in a town', () => {
  it('no child is ever a unit: a birth adds to the house\'s record and to the count of the people, and nobody new is seen', () => {
    const { g, house } = family();
    const seen = villagers(g, 0).length, pop = g.players[0].pop;
    let small = 0;
    run(g, BIRTH_TIME + 2, () => { for (const u of g.units) if (u.growT > 0 || u.maxHp < u.def.hp * 0.9) small++; });
    expect(house.young!.length).toBe(1);
    expect(villagers(g, 0).length).toBe(seen);
    expect(g.players[0].pop).toBe(pop + 1);
    expect(small).toBe(0);
  });
  it('at coming of age a grown villager steps out with the name, family, trait and span of life the record held', () => {
    const { g, house } = family();
    house.young = [child({ id: 99991, name: 'Wren', family: 'Reed', trait: 'hardy', lifespan: 4321, left: 2, bornAt: house.id })];
    g.players[0].pop++;
    const pop = g.players[0].pop;
    run(g, 3);
    const u = villagers(g, 0).find((v) => v.name === 'Wren')!;
    expect([u.family, u.trait, u.lifespan, u.gender, u.growT, u.bornAt]).toEqual(['Reed', 'hardy', 4321, 'f', 0, house.id]);
    expect(u.maxHp).toBe(Math.round(u.def.hp * 1.5));
    expect(house.young!.length).toBe(0);
    expect(g.players[0].pop).toBe(pop); // the villager is counted in the child's place, not as well
  });
  it('when their house is destroyed the children are unharmed and pass to another roof, where they grow up', () => {
    const { g, house } = family();
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    house.young = [child({ id: 99991, name: 'Wren', left: 6, bornAt: house.id }), child({ id: 99992, name: 'Lark', gender: 'm', left: 8, bornAt: house.id })];
    g.players[0].pop += 2;
    const pop = g.players[0].pop;
    house.hp = 1; house.burnT = 5;
    run(g, 2);
    expect(house.dead).toBe(true);
    expect(tc.young!.map((c) => c.name).sort()).toEqual(['Lark', 'Wren']);
    expect(g.players[0].pop).toBe(pop);
    run(g, 8);
    expect(villagers(g, 0).filter((v) => v.name === 'Wren' || v.name === 'Lark').length).toBe(2);
  });
  it('the death or capture of their parents does not touch them', () => {
    const { g, house, man, woman } = family();
    house.young = [child({ id: 99991, name: 'Wren', left: 6, bornAt: house.id })];
    g.players[0].pop++;
    g.cmdDelete(0, [man.id, woman.id]);
    run(g, 2);
    expect(house.young!.length).toBe(1);
    run(g, 6);
    expect(villagers(g, 0).some((v) => v.name === 'Wren')).toBe(true);
  });
  it('a people with no roof left keeps its children with it', () => {
    const { g, house } = family();
    house.young = [child({ id: 99991, name: 'Wren', left: 6, bornAt: house.id })];
    g.players[0].pop++;
    for (const b of g.buildings.filter((x) => x.owner === 0 && x !== house)) { b.hp = 1; b.burnT = 5; }
    house.hp = 2; house.burnT = 5;
    run(g, 2);
    expect(g.buildings.some((b) => b.owner === 0)).toBe(false);
    expect(g.players[0].wards!.map((c) => c.name)).toEqual(['Wren']);
    // (With its last roof gone this people is beaten and the game is over: the children leave the story with it, unharmed.)
  });
  it('children travelling with their people grow up among them once there is a door or a companion to stand beside', () => {
    const { g } = family();
    g.players[0].wards = [child({ id: 99991, name: 'Wren', left: 3 })];
    g.players[0].pop++;
    run(g, 5);
    expect(g.players[0].wards.length).toBe(0);
    expect(villagers(g, 0).some((v) => v.name === 'Wren')).toBe(true);
  });
});
