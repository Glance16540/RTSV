// Which soldier is which man (src/sim/soldiernames.ts; docs/PLAYTEST.md 4.9): the field's soldiers bear the names of the
// army's roll, and the men whose soldiers went down are the ones the map counts lost.
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { reckonArmies } from '../src/sim/armytown';
import { champion } from '../src/sim/battleleader';
import { Game } from '../src/sim/game';
import { veteranHome } from '../src/sim/veteranhome';
import { fell } from '../src/sim/warhouse';
import { downedOf, noteDowned, rollOf, survivorsOf } from '../src/sim/soldiernames';

/** The player's army at the capital marches on a tribe's town next door: a battle in person. */
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
  return { c, army, home, cfg, g };
}
const soldiers = (g: Game, owner: number) => g.units.filter((u) => u.owner === owner && !u.dead && g.isMilitary(u) && !u.hero);

describe('soldiernames', () => {
  it('each company on the field is led by a man of the army\'s roll, by his name and house; the rest are his following', () => {
    const { c, army, cfg, g } = battle();
    const roll = rollOf(c, army.id);
    expect(roll.length).toBeGreaterThan(0);
    expect(cfg.setups[0].bonus?.roll?.men).toEqual(roll);
    const named = soldiers(g, 0).filter((u) => u.roll);
    expect(named.map((u) => `${u.name} ${u.family}`).sort()).toEqual(roll.map((m) => `${m.name} ${m.family}`).sort());
    const followers = soldiers(g, 0).filter((u) => u.follows);
    expect(followers.length).toBeGreaterThan(0);
    for (const f of followers) expect(named.some((u) => `${u.name}|${u.family}` === f.follows)).toBe(true);
  });

  it('the man whose soldier went down is handed to the map, and his broken company is not counted with what stands', () => {
    const { g } = battle();
    const man = soldiers(g, 0).find((u) => u.roll)!, follower = soldiers(g, 0).find((u) => u.follows === `${man.name}|${man.family}`)!;
    const before = survivorsOf(g, 0)[man.type];
    g.perish(man);
    expect(downedOf(g).map((m) => m.name)).toEqual([man.name]);
    expect(follower.dead).toBe(false);
    expect(survivorsOf(g, 0)[man.type]).toBe(before - 2); // he and his following
  });

  it('the map takes the men who went down first: the end card and the map name the same men', () => {
    const { c, army, home, g } = battle();
    const down = soldiers(g, 0).filter((u) => u.roll).slice(-2);
    for (const u of down) g.perish(u);
    noteDowned(c, downedOf(g));
    const lost = fell(c, home.id, 2, 'fell with the army', army.id).map((x) => `${x.name} ${x.family}`).sort();
    expect(lost).toEqual(down.map((u) => `${u.name} ${u.family}`).sort());
  });

  it('when an army is reckoned, its losses come from the towns and men who went down', () => {
    const { c, army, g } = battle();
    const down = soldiers(g, 0).find((u) => u.roll)!;
    g.perish(down);
    noteDowned(c, downedOf(g));
    const a = c.armies.find((x) => x.id === army.id)!;
    const type = Object.keys(a.units)[0];
    a.units[type]--; // a company lost
    const out = reckonArmies(c);
    const all = out.flatMap((x) => x.names ?? []);
    const homeHurt = out.reduce((n, x) => n + (x.home ?? 0), 0);
    // He is the one lost: dead and named, or home hurt and no longer with the army.
    if (all.length) expect(all).toContain(`${down.name} ${down.family}`);
    else expect(homeHurt).toBe(1);
    expect(rollOf(c, army.id).some((m) => m.name === down.name && m.family === down.family)).toBe(false);
  });

  it('nothing is carried over to another season', () => {
    const { c, g } = battle();
    g.perish(soldiers(g, 0).find((u) => u.roll)!);
    noteDowned(c, downedOf(g));
    expect(c.downed?.men.length).toBe(1);
    c.turn++;
    const { home, army } = { home: c.territories.find((t) => t.capital === 0)!, army: c.armies[0] };
    expect(fell(c, home.id, 1, 'fell', army.id).length).toBe(1); // drawn by lot again, without error
  });

  it('a soldier who makes a name does so under his own, and the man of the house keeps his', () => {
    const { c, army, g } = battle();
    const man = soldiers(g, 0).find((u) => u.roll)!;
    man.kills = 9;
    const ch = champion(g, 0)!;
    expect(ch.name).toBe(man.name);
    expect(ch.female).toBe(false);
    const roll = rollOf(c, army.id);
    expect(veteranHome(c, 0, army.id, ch.name)?.family).toBe(man.family);
    // A name the roll does not have is of a house by lot, and renames nobody.
    expect(veteranHome(c, 0, army.id, 'Edwy Nobody')).toBeDefined();
    expect(rollOf(c, army.id)).toEqual(roll);
  });

  it('a skirmish, and a side with no roll, are untouched', () => {
    const g = new Game(1, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
    expect(g.units.some((u) => u.roll || u.follows)).toBe(false);
    expect(downedOf(g)).toEqual([]);
  });
});
