// A soldier home inside one sitting, and back with the army (src/sim/furlough.ts on the field, src/sim/furloughmap.ts on the map).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { armyAt, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { menOf, musterOf } from '../src/sim/armytown';
import { goHome, homeNow, mayGoHome, mayRejoin, rejoin } from '../src/sim/furlough';
import { cleanHome, furloughOf, homeOnLeave } from '../src/sim/furloughmap';
import { folkOf } from '../src/sim/township';
import { awayMen } from '../src/sim/warhouse';
import { villagers } from './helpers';

/** The player's chief town with the army it began with standing in it: three companies of infantry, three men of the town on its roll. */
const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const a = armyAt(c, home.id)!;
  return { c, home, a };
};
const visit = (c: ReturnType<typeof world>['c'], tid: number) => {
  expect(beginVisit(c, tid)).toBe(true);
  const cfg = visitConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return { cfg, g };
};
const soldiers = (g: Game) => g.units.filter((u) => u.owner === 0 && !u.dead && u.type === 'clubman');

describe('on the map: who of the town is with the army in it', () => {
  it('the town\'s men on the army\'s roll are handed to the field by name and age, with how many soldiers make a company', () => {
    const { c, home, a } = world();
    const f = furloughOf(c, home.id)!;
    expect(f.men).toHaveLength(musterOf(c, a.id)!.men[home.id].length);
    expect(f.men.map((m) => m.name).sort()).toEqual(awayMen(c, home.id).map((m) => m.name).sort());
    expect(f.men.map((m) => m.seasons).sort()).toEqual([...musterOf(c, a.id)!.men[home.id]].sort());
    expect(f.per.clubman).toBe(2);
    // No army of its people there, or none of its men with it: nothing.
    const other = c.territories.find((t) => t.owner === 0 && t.id !== home.id) ?? c.territories.find((t) => t.owner !== 0)!;
    expect(furloughOf(c, other.id)).toBeUndefined();
  });
});

describe('on the field: he goes home, and back', () => {
  it('a soldier of the army is a man of the town again, by his own name, and his company leaves the field with him', () => {
    const { c, home } = world();
    const { g } = visit(c, home.id);
    const men = g.players[0].furlough!.men.length, first = { ...g.players[0].furlough!.men[0] };
    const before = soldiers(g).length, folk = villagers(g, 0).length;
    expect(before).toBe(6);
    const u = soldiers(g)[0];
    expect(mayGoHome(g, u)).toBe(true);
    expect(g.cmdGoHome(0, [u.id])).toBe(1);
    expect(soldiers(g).length).toBe(before - 2); // he and his following
    expect(villagers(g, 0).length).toBe(folk + 1);
    const him = villagers(g, 0).find((v) => v.onLeave)!;
    expect(him.name).toBe(first.name);
    expect(him.family).toBe(first.family ?? him.family);
    expect(him.gender).toBe('m');
    expect(him.onLeave).toEqual({ as: 'clubman', n: 2 });
    expect(g.players[0].furlough!.men.length).toBe(men - 1);
    expect(g.leftField).toHaveLength(2); // gone from the field, not fallen
    expect(homeNow(g, 0)).toMatchObject([{ name: first.name, as: 'clubman' }]);
    expect(Math.abs(homeNow(g, 0)[0].seasons - first.seasons)).toBeLessThanOrEqual(1);
    expect(mayGoHome(g, him)).toBe(false);
  }, 60_000);

  it('he takes up arms again: the villager is gone and his company stands as it did', () => {
    const { c, home } = world();
    const { g } = visit(c, home.id);
    const men = g.players[0].furlough!.men.length;
    g.cmdGoHome(0, [soldiers(g)[0].id]);
    const him = villagers(g, 0).find((v) => v.onLeave)!, name = him.name;
    expect(mayRejoin(g, him)).toBe(true);
    expect(g.cmdRejoin(0, [him.id])).toBe(1);
    expect(soldiers(g).length).toBe(6);
    expect(villagers(g, 0).some((v) => v.onLeave)).toBe(false);
    expect(g.players[0].furlough!.men.length).toBe(men);
    expect(g.players[0].furlough!.men.at(-1)!.name).toBe(name);
    expect(homeNow(g, 0)).toEqual([]);
  }, 60_000);

  it('no more go home than the town has men with the army, and the leader and the townsfolk cannot', () => {
    const { c, home } = world();
    const { g } = visit(c, home.id);
    const men = g.players[0].furlough!.men.length;
    expect(goHome(g, 0, soldiers(g).map((u) => u.id))).toBe(Math.min(men, 3));
    expect(g.players[0].furlough!.men.length).toBe(men - Math.min(men, 3));
    const leader = g.units.find((u) => u.owner === 0 && u.hero);
    if (leader) expect(mayGoHome(g, leader)).toBe(false);
    expect(mayGoHome(g, villagers(g, 0).find((v) => !v.onLeave)!)).toBe(false);
    expect(rejoin(g, 0, [villagers(g, 0).find((v) => !v.onLeave)!.id])).toBe(0);
  }, 60_000);
});

