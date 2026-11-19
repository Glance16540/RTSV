// A Church near a Tavern tempers it (src/sim/churchtavern.ts).
import { describe, expect, it } from 'vitest';
import { TEMPER, churchNear, churchTempers, keptFromTavern, maidPull, tavernPull, tavernShare } from '../src/sim/churchtavern';
import { TAVERN_VIRTUE } from '../src/sim/campaignbase';
import { newCampaign } from '../src/sim/campaign';
import { driftTown } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

describe('a Church beside a Tavern, on the map', () => {
  it('draws the town down a step less a season, and lets fewer of its women drift there', () => {
    const c = newCampaign(5, 2, 1, 'hearth'), t = c.territories.find((x) => x.owner === 0)!;
    t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern');
    expect(tavernPull(c, t.id)).toBe(0);
    t.buildings.push('tavern');
    expect(churchTempers(c, t.id)).toBe(false);
    expect(tavernPull(c, t.id)).toBe(TAVERN_VIRTUE);
    expect(tavernShare(c, t.id)).toBe(1);
    t.buildings.push('church');
    expect(churchTempers(c, t.id)).toBe(true);
    expect(tavernPull(c, t.id)).toBe(TAVERN_VIRTUE - TEMPER.pull);
    expect(tavernShare(c, t.id)).toBe(1 - TEMPER.drift);
  });

  it('keeps more of a hungry town\'s women from the Tavern', () => {
    const most = (church: boolean): number => {
      const c = newCampaign(5, 2, 1, 'hearth'), t = c.territories.find((x) => x.owner === 0)!;
      t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern').concat(church ? ['tavern', 'church'] : ['tavern']);
      const f = folkOf(c, t.id);
      f.women = 12;
      let top = 0;
      for (let s = 0; s < 12; s++) {
        c.turn++;
        (c.events ??= []).push({ kind: 'famine', at: t.id, until: c.turn + 1 } as never);
        driftTown(c, t.id);
        top = Math.max(top, f.drifted?.tavern ?? 0);
      }
      return top;
    };
    expect(most(false)).toBe(6);
    expect(most(true)).toBe(Math.floor(12 * 0.5 * (1 - TEMPER.drift)));
  });
});

describe('a Church near a Tavern, in a town', () => {
  const town = (gap: number): Game => {
    const g = new Game(4, setups, 72);
    const at = spot(g, 'tavern', 0);
    g.spawnBuilding('tavern', 0, at.cx, at.cy, true);
    const far = { cx: Math.min(g.size - 6, Math.max(2, at.cx + gap)), cy: at.cy };
    let s = far;
    for (let k = 0; k < 40 && !g.canPlace('temple', s.cx, s.cy); k++) s = { cx: far.cx + (k % 5) - 2, cy: far.cy + Math.floor(k / 5) - 4 };
    g.spawnBuilding('temple', 0, s.cx, s.cy, true);
    return g;
  };

  it('tempers the maids\' pull and keeps some women from drifting there, only within reach, and without the battle\'s dice', () => {
    const near = town(5);
    expect(churchNear(near, 0)).toBe(true);
    expect(churchNear(near, 1)).toBe(false);
    expect(maidPull(near, 0)).toBe(1 - TEMPER.maids);
    expect(maidPull(near, 1)).toBe(1);
    const rng = near.rngState;
    let kept = 0;
    for (let i = 0; i < 2000; i++) { near.tick = i; if (keptFromTavern(near, 0)) kept++; }
    expect(kept / 2000).toBeGreaterThan(TEMPER.drift * 0.8);
    expect(kept / 2000).toBeLessThan(TEMPER.drift * 1.2);
    expect(near.rngState).toBe(rng);
    const far = town(TEMPER.reach + 12);
    expect(churchNear(far, 0)).toBe(false);
    expect(keptFromTavern(far, 0)).toBe(false);
  });
});
