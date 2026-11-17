// A raiding people at home begins as a town, not as a war band (src/sim/raidertown.ts; docs/PLAYTEST.md 4.1).
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { styleOf } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { atHome, warBand } from '../src/sim/raidertown';
import { folkOf } from '../src/sim/township';
import { homeCounts } from '../src/sim/fieldcap';

/** A campaign with the player's army about to storm a tribe's town whose people live by raiding. */
function storm() {
  for (let seed = 1; seed < 400; seed++) {
    const c = newCampaign(seed, 2);
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    for (const n of home.adj) {
      const t = c.territories[n];
      if (t.owner >= 0 || t.horde || t.wild) continue;
      folkOf(c, t.id);
      const d = structuredClone(c);
      d.armies = d.armies.filter((a) => a.owner !== 0);
      d.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 12 }, hero: false, vet: 0, moved: false });
      if (moveArmy(d, 801, t.id) !== 'battle') continue;
      d.pending!.mode = 'siege';
      const cfg = battleConfig(d)!;
      if (!cfg.field && styleOf(cfg.setups[1].civ ?? '').raid) return { c: d, cfg, tid: t.id };
    }
  }
  throw new Error('no raiding tribe beside a capital in 400 worlds');
}
const people = (f: { men: number; women: number; elders: number; children: number }) => f.men + f.women + f.elders + f.children;

describe('a raiding people defending its own town', () => {
  it('the rule: a side handed a town of the map is at home, in a town and not in the open; a war band is a raider who is not', () => {
    expect(atHome(undefined, false)).toBe(false);
    expect(atHome({}, false)).toBe(false);
    expect(atHome({ people: { men: 3 } }, false)).toBe(true);
    expect(atHome({ town: [{}] }, false)).toBe(true);
    expect(atHome({ people: { men: 3 } }, true)).toBe(false);
    expect(warBand(true, {})).toBe(true);
    expect(warBand(true, { atHome: true })).toBe(false);
    expect(warBand(false, {})).toBe(false);
  });

  it('begins with its hall and its people on the field, as any town does', () => {
    const { c, cfg, tid } = storm();
    const f = folkOf(c, tid), all = people(f);
    expect(all).toBeGreaterThan(9);
    expect(cfg.setups[1].bonus!.people).toBeTruthy();
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.raider(1)).toBe(true); // a raiding people still
    expect(g.warband(1)).toBe(false);
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'towncenter' && !b.dead)).toBe(true);
    // Everyone on the record is on the field or held back at home (fieldcap.ts): nobody is missing.
    const back = f.fieldHome ? homeCounts(f.fieldHome) : { men: 0, women: 0, elders: 0 };
    expect(people(g.census(1)) + back.men + back.women + back.elders).toBe(all);
    expect(people(g.census(1))).toBeGreaterThan(9); // not a man, a woman and seven fighters
  });

  it('taken with a few of its fighters felled, the town keeps the people who lived', () => {
    const { c, cfg, tid } = storm();
    const f = folkOf(c, tid), before = people(f);
    const back = f.fieldHome ? homeCounts(f.fieldHome) : { men: 0, women: 0, elders: 0 }, home = back.men + back.women + back.elders;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const fighters = g.units.filter((u) => u.owner === 1 && !u.dead && g.isMilitary(u)).slice(0, 3);
    for (const u of fighters) g.perish(u);
    const folk = g.census(1);
    expect(people(folk) + home).toBe(before - fighters.length);
    finishBattle(c, true, { clubman: 12 }, { folk });
    expect(c.territories[tid].owner).toBe(0);
    expect(people(folkOf(c, tid))).toBeGreaterThanOrEqual(before - fighters.length);
  });

  it('is beaten when its hall is brought down, not only when its last person falls', () => {
    const { cfg } = storm();
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    for (const b of g.buildings.filter((b) => b.owner === 1 && !b.dead)) (g as unknown as { kill(x: unknown): void }).kill(b);
    for (let i = 0; i < 20 * 400 && !g.players[1].defeated; i++) g.step();
    expect(g.players[1].defeated).toBe(true);
  });

  it('in a skirmish the same people are a war band still: no hall, a man, a woman and their fighters', () => {
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'steppe' }]);
    expect(g.warband(1)).toBe(true);
    expect(g.buildings.some((b) => b.owner === 1)).toBe(false);
    expect(g.units.filter((u) => u.owner === 1 && !u.dead).length).toBeGreaterThan(2);
  });
});
