// The marauders over a long battle: stronger with the age, back after a burning unless hunted down, and what a
// town can be told about them (src/sim/marauders.ts).
import { describe, expect, it } from 'vitest';
import { Game, LAIR_AT } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/game';
import { UNITS, BUILDINGS } from '../src/sim/data';
import { LAIR_AGAIN, LAIR_AWAY, MARAUDER_ATK, MARAUDER_HP, PARTY_NEAR, bandAge, hideWomen, marauderEdge, partyNear, scoutSpots, womenAtRisk } from '../src/sim/marauders';
import { run, villagers } from './helpers';

const two = [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }];
/** A battle with a camp just made. Messages to each people are kept as they come. */
const withCamp = (seed = 3) => {
  const g = new Game(seed, two);
  g.marauders = true;
  for (const p of g.players) p.dilemmaT = 1e9;
  const said: string[][] = g.players.map(() => []);
  const through = (seconds: number) => run(g, seconds, () => { for (const e of g.events) if (e.t === 'msg') said[e.player]?.push(e.text); g.events.length = 0; });
  through(LAIR_AT + 2);
  const lair = () => g.buildings.find((b) => b.type === 'lair');
  const band = () => g.units.filter((u) => u.def.marauder && !u.dead);
  const kill = (e: Building | Unit) => (g as unknown as { kill(e: Building | Unit): void }).kill(e);
  return { g, said, through, lair, band, kill };
};

describe('marauders keep pace with the age', () => {
  it('in the Stone Age they are as they were', () => {
    const { g, lair, band } = withCamp();
    expect(bandAge(g)).toBe(0);
    expect(band().every((u) => u.maxHp === UNITS.marauder.hp && marauderEdge(g, u) === 1)).toBe(true);
    expect(lair()!.maxHp).toBe(BUILDINGS.lair.hp);
  });

  it('they and their stockade grow tougher as the most advanced people advances, the wounded keeping their wounds', () => {
    const { g, through, lair, band } = withCamp();
    const hurt = band()[0];
    hurt.hp = hurt.maxHp / 2;
    g.players[1].age = 2; // one people is enough: the band arms itself against the best of them
    through(2);
    expect(bandAge(g)).toBe(2);
    const hp = Math.round(UNITS.marauder.hp * (1 + MARAUDER_HP * 2));
    expect(band().every((u) => u.maxHp === hp)).toBe(true);
    expect(band().filter((u) => u !== hurt).every((u) => u.hp === hp)).toBe(true);
    expect(hurt.hp / hurt.maxHp).toBeCloseTo(0.5, 1);
    expect(lair()!.maxHp).toBe(Math.round(BUILDINGS.lair.hp * (1 + MARAUDER_HP * 2)));
    // A man who joins later is brought up to it too.
    const late = g.spawnUnit('marauder', g.wild, lair()!.x, lair()!.y + 2.4);
    through(2);
    expect(late.maxHp).toBe(hp);
    // An age is not lost: if that people falls, the band is no weaker for it.
    g.players[1].defeated = true;
    through(2);
    expect(bandAge(g)).toBe(0);
    expect(late.maxHp).toBe(hp);
    // Only marauders: no one else gains by it.
    expect(marauderEdge(g, g.units.find((u) => u.owner === 0)!)).toBe(1);
  });

  it('they strike harder: the same blows on the same wall do more in a later age', () => {
    const dealt = (age: number) => {
      const { g, through, lair, band } = withCamp();
      g.players[0].age = age;
      const wall = g.spawnBuilding('house', 0, lair()!.cx + 6, lair()!.cy, true);
      const man = band()[0];
      man.x = wall.x; man.y = wall.y + wall.size / 2 + 0.5;
      g.cmdTarget(g.wild, [man.id], wall.id);
      through(20);
      return wall.maxHp - wall.hp;
    };
    const stone = dealt(0), later = dealt(2);
    expect(stone).toBeGreaterThan(0);
    expect(later / stone).toBeGreaterThan(1 + MARAUDER_ATK * 2 - 0.15);
  });
});

