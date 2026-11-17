// The men the field saw fall are the map's dead, every one (src/sim/downedmap.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { downedOf, rollOf, survivorsOf } from '../src/sim/soldiernames';
import { folkOf } from '../src/sim/township';

/** The player's army marches on a tribe's town next door, as a battle fought in person. */
function battle() {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const army = armyAt(c, home.id)!;
  const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde)!;
  expect(moveArmy(c, army.id, to)).toBe('battle');
  c.pending!.mode = 'siege';
  const cfg = battleConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return { c, army, home, g };
}
const named = (g: Game) => g.units.filter((u) => u.owner === 0 && !u.dead && u.roll);
/** Is this man nowhere on his house's away list any more? And did he fall, or come home? */
function fate(c: ReturnType<typeof newCampaign>, town: number, name: string, family: string): 'away' | 'fell' | 'home' {
  const h = folkOf(c, town).houses?.find((x) => x.family === family);
  if (h?.away.some((s) => s.name === name)) return 'away';
  return h?.fallen?.some((x) => x.name === name && x.turn === c.turn) ? 'fell' : 'home';
}

describe('downedmap', () => {
  it('a battle won: every man the field saw fall is off the roll, dead or home hurt, and those who stood are still away', () => {
    const { c, army, g } = battle();
    const all = named(g);
    expect(all.length).toBeGreaterThanOrEqual(3);
    const down = all.slice(0, all.length - 1), stood = all[all.length - 1];
    for (const u of down) g.perish(u);
    finishBattle(c, true, survivorsOf(g, 0), { downed: downedOf(g) });
    for (const u of down) expect(fate(c, u.roll!.town, u.name, u.family)).not.toBe('away');
    expect(down.filter((u) => fate(c, u.roll!.town, u.name, u.family) === 'fell').length).toBeGreaterThan(0);
    expect(fate(c, stood.roll!.town, stood.name, stood.family)).toBe('away');
    const left = rollOf(c, army.id).map((m) => `${m.name} ${m.family}`);
    for (const u of down) expect(left).not.toContain(`${u.name} ${u.family}`);
    expect(left).toContain(`${stood.name} ${stood.family}`);
  });

  it('even when the army that won keeps its last company: its man, seen to fall, is dead and not still in it', () => {
    const { c, army, g } = battle();
    const all = named(g);
    for (const u of all) g.perish(u);
    finishBattle(c, true, survivorsOf(g, 0), { downed: downedOf(g) });
    const a = c.armies.find((x) => x.id === army.id);
    expect(a && Object.values(a.units).reduce((n, v) => n + v, 0)).toBe(1); // it limps home
    expect(rollOf(c, army.id)).toEqual([]);
    for (const u of all) expect(fate(c, u.roll!.town, u.name, u.family)).not.toBe('away');
  });

  it('a battle with nobody of the roll down leaves the roll as it was', () => {
    const { c, army, g } = battle();
    const before = rollOf(c, army.id);
    finishBattle(c, true, survivorsOf(g, 0), { downed: downedOf(g) });
    expect(rollOf(c, army.id)).toEqual(before);
  });
});
