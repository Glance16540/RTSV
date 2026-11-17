// The door a man came home to is written on the map (src/sim/furlough.ts doorNow, src/sim/furloughmap.ts, src/sim/warhouse.ts cameToDoor).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { armyAt, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { doorNow, homeNow } from '../src/sim/furlough';
import { cleanHome } from '../src/sim/furloughmap';
import { folkOf } from '../src/sim/township';
import { WARHOUSE, cameToDoor, housesOf, settleHouses } from '../src/sim/warhouse';
import { run, spot, villagers } from './helpers';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  expect(armyAt(c, home.id)).toBeTruthy();
  expect(beginVisit(c, home.id)).toBe(true);
  const cfg = visitConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  const at = spot(g, 'house', 0), house = g.spawnBuilding('house', 0, at.cx, at.cy, true);
  // Every other roof is full, so the only door free is the one the test means.
  for (const h of g.buildings.filter((b) => b.owner === 0 && b.type === 'house' && b !== house)) for (const s of ['m', 'f'] as const) if (!h.residents[s]) { const u = g.spawnUnit('villager', 0, h.x, h.y + 2, s); h.residents[s] = u.id; u.homeId = h.id; }
  return { c, home, g, house };
};
const soldier = (g: Game) => g.units.find((u) => u.owner === 0 && !u.dead && !!g.players[0].furlough!.per[u.type])!;
const leave = (g: Game) => finishArgs(g);
const finishArgs = (g: Game) => ({ folk: g.census(0), leave: homeNow(g, 0), arms: { army: { infantry: g.units.filter((u) => u.owner === 0 && !u.dead && u.type === 'clubman').length }, trained: {} } });

describe('the door he came home to, on the map', () => {
  it('under his own roof: his house\'s record says so, and the chronicle tells it', () => {
    const { c, home, g, house } = world();
    const first = g.players[0].furlough!.men[0];
    expect(first.family).toBeTruthy();
    house.family = first.family!; first.tie = 'husband'; // the man of his house
    g.cmdGoHome(0, [soldier(g).id]);
    const him = villagers(g, 0).find((v) => v.onLeave)!;
    expect(doorNow(g, him)).toBe('none'); // not there yet
    run(g, 60);
    expect(doorNow(g, him)).toBe('husband');
    expect(homeNow(g, 0)[0].door).toBe('husband');
    expect(finishVisit(c, leave(g))).toBe(true);
    const h = housesOf(folkOf(c, home.id)).find((x) => x.family === first.family)!;
    expect(h.home).toEqual([{ name: first.name, door: 'husband', turn: c.turn }]);
    expect(h.away.some((s) => s.name === first.name)).toBe(false);
    expect(c.log.join('\n')).toContain('is home, under his own roof again');
  }, 60_000);

  it('his house gone: a roof of his own, and written so', () => {
    const { c, home, g, house } = world();
    const first = { ...g.players[0].furlough!.men[0] };
    g.cmdGoHome(0, [soldier(g).id]);
    run(g, 60);
    const him = villagers(g, 0).find((v) => v.onLeave)!;
    expect(house.residents.m).toBe(him.id);
    expect(homeNow(g, 0)[0].door).toBe('own');
    finishVisit(c, leave(g));
    expect(housesOf(folkOf(c, home.id)).find((x) => x.family === first.family)!.home).toEqual([{ name: first.name, door: 'own', turn: c.turn }]);
    expect(c.log.join('\n')).toContain('under a roof of his own');
  }, 60_000);

  it('a son of his house, and a man with no roof', () => {
    const { g, house } = world();
    const first = g.players[0].furlough!.men[0];
    house.family = first.family!;
    const father = g.spawnUnit('villager', 0, house.x, house.y + 2, 'm'); house.residents.m = father.id; father.homeId = house.id;
    g.cmdGoHome(0, [soldier(g).id]);
    const son = villagers(g, 0).find((v) => v.onLeave)!;
    expect(doorNow(g, son)).toBe('son');
    house.family = 'Another';
    expect(doorNow(g, son)).toBe('none');
  });

  it('what the field reports is made safe, and an old report with no door still brings him home', () => {
    expect(cleanHome([{ as: 'clubman', name: 'Edric', family: 'Barrow', seasons: 100, door: 'palace' }])[0].door).toBeUndefined();
    expect(cleanHome([{ as: 'clubman', name: 'Edric', family: 'Barrow', seasons: 100, door: 'son' }])[0].door).toBe('son');
    const { c, home, g } = world();
    const first = { ...g.players[0].furlough!.men[0] };
    g.cmdGoHome(0, [soldier(g).id]);
    const args = leave(g);
    for (const m of args.leave) delete m.door;
    finishVisit(c, args);
    expect(housesOf(folkOf(c, home.id)).find((x) => x.family === first.family)?.home).toBeUndefined();
    expect(c.log.join('\n')).toContain('left the army there and is home:');
  }, 60_000);

  it('the house is kept on the record for his sake a while, and then forgotten', () => {
    const { c, home } = world();
    const f = folkOf(c, home.id);
    const h = cameToDoor(c, home.id, 'Edric', 'Longhome', 'husband')!;
    expect(h.home).toHaveLength(1);
    cameToDoor(c, home.id, 'Edric', 'Longhome', 'own'); // the same man again: the later word stands
    expect(h.home).toEqual([{ name: 'Edric', door: 'own', turn: c.turn }]);
    settleHouses(c); // the record is tidied
    expect(housesOf(f).some((x) => x.family === 'Longhome')).toBe(true);
    c.turn += WARHOUSE.remembered + 1;
    settleHouses(c);
    expect(housesOf(f).some((x) => x.family === 'Longhome')).toBe(false);
    expect(cameToDoor(c, home.id, '', 'Longhome', 'own')).toBeUndefined();
  });
});