describe('a burnt camp is not the end of the marauders', () => {
  it('survivors make camp again five minutes later, far from every town, and gather there', () => {
    const { g, said, through, lair, band, kill } = withCamp();
    expect(g.band!.camps).toBe(1);
    const first = lair()!;
    kill(first);
    through(2);
    const left = band().length;
    expect(left).toBeGreaterThanOrEqual(4);
    expect(said[0].some((t) => t.includes('camp is burnt') && t.includes(`${left} of the band are still alive`))).toBe(true);
    expect(said[1].some((t) => t.includes('camp is burnt'))).toBe(true);
    through(LAIR_AGAIN - 10);
    expect(lair()).toBeUndefined(); // not before its time
    expect(said[0].filter((t) => t.includes('camp is burnt')).length).toBe(1); // told once
    through(15);
    const second = lair()!;
    expect(second).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    expect(g.band!.camps).toBe(2);
    expect(g.band!.burnt).toBeUndefined();
    for (const st of g.spec.starts) expect(Math.hypot(st.x - second.x, st.y - second.y)).toBeGreaterThan(18);
    expect(said[0].filter((t) => t.includes('Smoke in the wilds')).length).toBe(2);
    expect(band().length).toBeGreaterThan(left); // fresh men join them there
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(LAIR_AWAY); // not on the old ground
    through(80); // before the next party goes out
    expect(band().every((u) => Math.hypot(u.x - second.x, u.y - second.y) < 14)).toBe(true);
  }, 60000);

  it('hunt down every last one and the band is finished for the rest of the battle', () => {
    const { g, said, through, lair, band, kill } = withCamp();
    kill(lair()!);
    through(30);
    const men = band();
    for (const u of men.slice(1)) kill(u);
    through(5);
    expect(g.band!.over).toBeUndefined(); // one left is enough
    kill(men[0]);
    through(2);
    expect(g.band!.over).toBe(true);
    expect(said[0].some((t) => t.includes('The band is finished'))).toBe(true);
    through(LAIR_AGAIN + 60);
    expect(lair()).toBeUndefined();
    expect(band().length).toBe(0);
    expect(said[0].filter((t) => t.includes('The band is finished')).length).toBe(1);
    expect(scoutSpots(g, 0)).toEqual([]);
  }, 60000);

  it('killing the band while its camp stands does not end it: the camp raises more', () => {
    const { g, through, lair, band, kill } = withCamp();
    for (const u of band()) kill(u);
    through(240);
    expect(g.band!.over).toBeUndefined();
    expect(lair()).toBeTruthy();
    expect(band().length).toBeGreaterThan(0);
  }, 60000);

  it('a saved game remembers how the band stands', () => {
    const { g, through, lair, kill } = withCamp();
    kill(lair()!);
    through(40);
    const copy = Game.restore(g.serialize());
    expect(copy.band).toEqual(g.band);
    expect(copy.band!.burnt).toBeGreaterThan(0);
    run(copy, LAIR_AGAIN - 30);
    expect(copy.buildings.some((b) => b.type === 'lair')).toBe(true);
    expect(copy.band!.camps).toBe(2);
  }, 60000);

  it('a battle without marauders has none of this', () => {
    const g = new Game(3, two);
    run(g, LAIR_AT + 5);
    expect(g.band).toBeUndefined();
    expect(scoutSpots(g, 0)).toEqual([]);
  });
});

describe('what a town can be told about the marauders', () => {
  it('scoutSpots lists open ground far from every town until the camp has been seen', () => {
    const { g, lair } = withCamp();
    const spots = scoutSpots(g, 0);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.length).toBeLessThanOrEqual(4);
    for (const s of spots) for (const st of g.spec.starts) expect(Math.hypot(st.x - s.x, st.y - s.y)).toBeGreaterThanOrEqual(18);
    for (const a of spots) for (const b of spots) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(14);
    // The camp really is at one of them.
    expect(Math.min(...spots.map((s) => Math.hypot(s.x - lair()!.x, s.y - lair()!.y)))).toBeLessThan(8);
    // A scout standing in sight of it: that town looks no further; the other still must.
    g.spawnUnit('swordsman', 0, lair()!.x + 4, lair()!.y).stance = 'hold';
    expect(scoutSpots(g, 0)).toEqual([]);
    expect(scoutSpots(g, 1).length).toBeGreaterThan(0);
  });

  it('partyNear sees a party coming for a town\'s women, and hideWomen gets them indoors until the bell is rung off', () => {
    const { g, through, band } = withCamp();
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    expect(partyNear(g, 0)).toEqual([]);
    expect(hideWomen(g, 0)).toBe(0); // no party, no alarm
    const out = womenAtRisk(g, 0).length;
    expect(out).toBeGreaterThan(0);
    const woman = womenAtRisk(g, 0)[0];
    const man = band()[0];
    // Far off, he is not yet a reason to stop work.
    g.cmdTarget(g.wild, [man.id], woman.id);
    expect(man.order?.t).toBe('capture');
    expect(Math.hypot(man.x - tc.x, man.y - tc.y)).toBeGreaterThan(PARTY_NEAR);
    expect(partyNear(g, 0)).toEqual([]);
    // Near, he is.
    man.x = tc.x + PARTY_NEAR - 3; man.y = tc.y;
    expect(partyNear(g, 0)).toEqual([man]);
    expect(partyNear(g, 1)).toEqual([]); // not the other town's trouble
    expect(hideWomen(g, 1)).toBe(0);
    const sent = hideWomen(g, 0);
    expect(sent).toBe(Math.min(out, 12)); // the hall shelters twelve
    expect(hideWomen(g, 0)).toBe(0); // already on their way: not sent twice
    expect(villagers(g, 0).filter((v) => v.gender === 'm' && v.order?.t === 'shelter').length).toBe(0); // the men work on
    (g as unknown as { kill(e: Unit): void }).kill(man);
    through(25);
    expect(womenAtRisk(g, 0).length).toBe(out - sent);
    expect(tc.sheltered.length).toBe(sent);
    g.cmdBell(0, false);
    through(2);
    expect(womenAtRisk(g, 0).length).toBe(out);
  });
});