describe('back on the map', () => {
  it('a man home when the player leaves is off the roll and off his house\'s record of the away, and the army is a company the fewer', () => {
    const { c, home, a } = world();
    const { g } = visit(c, home.id);
    const who = { ...g.players[0].furlough!.men[0] };
    g.cmdGoHome(0, [soldiers(g)[0].id]);
    const men = folkOf(c, home.id).men;
    expect(finishVisit(c, { folk: g.census(0), leave: homeNow(g, 0), arms: { army: { infantry: soldiers(g).length }, trained: {} } })).toBe(true);
    expect(a.units).toEqual({ infantry: 2 });
    expect(musterOf(c, a.id)!.men[home.id]).toHaveLength(2);
    expect(musterOf(c, a.id)!.size).toBe(2);
    expect(menOf(c, a)).toEqual({ town: 2, none: 0 });
    expect(awayMen(c, home.id).map((m) => m.name)).not.toContain(who.name);
    expect(awayMen(c, home.id)).toHaveLength(2);
    expect(folkOf(c, home.id).men).toBe(men + 1); // counted in the town as the player left it
    expect(c.log.join('\n')).toContain(`${who.name}`);
    expect(c.log.join('\n')).toContain('left the army there and is home');
    expect(c.log.join('\n')).not.toContain('lost while you were there'); // his company is not taken for a loss
  }, 60_000);

  it('a man who went home and rejoined changes nothing', () => {
    const { c, home, a } = world();
    const { g } = visit(c, home.id);
    g.cmdGoHome(0, [soldiers(g)[0].id]);
    g.cmdRejoin(0, [villagers(g, 0).find((v) => v.onLeave)!.id]);
    const men = folkOf(c, home.id).men;
    finishVisit(c, { folk: g.census(0), leave: homeNow(g, 0), arms: { army: { infantry: soldiers(g).length }, trained: {} } });
    expect(a.units).toEqual({ infantry: 3 });
    expect(musterOf(c, a.id)!.men[home.id]).toHaveLength(3);
    expect(awayMen(c, home.id)).toHaveLength(3);
    expect(folkOf(c, home.id).men).toBe(men);
  }, 60_000);

  it('what comes back from the field is not believed blindly, and the leader keeps a company', () => {
    const { c, home, a } = world();
    expect(cleanHome(null)).toEqual([]);
    expect(cleanHome([{ as: 'dragon', name: 'X', seasons: 80 }, { as: 'clubman', name: '', seasons: 80 }, 4])).toEqual([]);
    // More claimed home than the roll has of this town: only those it has, and never the leader's last company.
    const claim = Array.from({ length: 9 }, (_, i) => ({ as: 'clubman', name: `N${i}`, seasons: 90 }));
    expect(a.hero).toBe(true);
    expect(homeOnLeave(c, home.id, claim)).toBe(2);
    expect(a.units).toEqual({ infantry: 1 });
    expect(c.armies.includes(a)).toBe(true);
    expect(homeOnLeave(c, 9999, claim)).toBe(0);
  });
});
