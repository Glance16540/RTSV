// The Monastery or Convent (src/sim/monastery.ts): the Virtuous town's great house.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MONASTERY, monasteryAt } from '../src/sim/monastery';
import { monasterySeason } from '../src/sim/rule';
import { raiseBar, raiseWork } from '../src/sim/townworks';
import { layTown } from '../src/sim/rivalrule';
import { folkOf } from '../src/sim/township';
import { driftTown } from '../src/sim/drift';
import { TEND_EASE } from '../src/sim/decrees';
import { faithAt, swayTown } from '../src/sim/townfaith';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

const world = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  for (const x of c.factions) x.age = 1;
  const f = folkOf(c, tid);
  f.men = 6; f.women = 6; f.elders = 0; delete f.ages; delete f.hungry;
  f.stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
  layTown(c, tid);
  return { c, tid };
};
const holy = (c: Campaign, tid: number): void => { swayTown(c, tid, 60 - faithAt(c, tid)); };

describe('the Monastery or Convent', () => {
  it('only a town that keeps the faith raises one', () => {
    const { c, tid } = world();
    swayTown(c, tid, -faithAt(c, tid));
    expect(raiseBar(c, 0, tid, 'monastery')).toMatch(/keeps the faith/);
    holy(c, tid);
    expect(raiseWork(c, 0, tid, 'monastery')).toBe('');
    expect(monasteryAt(c, tid)).toBe(false); // begun
  });

  it('draws the town toward the holy way, cares for it, and tends its sick and bereaved', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    f.grief = 3;
    driftTown(c, tid);
    const grieving = f.drift!.strain, moved = f.drift!.moved;
    c.territories[tid].town!.b.push(['monastery', 4, 4]);
    driftTown(c, tid);
    expect(f.drift!.strain).toBeCloseTo(grieving * (1 - TEND_EASE * MONASTERY.tend), 5);
    expect(f.drift!.moved).toBeGreaterThan(moved);
    delete f.grief; f.notables = [];
    driftTown(c, tid);
    expect(f.drift!.care).toBeGreaterThan(0);
  });

  it('a rival raises one in its most faithful town that keeps the faith, when it can spare the stores', () => {
    const { c } = world();
    const r = c.territories.find((t) => t.capital === 1)!;
    layTown(c, r.id);
    folkOf(c, r.id).stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
    swayTown(c, r.id, -faithAt(c, r.id));
    expect(monasterySeason(c, 1)).toBe(false); // it does not keep the faith
    holy(c, r.id);
    expect(monasterySeason(c, 1)).toBe(false); // holy, but nobody there sick or grieving
    folkOf(c, r.id).drift = { strain: 0.2, care: 0, moved: 0, hungry: false, raided: false, sick: true };
    expect(monasterySeason(c, 1)).toBe(true);
    expect(monasterySeason(c, 1)).toBe(false);
  });

  it('in a town, only where it keeps the faith', () => {
    const g = new Game(3, setups);
    g.players[0].age = 1; g.players[0].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    const at = spot(g, 'monastery', 0);
    g.players[0].virtue = 0;
    expect(g.cmdPlace(0, 'monastery', at.cx, at.cy, [])).toBeNull();
    g.players[0].virtue = 60;
    expect(g.cmdPlace(0, 'monastery', at.cx, at.cy, [])).not.toBeNull();
  });
});
