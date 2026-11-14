// Which units are pagan, and what a town that keeps the faith does about them. The owner settled the list:
// the Shaman and the Slaver. The Berserker was marked before that and is left as it was.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { BUILDINGS, UNITS } from '../src/sim/data';
import { isDecadent, isHoly } from '../src/sim/creed';

const town = (virtue: number) => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 4; p.virtue = virtue; p.dilemmaT = 1e9; p.popCap = 60;
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 9000;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const at = (type: string, dx: number, dy: number) => g.spawnBuilding(type, 0, Math.floor(tc.x) + dx, Math.floor(tc.y) + dy, true);
  return { g, p, church: at('temple', 6, 3), barracks: at('barracks', -9, 3), tavern: at('tavern', 6, -8) };
};
const pagan = Object.values(UNITS).filter((u) => u.pagan).map((u) => u.id).sort();

describe('pagan units', () => {
  it('are the Shaman and the Slaver (and the Berserker, as before); the Prophet and the Priest are not', () => {
    expect(pagan).toEqual(['berserker', 'shaman', 'slaver']);
    expect(UNITS.prophet.pagan).toBeFalsy();
    expect(UNITS.priest.pagan).toBeFalsy();
    expect(UNITS.marauder.pagan).toBeFalsy(); // no town trains him: the mark would mean nothing
  });

  it('no nation loses a unit of its own by keeping the faith', () => {
    expect(Object.values(UNITS).filter((u) => u.pagan && u.civ)).toEqual([]);
  });

  it('each says so in its description', () => {
    for (const id of pagan) expect(UNITS[id].desc).toMatch(/Pagan: a town that keeps the faith will not/);
    for (const u of Object.values(UNITS)) if (!u.pagan) expect(u.desc).not.toMatch(/Pagan/);
  });

  it('every one of them can be trained somewhere, so the mark is not on a unit no one could raise', () => {
    for (const id of pagan) expect(Object.values(BUILDINGS).some((b) => b.trains.includes(id))).toBe(true);
  });

  it('a town refuses them from the moment it is Devout, and not a point before', () => {
    expect(isHoly(30)).toBe(true);
    expect(isHoly(29)).toBe(false);
    const below = town(29), holy = town(30);
    expect(below.g.creedBar(0, UNITS.shaman)).toBeNull();
    expect(below.g.creedBar(0, UNITS.berserker)).toBeNull();
    expect(below.g.cmdTrain(0, below.church.id, 'shaman')).toBe(true);
    expect(below.g.cmdTrain(0, below.barracks.id, 'berserker')).toBe(true);
    for (const id of pagan) expect(holy.g.creedBar(0, UNITS[id])).toBe(`A town that keeps the faith will not have a ${UNITS[id].name}.`);
    expect(holy.g.cmdTrain(0, holy.church.id, 'shaman')).toBe(false);
    expect(holy.g.cmdTrain(0, holy.barracks.id, 'berserker')).toBe(false);
    expect(holy.g.cmdTrain(0, holy.tavern.id, 'slaver')).toBe(false);
    expect(holy.g.cmdTrain(0, holy.barracks.id, 'swordsman')).toBe(true); // honest soldiers are fine
  });

  it('the Slaver is doubly barred: pagan to the faithful, and only the Decadent would have him at all', () => {
    const middling = town(0), fallen = town(-80);
    expect(isDecadent(-80)).toBe(true);
    expect(middling.g.creedBar(0, UNITS.slaver)).toBe('Only a Decadent town would have a Slaver.');
    expect(middling.g.cmdTrain(0, middling.tavern.id, 'slaver')).toBe(false);
    expect(fallen.g.creedBar(0, UNITS.slaver)).toBeNull();
    expect(fallen.g.cmdTrain(0, fallen.tavern.id, 'slaver')).toBe(true);
  });

  it('the Prophet is called by a faithful town and a worldly one alike', () => {
    for (const v of [80, 0, -80]) expect(town(v).g.creedBar(0, UNITS.prophet)).toBeNull();
  });

  it('pagans already in the town when it turns to the faith are not sent away', () => {
    const { g, p } = town(0);
    const shaman = g.spawnUnit('shaman', 0, 40, 40);
    p.virtue = 80;
    for (let i = 0; i < 200; i++) g.step();
    expect(shaman.dead).toBe(false);
    expect(shaman.owner).toBe(0);
  });
});
