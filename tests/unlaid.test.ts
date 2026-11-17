// The buildings of a town that find no room on the field stay on its record (src/sim/unlaid.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { Game, Standing } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { FIRSTLAY, layKept } from '../src/sim/firstlay';
import { isUnlaid, keepUnlaid, unlaidOf, unlaidOn, unplaced } from '../src/sim/unlaid';

const REACH = [...FIRSTLAY.reach];
afterEach(() => { FIRSTLAY.reach = [...REACH]; });

/** The player's capital, grown, kept only coarsely (as a town nobody has been in is). */
function world(): { c: Campaign; tid: number; houses: number } {
  const c = newCampaign(6, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
  const f = folkOf(c, t.id); f.men = 48; f.women = 48; f.elders = 8; f.children = 90; delete f.ages;
  delete t.town; layTown(c, t.id);
  return { c, tid: t.id, houses: counted(c, t.id, 'house') };
}
const counted = (c: Campaign, tid: number, type: string): number => c.territories[tid].town!.b.filter((x) => x[0] === type).length;
const onField = (g: Game, type: string): number => g.buildings.filter((b) => b.owner === 0 && b.type === type).length;
/** Sit in the town and leave again at once, the field written back as its record. */
function sit(c: Campaign, tid: number): Game {
  c.turn++; // a town is sat in once a season
  beginVisit(c, tid);
  const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: 1, folk: g.census(0) });
  return g;
}

describe('a building with no room on the field', () => {
  it('a first visit to a town too big for the ground costs it no roofs', () => {
    const { c, tid, houses } = world();
    expect(houses).toBeGreaterThanOrEqual(40);
    FIRSTLAY.reach = [12]; // tight ground: room for a few roofs and no more
    const g = sit(c, tid);
    const stood = onField(g, 'house');
    expect(stood).toBeGreaterThan(0);
    expect(stood).toBeLessThan(houses);
    const town = c.territories[tid].town!;
    expect(town.coarse).toBeUndefined(); // its real record now
    expect(counted(c, tid, 'house')).toBe(houses); // every roof still counted
    expect(unlaidOn(town.b)).toBe(houses - stood);
    expect(town.b.filter(isUnlaid).every((x) => x[1] === -1 && x[2] === -1)).toBe(true);
  });

  it('is tried again at the next sitting, and stands when there is room', () => {
    const { c, tid, houses } = world();
    FIRSTLAY.reach = [12];
    sit(c, tid);
    expect(unlaidOn(c.territories[tid].town!.b)).toBeGreaterThan(0);
    FIRSTLAY.reach = [...REACH];
    const g = sit(c, tid);
    expect(onField(g, 'house')).toBe(houses);
    expect(unlaidOn(c.territories[tid].town!.b)).toBe(0);
    expect(counted(c, tid, 'house')).toBe(houses);
  });

  it('is kept again while there is still none, however often the town is sat in', () => {
    const { c, tid, houses } = world();
    FIRSTLAY.reach = [12];
    sit(c, tid);
    const kept = unlaidOn(c.territories[tid].town!.b);
    sit(c, tid); sit(c, tid);
    expect(counted(c, tid, 'house')).toBe(houses);
    expect(unlaidOn(c.territories[tid].town!.b)).toBe(kept);
  });

  it('a town with room for everything keeps nothing off the field', () => {
    const { c, tid, houses } = world();
    const g = sit(c, tid);
    expect(g.unlaid).toBeUndefined();
    expect(onField(g, 'house')).toBe(houses);
    expect(unlaidOn(c.territories[tid].town!.b)).toBe(0);
  });

  it('is kept as it was: as battered, and no further built', () => {
    expect(unplaced(['house', 20, 21])).toEqual(['house', -1, -1]);
    expect(unplaced(['mill', 20, 21, 0.4])).toEqual(['mill', -1, -1, 0.4]);
    expect(unplaced(['mill', 20, 21, 0.4, 0.5])).toEqual(['mill', -1, -1, 0.4, 0.5]);
    const { c, tid } = world();
    beginVisit(c, tid);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const st = { x: g.spec.starts[0].x, y: g.spec.starts[0].y };
    const mills = onField(g, 'mill');
    const town: Standing[] = [['mill', -1, -1, 0.4, 0.5], ['house', 30, 30]];
    expect(layKept(g, 0, st, 1, town)).toBe(1); // the one with no place, and not the one that has
    const mill = g.buildings.filter((b) => b.owner === 0 && b.type === 'mill')[mills];
    expect(mill.complete).toBe(false);
    expect(mill.progress).toBe(0.5);
    expect(mill.hp).toBe(Math.round(mill.maxHp * 0.4));
  });

  it('each side keeps its own, and what is handed back is a copy', () => {
    const { c, tid } = world();
    beginVisit(c, tid);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    keepUnlaid(g, 0, ['house', 12, 13]);
    expect(unlaidOf(g, 0)).toEqual([['house', -1, -1]]);
    expect(unlaidOf(g, 1)).toEqual([]);
    unlaidOf(g, 0)[0][0] = 'mill';
    expect(unlaidOf(g, 0)[0][0]).toBe('house');
    expect(g.standing(0).filter(isUnlaid)).toEqual([['house', -1, -1]]);
    expect(g.standing(1).filter(isUnlaid)).toEqual([]);
  });
});
