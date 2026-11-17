// A side with no people left does not hold a battle open (src/sim/lastperson.ts; docs/DESIGN.md, "A soldier costs a person").
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { nobodyLeft } from '../src/sim/lastperson';
import { run, setups } from './helpers';

const wipe = (g: Game, owner: number) => { for (const u of g.units.filter((x) => x.owner === owner)) g.perish(u); };

describe('a town with nobody left in it', () => {
  it('where nobody is bought, it is beaten when its last person is gone, though its hall still stands', () => {
    const g = new Game(7, setups);
    g.bornOnly = true;
    expect(nobodyLeft(g, 1)).toBe(false);
    run(g, 3);
    expect(g.players[1].defeated).toBe(false);
    wipe(g, 1);
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'towncenter' && !b.dead)).toBe(true);
    expect(nobodyLeft(g, 1)).toBe(true);
    run(g, 3);
    expect(g.players[1].defeated).toBe(true);
    expect(g.winner).toBe(0);
  });

  it('one person left is enough to hold on', () => {
    const g = new Game(7, setups);
    g.bornOnly = true;
    const mine = g.units.filter((x) => x.owner === 1);
    for (const u of mine.slice(1)) g.perish(u);
    run(g, 5);
    expect(nobodyLeft(g, 1)).toBe(false);
    expect(g.players[1].defeated).toBe(false);
    expect(g.winner).toBe(-1);
  });

  it('in a skirmish a people with a hall can still buy a villager, and is not finished by this', () => {
    const g = new Game(7, setups);
    expect(g.bornOnly).toBe(false);
    wipe(g, 1);
    expect(nobodyLeft(g, 1)).toBe(false);
    run(g, 3);
    expect(g.players[1].defeated).toBe(false);
  });

  it('not in the open field, which has its own rule, and children alone do not hold a town', () => {
    const g = new Game(7, setups);
    g.bornOnly = true;
    wipe(g, 1);
    const house = g.buildings.find((b) => b.owner === 1 && !b.dead)!;
    house.young = [{ left: 5, gender: 'm' } as never];
    expect(nobodyLeft(g, 1)).toBe(true); // a child cannot hold the town, and is still counted home with it
    expect(g.census(1).children).toBe(1);
    (g as { field: boolean }).field = true;
    expect(nobodyLeft(g, 1)).toBe(false);
  });
});
