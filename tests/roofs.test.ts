// Every household under its roof, at a battle or a visit and between them (src/sim/roofs.ts, src/sim/roofsmap.ts; docs/PLAYTEST.md 4.3).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, newCampaign } from '../src/sim/campaign';
import { Building, Game, Unit } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';
import { wedOf } from '../src/sim/marriage';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { roofsOf, seatRoofs } from '../src/sim/roofs';
import { cleanRoofs, keepRoofs, roofsFor } from '../src/sim/roofsmap';
import { awayMen } from '../src/sim/warhouse';
import { goHome } from '../src/sim/furlough';
import { run } from './helpers';

/** The player's capital with twelve men and twelve women, its roofs on a coarse record, never entered. */
function world(): { c: Campaign; tid: number } {
  const c = newCampaign(7, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
  const f = folkOf(c, t.id); f.men = 12; f.women = 12; f.elders = 0; f.children = 10; delete f.ages; delete f.wed;
  delete t.town; layTown(c, t.id);
  return { c, tid: t.id };
}
const enter = (c: Campaign, tid: number): Game => {
  c.turn++;
  expect(beginVisit(c, tid)).toBe(true);
  const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
};
const leave = (c: Campaign, g: Game): void => { finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: 1, folk: g.census(0) }); };
const houses = (g: Game): Building[] => g.buildings.filter((b) => b.owner === 0 && b.type === 'house' && !b.dead);
const who = (g: Game, id: number): Unit => g.entities.get(id) as Unit;
const folk = (g: Game): Unit[] => g.units.filter((u) => u.owner === 0 && u.type === 'villager' && !u.dead);

describe('a town comes to the field with its households under their roofs', () => {
  it('its married couples are housed, a man and a woman to a house, and nobody twice', () => {
    const { c, tid } = world();
    const wed = wedOf(folkOf(c, tid));
    expect(wed).toBeGreaterThan(5);
    const g = enter(c, tid);
    const full = houses(g).filter((h) => h.residents.m && h.residents.f);
    expect(full.length).toBe(Math.min(wed, houses(g).length));
    const ids = full.flatMap((h) => [h.residents.m, h.residents.f]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of full) { expect(who(g, h.residents.m).gender).toBe('m'); expect(who(g, h.residents.f).gender).toBe('f'); expect(who(g, h.residents.m).homeId).toBe(h.id); }
    expect(folk(g).filter((u) => !u.homeId).length).toBe(folk(g).length - ids.length);
  });

  it('the wife of a man away with the army is alone under his family\'s roof, and he comes home to it', () => {
    const { c, tid } = world();
    const away = awayMen(c, tid);
    expect(away.length).toBeGreaterThan(0);
    const husband = away.find((m) => m.as === 'husband'), son = away.find((m) => m.as === 'son');
    const g = enter(c, tid);
    if (husband) {
      const h = houses(g).find((x) => x.family === husband.family && !x.residents.m)!;
      expect(h).toBeTruthy();
      expect(h.residents.f).toBeGreaterThan(0);
    }
    if (son) expect(houses(g).some((x) => x.family === son.family)).toBe(true);
    // Whoever is first on the army's list goes home: to a house of his own family's name.
    const first = { ...g.players[0].furlough!.men[0] };
    const soldier = g.units.find((u) => u.owner === 0 && !u.dead && !!g.players[0].furlough!.per[u.type])!;
    expect(goHome(g, 0, [soldier.id])).toBe(1);
    const him = folk(g).find((u) => u.onLeave)!;
    const own = houses(g).filter((x) => x.family === first.family);
    expect(own.length).toBeGreaterThan(0);
    run(g, 60);
    expect(own.some((x) => x.residents.m === him.id) || own.some((x) => x.id === him.bornAt)).toBe(true);
  }, 60_000);

  it('who lived where is kept: the same names under the same roofs at the next sitting', () => {
    const { c, tid } = world();
    const g = enter(c, tid);
    const before = roofsOf(g, 0);
    expect(before.length).toBeGreaterThan(5);
    leave(c, g);
    expect(folkOf(c, tid).households!.list).toHaveLength(before.length);
    const g2 = enter(c, tid);
    const after = roofsOf(g2, 0);
    const name = (r: (typeof after)[number]) => `${r.at[0]},${r.at[1]}:${r.m?.name ?? ''}+${r.f?.name ?? ''}:${r.family ?? ''}`;
    for (const r of before) expect(after.map(name)).toContain(name(r));
    // And a season older for the season between.
    const one = before.find((r) => r.m)!, same = after.find((r) => r.at[0] === one.at[0] && r.at[1] === one.at[1])!;
    expect(Math.abs(same.m!.seasons - one.m!.seasons - 1)).toBeLessThanOrEqual(1);
  });

  it('a household moved by the player stays where it was put', () => {
    const { c, tid } = world();
    const g = enter(c, tid);
    const full = houses(g).filter((h) => h.residents.m && h.residents.f), free = houses(g).find((h) => !h.residents.m && !h.residents.f);
    if (!free) return; // every roof taken: nothing to move to
    const from = full[0], man = who(g, from.residents.m), wife = who(g, from.residents.f);
    for (const u of [man, wife]) { from.residents[u.gender as 'm' | 'f'] = 0; free.residents[u.gender as 'm' | 'f'] = u.id; u.homeId = free.id; }
    leave(c, g);
    const g2 = enter(c, tid);
    const there = houses(g2).find((h) => h.cx === free.cx && h.cy === free.cy)!;
    expect(who(g2, there.residents.m).name).toBe(man.name);
    expect(who(g2, there.residents.f).name).toBe(wife.name);
  });
});

