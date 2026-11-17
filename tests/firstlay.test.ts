// A town met in person for the first time is laid as big as its record (src/sim/firstlay.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { layCoarse } from '../src/sim/firstlay';

/** The player's capital, grown to 30 grown and 20 children, kept only coarsely (as a town nobody has been in is). */
function world(): { c: Campaign; tid: number } {
  const c = newCampaign(6, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
  const f = folkOf(c, t.id); f.men = 14; f.women = 14; f.elders = 2; f.children = 20; delete f.ages;
  delete t.town; layTown(c, t.id);
  return { c, tid: t.id };
}
const counted = (c: Campaign, tid: number, type: string): number => c.territories[tid].town!.b.filter((x) => x[0] === type).length;
const onField = (g: Game, type: string): number => g.buildings.filter((b) => b.owner === 0 && b.type === type).length;
const gameOf = (cfg: NonNullable<ReturnType<typeof visitConfig>>): Game => new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');

describe('a town met in person for the first time', () => {
  it('is visited as big as its record: its houses stand around the hall', () => {
    const { c, tid } = world();
    expect(c.territories[tid].town!.coarse).toBe(true);
    const houses = counted(c, tid, 'house');
    expect(houses).toBeGreaterThan(10);
    beginVisit(c, tid);
    const g = gameOf(visitConfig(c)!);
    expect(onField(g, 'towncenter')).toBe(1);
    expect(onField(g, 'house')).toBe(houses);
    expect(onField(g, 'barracks')).toBe(1); // the land's work, once, not twice
  });

  it('is besieged as big as its record', () => {
    const { c, tid } = world();
    const houses = counted(c, tid, 'house'), home = c.territories[tid];
    const at = home.adj.find((n) => c.territories[n].owner !== 0)!;
    c.territories[at].owner = 1;
    c.armies.push({ id: 99, owner: 1, at, units: { infantry: 4 }, hero: false, vet: 0, moved: false } as never);
    expect(moveArmy(c, 99, tid)).toBe('battle');
    c.pending!.mode = 'siege';
    const g = gameOf(battleConfig(c)!);
    expect(onField(g, 'house')).toBe(houses);
    expect(onField(g, 'towncenter')).toBe(1);
  });

  it('lays nothing twice, and nothing where there is no room', () => {
    const { c, tid } = world();
    beginVisit(c, tid);
    const cfg = visitConfig(c)!, g = gameOf({ ...cfg, setups: cfg.setups.map((s) => ({ ...s, bonus: { ...s.bonus, coarse: undefined } })) });
    const before = g.buildings.length, st = { x: g.spec.starts[0].x, y: g.spec.starts[0].y };
    const laid = layCoarse(g, 0, st, 1, [['towncenter', 30, 30], ['house', 0, 0], ['house', 0, 0]]);
    expect(laid).toBe(2); // the hall stands already
    expect(g.buildings.length).toBe(before + 2);
    expect(layCoarse(g, 0, st, 1, [['nothing-such', 0, 0]])).toBe(0);
  });

  it('a town with a real record is laid from it as before', () => {
    const { c, tid } = world();
    c.territories[tid].town = { at: 2, b: [['towncenter', 30, 30]] };
    beginVisit(c, tid);
    const s = visitConfig(c)!.setups[0];
    expect(s.bonus?.coarse).toBeUndefined();
  });
});

describe('a grown town at four times the size', () => {
  /** A capital of about a hundred and ninety, with 48 roofs on its coarse record. */
  const big = (): { c: Campaign; tid: number; houses: number } => {
    const c = newCampaign(6, 1, 1, 'hearth');
    const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
    const f = folkOf(c, t.id); f.men = 48; f.women = 48; f.elders = 8; f.children = 90; delete f.ages;
    delete t.town; layTown(c, t.id);
    return { c, tid: t.id, houses: counted(c, t.id, 'house') };
  };

  it('stands whole on a visit: every roof on its record', () => {
    const { c, tid, houses } = big();
    expect(houses).toBeGreaterThanOrEqual(40);
    beginVisit(c, tid);
    const g = gameOf(visitConfig(c)!);
    expect(onField(g, 'house')).toBe(houses);
  });

  it('stands whole when besieged, and none of it in the besieger\'s camp', () => {
    const { c, tid, houses } = big();
    const at = c.territories[tid].adj.find((n) => c.territories[n].owner !== 0)!;
    c.territories[at].owner = 1;
    c.armies.push({ id: 99, owner: 1, at, units: { infantry: 4 }, hero: false, vet: 0, moved: false } as never);
    expect(moveArmy(c, 99, tid)).toBe('battle');
    c.pending!.mode = 'siege';
    const g = gameOf(battleConfig(c)!);
    expect(onField(g, 'house')).toBe(houses);
    const them = g.spec.starts.filter((_, k) => k !== 0);
    for (const b of g.buildings.filter((x) => x.owner === 0)) for (const o of them) expect(Math.hypot(o.x - b.cx - b.def.size / 2, o.y - b.cy - b.def.size / 2)).toBeGreaterThanOrEqual(14);
  });
});
