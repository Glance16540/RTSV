// A farmer works in the field, not at its fence (src/sim/fieldwork.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { FIELD, fieldSpot } from '../src/sim/fieldwork';
import { run, setups, spot, villagers } from './helpers';

describe('fieldwork', () => {
  it('a farmer at work stands in among the rows', () => {
    const g = new Game(3, setups), [, v] = villagers(g, 0), at = spot(g, 'farm', 0);
    const farm = g.spawnBuilding('farm', 0, at.cx, at.cy, true);
    g.cmdTarget(0, [v.id], farm.id);
    let inside = 0, working = 0;
    run(g, 60, () => {
      if (v.order?.t !== 'gather' || v.order.phase === 'return' || Math.hypot(v.x - farm.x, v.y - farm.y) > farm.size) return;
      if (v.gatherT > 0) { working++; if (Math.abs(v.x - farm.x) < farm.size / 2 - 0.1 && Math.abs(v.y - farm.y) < farm.size / 2 - 0.1) inside++; }
    });
    expect(working).toBeGreaterThan(5);
    expect(inside / working).toBeGreaterThan(0.6);
  });
  it('every place of work lies inside the field', () => {
    for (let id = 0; id < 9; id++) for (let carry = 0; carry < 6; carry++) {
      const s = fieldSpot({ id, x: 0, y: 0, carryAmt: carry, facing: 0 }, { x: 10, y: 10, size: 3 });
      expect(Math.abs(s.x - 10)).toBeLessThanOrEqual(3 * FIELD.spread + 1e-9);
      expect(Math.abs(s.y - 10)).toBeLessThan(1.5);
    }
  });
});