describe('the record of households', () => {
  it('is made safe, and a house that no longer stands has no household', () => {
    expect(cleanRoofs([{ at: [3, 4], m: { name: 'Edric', seasons: 120 } }, { at: [-1, -1], m: { name: 'X', seasons: 1 } }, { at: [5, 6] }, 'nonsense', { at: [7, 8], family: '<b>Oakes', f: { name: 'Wyn', seasons: 9999 } }]))
      .toEqual([{ at: [3, 4], m: { name: 'Edric', seasons: 120 } }, { at: [7, 8], family: 'bOakes', f: { name: 'Wyn', seasons: 400 } }]);
    const { c, tid } = world();
    const t = c.territories[tid];
    t.town = { at: 2, b: [['towncenter', 30, 30], ['house', 20, 20]] };
    expect(keepRoofs(c, tid, [{ at: [20, 20], m: { name: 'Edric', seasons: 120 } }, { at: [40, 40], m: { name: 'Holt', seasons: 100 } }])).toBe(2);
    c.turn += 3;
    const r = roofsFor(c, tid)!;
    expect(r.kept).toEqual([{ at: [20, 20], m: { name: 'Edric', seasons: 123 } }]);
    expect(r.wed).toBe(wedOf(folkOf(c, tid)));
    expect(keepRoofs(c, tid, undefined)).toBe(0); // an old report: the record stands
    expect(folkOf(c, tid).households).toBeTruthy();
    keepRoofs(c, tid, []);
    expect(folkOf(c, tid).households).toBeUndefined();
  });

  it('a field with no word of households is left as it was, and no house is taken twice', () => {
    const { c, tid } = world();
    const g = enter(c, tid);
    expect(seatRoofs(g, 0, undefined)).toEqual({ kept: 0, wives: 0, couples: 0 });
    const full = houses(g).filter((h) => h.residents.m && h.residents.f).length;
    seatRoofs(g, 0, { wed: 99, kept: roofsOf(g, 0) }); // asked again: only those still without a roof are seated
    const ids = houses(g).flatMap((h) => [h.residents.m, h.residents.f]).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(houses(g).filter((h) => h.residents.m && h.residents.f).length).toBeGreaterThanOrEqual(full);
    expect(armyAt(c, tid)).toBeTruthy();
  });
});
