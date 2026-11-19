// The Sea of Grass: a Mongol war band in the open steppe, with the war band's guide for its orders (src/sim/scenario.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { missionById, runMission } from '../src/sim/scenario';
import { onTheMove, raiderSteps } from '../src/sim/raiderguide';
import { run } from './helpers';

const kill = (g: Game, e: unknown) => (g as unknown as { kill(e: unknown): void }).kill(e);
const start = () => { const m = missionById('grass')!; const g = new Game(m.seed, m.setups, m.size, false, !!m.sea, false, m.climate ?? ''); m.init(g); return { m, g }; };

describe('The Sea of Grass', () => {
  it('begins as a war band in the steppe, riders with it, and no hall', () => {
    const { g } = start();
    expect(g.climate).toBe('steppe');
    expect(onTheMove(g, 0)).toBe(true);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'horsearcher').length).toBe(3);
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'towncenter')).toBe(true);
  });

  it('gives the war band\'s guide as its orders, one by one, and is won when the Persian hall falls', () => {
    const { m, g } = start();
    run(g, 1);
    let st = runMission(g, m);
    const titles = raiderSteps(g, 0).map((s) => s.title);
    expect(st.objectives.slice(0, 3).map((o) => o.text.split(':')[0])).toEqual(titles);
    expect(st.objectives.every((o) => !o.done)).toBe(true);
    // Three taken into the band, and set to gathering.
    const at = g.units.find((u) => u.owner === 0)!;
    const berries = g.resources.filter((r) => r.type === 'berries' || r.type === 'tree').sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
    for (let i = 0; i < 3; i++) { const v = g.spawnUnit('villager', 0, at.x + i, at.y + 1, 'm'); v.story = [{ t: g.time, s: 'Taken into the band' }]; g.cmdTarget(0, [v.id], berries.id); }
    run(g, 1);
    st = runMission(g, m);
    expect(st.objectives[0].done).toBe(true);
    expect(st.objectives[1].done).toBe(true);
    // A hall raised.
    g.spawnBuilding('towncenter', 0, Math.floor(at.x) - 1, Math.floor(at.y) - 6, true);
    st = runMission(g, m);
    expect(st.objectives[2].done).toBe(true);
    expect(st.result).toBe(null);
    // Theirs brought down.
    for (const b of g.buildings.filter((x) => x.owner === 1 && x.type === 'towncenter')) kill(g, b);
    st = runMission(g, m);
    expect(st.result).toBe('win');
  }, 60_000);

  it('is lost when the last of the band falls', () => {
    const { m, g } = start();
    for (const u of g.units.filter((x) => x.owner === 0)) kill(g, u);
    expect(runMission(g, m).result).toBe('lose');
  });
});
