// A group set in a line, a column or a loose order keeps it on the march (src/sim/formations.ts).
import { describe, expect, it } from 'vitest';
import { FORM, formOf, formationPlan, slots } from '../src/sim/formations';
import { Game } from '../src/sim/game';
import { AIController } from '../src/sim/ai';
import { run, setups } from './helpers';

const spread = (pts: [number, number][], ax: number, ay: number): number => { const v = pts.map(([x, y]) => x * ax + y * ay); return Math.max(...v) - Math.min(...v); };

describe('the shape of an order', () => {
  it('lays a line wide and shallow across the way it faces, a column narrow and deep along it', () => {
    // Facing +y (0): across is x, along is y.
    const line = slots(10, 'line', 0), column = slots(10, 'column', 0);
    expect(spread(line, 1, 0)).toBeCloseTo(4 * FORM.gap);
    expect(spread(line, 0, 1)).toBeCloseTo(FORM.rank);
    expect(spread(column, 1, 0)).toBeCloseTo(FORM.gap);
    expect(spread(column, 0, 1)).toBeCloseTo(4 * FORM.rank);
    // Turned to face +x, the line runs along y.
    expect(spread(slots(10, 'line', Math.PI / 2), 0, 1)).toBeCloseTo(4 * FORM.gap);
    // A loose order has room between every man.
    const loose = slots(9, 'loose', 0);
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(Math.hypot(loose[i][0] - loose[j][0], loose[i][1] - loose[j][1])).toBeGreaterThan(FORM.gap * 1.3);
  });

  it('is kept by the group when most of it is set so, and sends them at the slowest one\'s pace, facing the way they go', () => {
    expect(formOf([{ form: 'line' }, { form: 'line' }, {}])).toBe('line');
    expect(formOf([{ form: 'line' }, {}, {}])).toBe(null);
    const men = [0, 1, 2, 3].map((i) => ({ x: 10 + i * 0.5, y: 10, form: 'line' as const, def: { speed: i === 2 ? 1.2 : 2 } }));
    const plan = formationPlan(men, 10.75, 30)!;
    expect(plan.pace).toBe(1.2);
    expect(plan.face).toBeCloseTo(0, 1); // going up +y
    expect(new Set(plan.places.map((p) => p.join())).size).toBe(4);
    expect(formationPlan(men.map((m) => ({ ...m, form: undefined })), 10, 30)).toBe(null);
  });
});

describe('an order in a battle', () => {
  it('a line sent across the field arrives as a line, facing the way it was sent', () => {
    const g = new Game(5, setups, 72);
    run(g, 1);
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    const ids = [0, 1, 2, 3, 4].map((i) => g.spawnUnit('spearman', 0, tc.x + 4 + (i % 3), tc.y + 4 + Math.floor(i / 3), 'm').id);
    g.cmdFormation(0, ids, 'line');
    run(g, 6);
    const us = ids.map((id) => g.entities.get(id)!) as { x: number; y: number; facing: number; form?: string }[];
    expect(us.every((u) => u.form === 'line')).toBe(true);
    // An open stretch of ground ahead of them, nothing standing within three tiles.
    const clear = (x: number, y: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (g.landPf.isBlocked(Math.floor(x) + dx, Math.floor(y) + dy)) return false; return true; };
    let to = { x: tc.x + 4, y: tc.y + 14 };
    let best = Infinity;
    for (let y = tc.y + 10; y < 66; y++) for (let x = 6; x < 66; x++) { const d = Math.hypot(x - tc.x - 4, y - tc.y - 14); if (d < best && clear(x + 0.5, y + 0.5)) { best = d; to = { x: x + 0.5, y: y + 0.5 }; } }
    expect(best).toBeLessThan(40);
    const plan0 = formationPlan(us as never, to.x, to.y)!; // the way they will face, as the order is given
    g.cmdMove(0, ids, to.x, to.y);
    run(g, 20);
    // Five men, one rank: spread across the way they were sent, and hardly at all along it.
    const there = plan0.face, pts = us.map((u) => [u.x, u.y] as [number, number]);
    expect(spread(pts, Math.cos(there), -Math.sin(there))).toBeGreaterThan(3);
    expect(spread(pts, Math.sin(there), Math.cos(there))).toBeLessThan(1.6);
    for (const u of us) expect(Math.cos(u.facing - there)).toBeGreaterThan(0.8);
  }, 30_000);

  it('the computer goes out to attack in a line', () => {
    const g = new Game(5, setups, 72);
    const ai = new AIController(g, 1);
    ai.setLevel(2);
    // Its men are set in a line as it launches an attack: seen once it has an army out.
    let lined = false;
    for (let sec = 0; sec < 60 * 16 && !lined; sec++) { run(g, 1); ai.update(); lined = g.units.some((u) => u.owner === 1 && u.form === 'line'); }
    expect(lined).toBe(true);
  }, 120_000);
});
