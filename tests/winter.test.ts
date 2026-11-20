// Winter felt on the map (src/sim/winter.ts): armies slowed, fields yielding less, rivers frozen hard enough to cross,
// and none of it in the desert.
import { describe, expect, it } from 'vitest';
import { armyAt, moveArmy, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { biomeOf, reach } from '../src/sim/campaignbase';
import { harvest } from '../src/sim/harvest';
import { seasonOfTurn } from '../src/sim/seasonsky';
import { folkOf } from '../src/sim/township';
import { WINTER, iceBridges, isWinter, snowbound, winterYield } from '../src/sim/winter';

const winterTurn = (from: number): number => { let t = from; while (seasonOfTurn(t) !== 'winter') t++; return t; };
const base = JSON.stringify(newCampaign(5, 2));
/** Two lands of the player's a river parts, with no bridge: the river laid between them by hand. */
function riverParted() {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = [];
  const a = c.territories.find((t) => t.capital === 0)!;
  const b = c.territories.find((t) => a.adj.includes(t.id) && t.capital < 0)!;
  b.owner = 0;
  a.adj = a.adj.filter((x) => x !== b.id); b.adj = b.adj.filter((x) => x !== a.id);
  c.barriers = [{ a: a.id, b: b.id, kind: 'river' }];
  return { c, a, b };
}
const notDesert = (c: Campaign, ...ids: number[]) => ids.every((id) => biomeOf(c, id) !== 'desert');

describe('winter on the map', () => {
  it('comes once a year, with the turn', () => {
    const c: Campaign = JSON.parse(base);
    c.turn = winterTurn(1);
    expect(isWinter(c)).toBe(true);
    c.turn++;
    expect(isWinter(c)).toBe(false);
    expect(winterYield(c, 'grass')).toBe(1);
    c.turn = winterTurn(1);
    expect(winterYield(c, 'grass')).toBe(WINTER.yield);
    expect(winterYield(c, 'desert')).toBe(1); // the desert has no winter
  });

  it('a river frozen in winter joins the lands it parts, and they part again in spring', () => {
    const { c, a, b } = riverParted();
    if (!notDesert(c, a.id, b.id)) return;
    c.turn = winterTurn(2) - 1;
    expect(reach(c, a.id)).not.toContain(b.id);
    c.turn++;
    expect(reach(c, a.id)).toContain(b.id);
    expect(reach(c, b.id)).toContain(a.id);
    expect(iceBridges(c, a.id, () => 'desert')).toEqual([]); // no ice in the desert
    c.turn++;
    expect(reach(c, a.id)).not.toContain(b.id);
  });

  it('an army can cross the ice, and marching in winter it is snowbound the season after', () => {
    const { c, a, b } = riverParted();
    if (!notDesert(c, a.id, b.id)) return;
    c.turn = winterTurn(2);
    c.armies.push({ id: 50, owner: 0, at: a.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 50, b.id)).toBe('moved');
    const army = armyAt(c, b.id)!;
    expect(army.moved).toBe(true);
    c.turn++; army.moved = false; // spring: the ice is gone, and the army is snowbound
    expect(snowbound(c, army)).toBe(true);
    const back = c.territories.find((t) => b.adj.includes(t.id) && t.owner === 0);
    if (back) expect(moveArmy(c, 50, back.id)).toBe('invalid');
    c.turn++; army.moved = false;
    expect(snowbound(c, army)).toBe(false);
  });

  it('no second march through friendly land in winter, even for the Mongols', () => {
    const c: Campaign = JSON.parse(base);
    c.armies = [];
    const a = c.territories.find((t) => t.capital === 0)!;
    const b = c.territories.find((t) => a.adj.includes(t.id) && t.capital < 0)!;
    b.owner = 0;
    c.factions[0].civ = 'steppe';
    if (!notDesert(c, a.id)) return;
    c.turn = winterTurn(2);
    c.armies.push({ id: 51, owner: 0, at: a.id, units: { cavalry: 2 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 51, b.id)).toBe('moved');
    expect(armyAt(c, b.id)!.moved).toBe(true);
  });

  it('the fields yield less in winter', () => {
    const got = (winter: boolean) => {
      const c: Campaign = JSON.parse(base);
      const t = c.territories.find((x) => x.capital === 0)!;
      c.turn = winterTurn(2) + (winter ? 0 : 1);
      folkOf(c, t.id).stores = { food: 0, wood: 0, gold: 0, stone: 0 };
      harvest(c, () => 10, () => 0);
      const s = folkOf(c, t.id).stores;
      return { n: s.food + s.wood + s.gold + s.stone, desert: biomeOf(c, t.id) === 'desert' };
    };
    const w = got(true), s = got(false);
    if (w.desert) { expect(w.n).toBe(s.n); return; }
    expect(w.n / s.n).toBeCloseTo(WINTER.yield, 1);
  });
});
