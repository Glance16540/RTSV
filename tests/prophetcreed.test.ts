// What a Prophet calls down goes by the creed of those it falls on, as his plague always did (src/sim/wrath.ts; game.ts).
import { describe, expect, it } from 'vitest';
import { CALAMITY } from '../src/sim/data';
import { creedOf } from '../src/sim/creed';
import { Game } from '../src/sim/game';
import { wrath } from '../src/sim/wrath';
import { run, setups, spot } from './helpers';

/** A battle where the second side stands at `virtue`, with a house and a farm of theirs and a Prophet of the first side beside them, full of faith. */
function field(virtue: number) {
  const g = new Game(7, setups);
  g.players[1].virtue = virtue;
  const at = spot(g, 'house', 1), house = g.spawnBuilding('house', 1, at.cx, at.cy, true);
  const fa = spot(g, 'farm', 1), farm = g.spawnBuilding('farm', 1, fa.cx, fa.cy, true);
  const p = g.spawnUnit('prophet', 0, house.x, house.y - 3);
  p.hp = p.maxHp = 99999; p.mana = 1000;
  return { g, house, farm, p };
}
const STANDINGS: [string, number][] = [['Virtuous', 90], ['Upright', 50], ['ordinary', 0], ['Dissolute', -50], ['Depraved', -90]];

describe('what a Prophet calls down goes by the creed of those it falls on', () => {
  it('the measure is the creed\'s: a third for the Virtuous, one for an ordinary people, half again for the Depraved', () => {
    expect(STANDINGS.map(([, v]) => wrath(field(v).g, 1))).toEqual([1 / 3, 0.5, 1, 1.25, 1.5]);
  });
  for (const [name, virtue] of STANDINGS) {
    it(`Fire from Heaven burns a building of a ${name} people for its measure of the common time`, () => {
      const { g, house, p } = field(virtue), w = creedOf(virtue).plague;
      expect(g.cmdCast(0, [p.id], 'fire', house.x, house.y)).toBe(true);
      let most = 0;
      run(g, 3, () => { most = Math.max(most, house.burnT); });
      expect(most).toBeGreaterThan(CALAMITY.fire * w - 3.1); // it has burnt down a little by the time it is read
      expect(most).toBeLessThanOrEqual(CALAMITY.fire * w + 1e-9);
    });
    it(`Blight lies on a field of a ${name} people for its measure of the common time`, () => {
      const { g, farm, p } = field(virtue), w = creedOf(virtue).plague;
      p.x = farm.x; p.y = farm.y - 3;
      expect(g.cmdCast(0, [p.id], 'blight', farm.x, farm.y)).toBe(true);
      let most = 0;
      run(g, 3, () => { most = Math.max(most, farm.blightT ?? 0); });
      expect(most).toBeGreaterThan(CALAMITY.blight * w - 3.1);
      expect(most).toBeLessThanOrEqual(CALAMITY.blight * w + 1e-9);
    });
  }
  it('an Earthquake shakes a building of the Virtuous a third as hard as an ordinary people\'s, and the Depraved\'s half again as hard', () => {
    const shaken = (virtue: number): number => {
      const { g, house, p } = field(virtue);
      house.hp = house.maxHp = 100000; // so that it stands through the whole of it
      expect(g.cmdCast(0, [p.id], 'quake', house.x, house.y)).toBe(true);
      run(g, 9);
      return 100000 - house.hp;
    };
    const holy = shaken(90), plain = shaken(0), low = shaken(-90);
    expect(plain).toBeGreaterThan(100);
    expect(holy / plain).toBeCloseTo(1 / 3, 2);
    expect(low / plain).toBeCloseTo(1.5, 2);
  });
  it('an ordinary people is struck exactly as before: the common time, to the second', () => {
    const { g, house, p } = field(0);
    g.cmdCast(0, [p.id], 'fire', house.x, house.y);
    let most = 0;
    run(g, 3, () => { most = Math.max(most, house.burnT); });
    expect(most).toBeLessThanOrEqual(CALAMITY.fire);
    expect(most).toBeGreaterThan(CALAMITY.fire - 3.1);
  });
});
