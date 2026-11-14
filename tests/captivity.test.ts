// What being held costs (docs/DESIGN.md, "Captivity"; the rules are in src/sim/captivity.ts): a captive can be
// got back only for a time, comes home older, and a woman's children born there are hers and come home with her.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import type { Building, Captive, Unit } from '../src/sim/game';
import { CAPTIVE_HOLD, CAPTIVE_WARN, CHILD_WORK, LIFE_YEARS, SOLD_GOLD, YEARS_MAN, YEARS_WOMAN, campChildren, campLabour, heldFor, takenFrom, timeLeft, yearsSpent } from '../src/sim/captivity';
import { CAMP_BIRTH } from '../src/sim/creed';
import { GROW_TIME } from '../src/sim/data';
import { heldPanel, takenPanel } from '../src/client/captives';
import { run } from './helpers';

/** A decadent town (0) with a Work Camp, and a settled rival (1) whose people it holds, seized at the moment given. */
const camped = (people: ['m' | 'f', number][], seed = 5) => {
  const g = new Game(seed, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 2; p.virtue = -80; p.popCap = 60;
  for (const q of g.players) q.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
  camp.captives = people.map(([gender, taken], i): Captive => ({ from: 1, name: (gender === 'f' ? 'Ada' : 'Bram') + i, family: 'Hale', gender, trait: '', trait2: '', age: 100, lifespan: 1080, taken, story: [{ t: taken, s: 'Seized by slavers' }] }));
  // Guards enough that no one slips away in the night: this is about the clock, not the stockade.
  const posted = [0, 1, 2, 3].map((i) => g.spawnUnit('slaver', 0, camp.x - 1 + i * 0.6, camp.y + 3));
  g.cmdTarget(0, posted.map((s) => s.id), camp.id);
  const said: string[][] = g.players.map(() => []);
  const through = (seconds: number) => run(g, seconds, () => { for (const e of g.events) if (e.t === 'msg') said[e.player]?.push(e.text); g.events.length = 0; });
  const kill = (e: Building | Unit) => (g as unknown as { kill(e: Building | Unit): void }).kill(e);
  const home = (name: string) => g.units.find((u) => u.owner === 1 && u.name === name);
  const youngOf = (owner: number) => g.buildings.filter((b) => b.owner === owner).flatMap((b) => b.young ?? []).concat(g.players[owner].wards ?? []);
  return { g, p, camp, said, through, kill, home, youngOf };
};

describe('a captive can be got back only for a time', () => {
  it('the clock runs from the moment they were seized; one set down by a mission is not on it', () => {
    const { g, camp, through } = camped([['m', 0]]);
    const c = camp.captives![0];
    expect(timeLeft(g, c)).toBe(CAPTIVE_HOLD);
    through(100);
    expect(Math.round(heldFor(g, c))).toBe(100);
    expect(Math.round(timeLeft(g, c)!)).toBe(CAPTIVE_HOLD - 100);
    const placed: Captive = { from: 1, name: 'Set', family: '', gender: 'm', trait: '', trait2: '', age: 0, lifespan: 9999 };
    expect(timeLeft(g, placed)).toBeNull();
    expect(yearsSpent(g, placed)).toBe(0);
  });

  it('a villager really seized is put on the clock', () => {
    const { g, through } = camped([]);
    const slaver = g.spawnUnit('slaver', 0, 46, 46), victim = g.spawnUnit('villager', 1, 47, 46, 'm');
    g.cmdTarget(0, [slaver.id], victim.id);
    through(6);
    expect(slaver.captive?.taken).toBeGreaterThan(0);
    expect(slaver.captive!.taken).toBeLessThanOrEqual(g.time);
    expect(takenFrom(g, 1).map((t) => t.where)).toEqual(['the road, being led away']);
  });

  it('their people are warned two minutes before, once; then they are sold on, the keeper is paid, and they are past getting back', () => {
    const { g, p, camp, said, through, home } = camped([['m', 0], ['f', 200]]);
    through(CAPTIVE_HOLD - CAPTIVE_WARN - 5);
    expect(said[1].some((t) => t.includes('Bram0'))).toBe(false);
    through(10);
    expect(said[1].filter((t) => t.includes('Bram0') && t.includes('sold on, and past getting back')).length).toBe(1);
    through(CAPTIVE_WARN - 10);
    expect(camp.captives!.map((c) => c.name)).toEqual(['Bram0', 'Ada1']);
    expect(said[1].filter((t) => t.includes('Bram0') && t.includes('past getting back')).length).toBe(1); // told once
    const gold = p.res.gold;
    through(8);
    expect(camp.captives!.map((c) => c.name)).toEqual(['Ada1']); // she was taken later: her time is not up
    expect(said[1].some((t) => t === '🕯️ Bram0 has been sold on from the work camp and is lost to you.')).toBe(true);
    expect(said[0].some((t) => t.includes(`Bram0 has been sold on for ${SOLD_GOLD} gold`))).toBe(true);
    expect(p.res.gold).toBeGreaterThanOrEqual(gold + SOLD_GOLD);
    expect(home('Bram0')).toBeUndefined();
    expect(takenFrom(g, 1).map((t) => t.c.name)).toEqual(['Ada1']);
  }, 30000);

  it('the children of a woman sold on are lost with her', () => {
    const { camp, said, through, youngOf } = camped([['f', 0]]);
    through(CAPTIVE_HOLD + 3);
    expect(camp.captives!.length).toBe(0);
    expect(said[1].some((t) => t.includes('Ada0 has been sold on') && /children born there are lost with her/.test(t))).toBe(true);
    expect(youngOf(1).length).toBe(0);
  }, 30000);

  it('in the marauders\' camp she does not outlive it: when her time is up she is dead', () => {
    const { g, said, through, kill, home } = camped([]);
    const lair = g.spawnBuilding('lair', g.wild, 20, 20, true);
    g.marauders = true;
    lair.captives = [{ from: 1, name: 'Mara', family: '', gender: 'f', trait: '', trait2: '', age: 0, lifespan: 1080, held: true, taken: g.time }];
    (g as unknown as { lairMade: boolean }).lairMade = true;
    through(CAPTIVE_HOLD - 20);
    expect(lair.captives.length).toBe(1);
    expect(said[1].some((t) => t.includes('Mara') && t.includes('she will be dead'))).toBe(true);
    through(25);
    expect(lair.captives.length).toBe(0);
    expect(said[1].some((t) => t.startsWith('🕯️ Mara, held by the marauders, is dead.'))).toBe(true);
    kill(lair);
    expect(home('Mara')).toBeUndefined(); // burning it now brings no one back
  }, 30000);
});

describe('captivity shortens a life', () => {
  it('a man held the whole time loses about twenty years, a woman thirty, and less in proportion', () => {
    const { g, camp, through } = camped([['m', 0], ['f', 0]]);
    through(CAPTIVE_HOLD / 2);
    const [man, woman] = camp.captives!;
    expect(yearsSpent(g, man)).toBeCloseTo(YEARS_MAN / 2, 0);
    expect(yearsSpent(g, woman)).toBeCloseTo(YEARS_WOMAN / 2, 0);
    expect(YEARS_MAN).toBe(20);
    expect(YEARS_WOMAN).toBeGreaterThan(YEARS_MAN);
  });

  it('someone got back comes home with the years already spent, and it is set down in their record', () => {
    const { camp, through, kill, home } = camped([['m', 0], ['f', 0]]);
    through(CAPTIVE_HOLD / 2);
    kill(camp);
    const man = home('Bram0')!, woman = home('Ada1')!;
    // They went in at age 100 of a span of 1080 seconds; half the time held costs him ten years of fifty-four, her fifteen.
    expect(man.lifespan).toBe(1080);
    expect(man.age).toBeCloseTo(100 + (YEARS_MAN / 2 / LIFE_YEARS) * 1080, -1);
    expect(woman.age).toBeCloseTo(100 + (YEARS_WOMAN / 2 / LIFE_YEARS) * 1080, -1);
    expect(woman.age).toBeGreaterThan(man.age);
    expect(man.story!.map((d) => d.s)).toEqual(['Seized by slavers', 'Freed, and came home', 'Held 5 minutes: came home 10 years older']);
    expect(woman.story!.some((d) => d.s === 'Held 5 minutes: came home 15 years older')).toBe(true);
  }, 30000);

  it('no one dies of it at the gate: however old it makes them, they come home', () => {
    const { g, camp, through, kill, home } = camped([['f', 0]]);
    camp.captives![0].age = 900; // already old when taken
    through(CAPTIVE_HOLD - 30);
    kill(camp);
    const her = home('Ada0')!;
    expect(her.dead).toBe(false);
    expect(her.age).toBeLessThan(her.lifespan);
    expect(her.age).toBeGreaterThan(900);
    void g;
  }, 30000);

  it('one got out at once has lost nothing', () => {
    const { camp, kill, home } = camped([['m', 0]]);
    kill(camp);
    expect(home('Bram0')!.age).toBe(100);
    expect(home('Bram0')!.story!.map((d) => d.s)).toEqual(['Seized by slavers', 'Freed, and came home']);
  });
});

describe('children born in captivity', () => {
  it('are lines on their mother\'s record: the keeper gains no villager, only more out of the camp', () => {
    const { g, p, camp, through } = camped([['f', 0], ['f', 0], ['m', 0]]);
    const mine = () => g.units.filter((u) => u.owner === 0 && u.type === 'villager').length;
    const before = mine(), units = g.units.length;
    through(Math.ceil(CAMP_BIRTH / 2) + 2); // two women: one child in half the time
    expect(campChildren(camp)).toBe(1);
    through(Math.ceil(CAMP_BIRTH / 2) + 2);
    expect(campChildren(camp)).toBe(2);
    expect(camp.captives!.map((c) => c.born ?? 0)).toEqual([1, 1, 0]); // each woman in turn; never the man
    expect(camp.captives![0].young![0]).toMatchObject({ family: 'Hale', bornAt: 0 });
    expect(camp.captives![0].young![0].left).toBeLessThan(GROW_TIME); // growing, on the record
    expect(mine()).toBeLessThanOrEqual(before + 1); // nothing from the camp (the town's own houses may bear one)
    expect(g.units.length).toBeLessThanOrEqual(units + 1); // no child is ever a figure on the map
    expect(campLabour(camp)).toBe(2 * CHILD_WORK);
    expect(p.captiveMen).toBeCloseTo(1 * (1 + 0.25 * 4) + 2 * CHILD_WORK, 5); // one man under four guards, and two children
  }, 30000);

  it('come home with her when she is got back, to grow up under a roof of her own people', () => {
    const { g, camp, said, through, kill, home, youngOf } = camped([['f', 0]]);
    through(CAMP_BIRTH * 2 + 5);
    const born = camp.captives![0].young!.map((k) => k.name);
    expect(born.length).toBe(2);
    const pop = g.players[1].pop, keeper = g.players[0].pop;
    kill(camp);
    const her = home('Ada0')!;
    expect(her.captiveKids).toBe(2);
    expect(youngOf(1).map((k) => k.name).sort()).toEqual([...born].sort());
    expect(youngOf(0).length).toBe(0); // not the keeper's
    expect(g.players[1].pop).toBe(pop + 1 + 2); // herself, and each child counted among her people
    expect(g.players[0].pop).toBe(keeper);
    expect(her.story!.some((d) => d.s === 'Brought home 2 children born in captivity')).toBe(true);
    through(1);
    expect(said[1].some((t) => t.includes('Ada0 has brought home 2 children born in captivity. They are yours'))).toBe(true);
    // And they do grow up there: in time each steps out of the door a villager of her people. (One born early may be
    // nearly grown already: the years in the camp counted.)
    const grown = () => g.units.filter((u) => u.owner === 1 && born.includes(u.name) && u.family === 'Hale').length;
    g.players[1].popCap = 80;
    through(GROW_TIME);
    expect(grown() + youngOf(1).filter((k) => born.includes(k.name)).length).toBeGreaterThanOrEqual(1); // some may sicken, as any child may
    expect(grown()).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('the same when she gets out by the gate or slips away', () => {
    const { g, camp, through, youngOf } = camped([['f', 0]]);
    through(CAMP_BIRTH + 5);
    expect(campChildren(camp)).toBe(1);
    g.breakOut(camp, 0);
    expect(youngOf(1).length).toBe(1);
    const her = g.units.find((u) => u.owner === 1 && u.name === 'Ada0')!;
    expect(her.captiveKids).toBe(1);
    expect(her.story!.map((d) => d.s)).toContain('Got out of the camp');
  }, 30000);

  it('a saved game keeps the clock and the children', () => {
    const { g, camp, through } = camped([['f', 0]]);
    through(CAMP_BIRTH + 5);
    const copy = Game.restore(g.serialize());
    const c = copy.buildings.find((b) => b.type === 'workcamp')!.captives![0];
    expect(c.taken).toBe(0);
    expect(c.young).toEqual(camp.captives![0].young);
    expect(Math.round(timeLeft(copy, c)!)).toBe(Math.round(timeLeft(g, camp.captives![0])!));
  }, 30000);
});

describe('what is shown of it', () => {
  it('the camp\'s panel lists who is held, the time each can still be got back in, and the children; the Town Center lists who was taken', () => {
    const { g, camp, through } = camped([['m', 0], ['f', 300]]);
    through(CAMP_BIRTH + 5 > 320 ? CAMP_BIRTH + 5 : 320);
    const keeper = heldPanel(g, camp, 0), theirs = heldPanel(g, camp, 1);
    expect(keeper).toContain('Bram0');
    expect(keeper).toMatch(/Bram0[^·]*4:\d\d/); // about four and a half minutes left of his ten
    expect(theirs).toMatch(/Ada1[^·]*9:\d\d/);
    expect(theirs).toContain('can still be got back');
    expect(keeper).toContain('sold on');
    const tc = takenPanel(g, 1);
    expect(tc).toContain('Taken from this town');
    expect(tc).toMatch(/Bram0 Hale.*A's Work Camp/);
    expect(tc.indexOf('Bram0')).toBeLessThan(tc.indexOf('Ada1')); // soonest lost first
    expect(takenPanel(g, 0)).toBe('');
    // Nothing in any of it but names, places, times and counts.
    for (const text of [keeper, theirs, tc]) expect(text).not.toMatch(/<img|<canvas|<svg/);
  }, 30000);
});
