// A man's record at war goes with him from battle to battle (src/sim/warrecord.ts): kept on his house's record while he
// serves, handed to his soldier as a battle is laid out, shown on his panel, and added to as each battle ends.
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { housesOf, type WarHouse } from '../src/sim/warhouse';
import { folkOf } from '../src/sim/township';
import { RECORD, cleanRecord, foughtOnMap, recordLines, recordsBack, recordsOut } from '../src/sim/warrecord';
import { survivorsOf } from '../src/sim/soldiernames';

/** The player's first army marched on a tribe's town next door: a battle fought in person, with the army's roll. */
function assault() {
  for (let seed = 1; seed < 40; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
    if (to === undefined || moveArmy(c, army.id, to) !== 'battle') continue;
    c.pending!.mode = 'siege';
    const men = c.territories.flatMap((t) => ((t.folk as { houses?: WarHouse[] } | undefined)?.houses ?? []).flatMap((h) => h.away.filter((s) => s.army === army.id).map((s) => ({ s, family: h.family }))));
    if (men.length) return { c, home, army, to, men };
  }
  throw new Error('no assault');
}

describe('warrecord', () => {
  it('a record is made safe and kept small, whatever is handed in', () => {
    expect(cleanRecord(undefined)).toBeUndefined();
    expect(cleanRecord({ battles: 0, kills: 0, wounds: 0 })).toBeUndefined();
    const r = cleanRecord({ battles: -3, kills: 1e9, wounds: '2', last: [...Array.from({ length: 9 }, (_, i) => [i, 3, 1, 1, 0]), 'x', [1, 2]] })!;
    expect(r).toMatchObject({ battles: 0, kills: 99999, wounds: 2 });
    expect(r.last).toHaveLength(RECORD.last);
    expect(r.last!.at(-1)).toEqual([8, 3, 1, 1, 0]);
  });

  it('a battle fought in person: his soldier comes with his record, shows it, and adds what he did', () => {
    const { c, army, to, men } = assault();
    const first = men[0];
    first.s.record = { battles: 2, kills: 5, wounds: 1, last: [[3, to, 4, 1, 0], [6, to, 0, 0, 1]] };
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const u = g.units.find((x) => x.roll && x.roll.name === first.s.name && x.roll.family === first.family)!;
    expect(u.record).toMatchObject({ battles: 2, kills: 5, wounds: 1 });
    const lines = recordLines(u);
    expect(lines[0]).toBe('Came through 2 battles before this one: 5 felled, wounded once.');
    expect(lines[1]).toContain(c.territories[to].name);
    expect(lines[1]).toContain('fought out on the map');
    expect(lines[2]).toContain('felled 4, wounded');
    u.kills = 3; u.hp = Math.max(1, u.maxHp - 5);
    const records = recordsOut(g);
    expect(records.length).toBeGreaterThan(0);
    finishBattle(c, true, survivorsOf(g, 0), { records });
    const s = first.s.record!;
    expect(s).toMatchObject({ battles: 3, kills: 8, wounds: 2 });
    expect(s.last!.at(-1)).toEqual([c.turn, to, 3, 1, 0]);
    expect(s.at).toBeUndefined(); // land names go only to a battle
    // Every other man who stood has his first battle on record.
    for (const m of men.slice(1)) if (m.s.army === army.id && m.s.record) expect(m.s.record.battles).toBe(1);
  });

  it('a soldier with no record shows nothing, and the field hands back only named soldiers who stood', () => {
    const { c } = assault();
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const named = g.units.filter((u) => u.roll && !u.dead);
    expect(named.length).toBeGreaterThan(0);
    expect(recordLines(named[0])).toEqual([]);
    g.perish(named[0]);
    expect(recordsOut(g).some((d) => d.name === named[0].roll!.name && d.family === named[0].roll!.family)).toBe(false);
  });

  it('a battle fought out on the map adds a battle, and no kills, to every man still on the rolls', () => {
    const { c, army, to, men } = assault();
    const p = c.pending!;
    expect(foughtOnMap(c, p, [army.id, undefined, army.id])).toBe(men.length); // each army once
    for (const m of men) expect(m.s.record).toMatchObject({ battles: 1, kills: 0, wounds: 0, last: [[c.turn, to, 0, 0, 1]] });
    for (let i = 0; i < RECORD.last + 3; i++) foughtOnMap(c, p, [army.id]);
    expect(men[0].s.record!.battles).toBe(RECORD.last + 4);
    expect(men[0].s.record!.last).toHaveLength(RECORD.last);
  });

  it('the record is kept whenever the houses\' record is made safe again', () => {
    const { c, men } = assault();
    men[0].s.record = { battles: 1, kills: 2, wounds: 0, last: [[1, 2, 2, 0, 0]] };
    const town = c.territories.find((t) => ((t.folk as { houses?: WarHouse[] } | undefined)?.houses ?? []).some((h) => h.away.includes(men[0].s)))!;
    const again = housesOf(folkOf(c, town.id)).flatMap((h) => h.away).find((s) => s.name === men[0].s.name)!;
    expect(again.record).toEqual({ battles: 1, kills: 2, wounds: 0, last: [[1, 2, 2, 0, 0]] });
  });

  it('what the field hands back is checked: a man not on the roll, or junk, changes nothing', () => {
    const { c, men } = assault();
    expect(recordsBack(c, c.pending!, [{ army: 999, town: 0, name: men[0].s.name, family: men[0].family, kills: 4 }, null, 'x', { army: 1 }])).toBe(0);
    expect(recordsBack(c, c.pending!, 'nope')).toBe(0);
    expect(men[0].s.record).toBeUndefined();
  });
});
