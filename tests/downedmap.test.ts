// The men the field saw fall are the map's dead, every one (src/sim/downedmap.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { downedOf, rollOf, survivorsOf } from '../src/sim/soldiernames';
import { folkOf } from '../src/sim/township';
import { takeDowned } from '../src/sim/downedmap';
import type { Campaign } from '../src/sim/campaign';

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

  // takeDowned on its own, on the map, with no battle fought: the first army of a new campaign is three companies of
  // the capital's men, one man a company, each on his house's away list and on the army's roll.
  const mapped = () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    const men = rollOf(c, army.id);
    return { c, home, army, men, size: () => Object.values(army.units).reduce((n, v) => n + v, 0) };
  };
  const down = (c: Campaign, men: ReturnType<typeof rollOf>, turn = c.turn) => { c.downed = { turn, men: men.map(({ army, town, name, family }) => ({ army, town, name, family })) }; };

  it('takeDowned: with nobody seen to fall, or a list from another season, nothing changes', () => {
    const { c, army, men, size } = mapped();
    const was = JSON.stringify({ m: c.musters, a: c.armies, log: c.log.length });
    expect(takeDowned(c)).toEqual([]);
    down(c, men, c.turn - 1);
    expect(takeDowned(c)).toEqual([]);
    expect(JSON.stringify({ m: c.musters, a: c.armies, log: c.log.length })).toBe(was);
    expect(rollOf(c, army.id)).toEqual(men);
    expect(size()).toBe(3);
  });

  it('takeDowned: one man seen to fall is off the roll and his house\'s away list, among its fallen, counted, told, and his company struck', () => {
    const { c, home, army, men, size } = mapped();
    expect(men.length).toBe(3);
    const man = men[0], ages = [...c.musters![army.id].men[home.id]];
    down(c, [man]);
    expect(takeDowned(c)).toEqual([`${man.name} ${man.family}`]);
    expect(rollOf(c, army.id).map((m) => m.name)).not.toContain(man.name);
    expect(c.musters![army.id].men[home.id].length).toBe(ages.length - 1);
    expect(c.musters![army.id].men[home.id]).not.toContain(Math.max(...ages)); // the eldest age is the one taken off
    expect(fate(c, home.id, man.name, man.family)).toBe('fell');
    expect(folkOf(c, home.id).houses!.find((h) => h.family === man.family)!.fallen!.at(-1)!.how).toBe('fell with the army');
    expect(size()).toBe(2);
    expect(c.musters![army.id].size).toBe(2);
    expect(c.ledger!.some((e) => e.kind === 'fell' && e.at === home.id && e.n === 1 && e.turn === c.turn)).toBe(true);
    expect(c.log.at(-1)).toBe(`1 more man of ${home.name} fell with the army, seen to fall on the field. He was ${man.name} ${man.family}.`);
  });

  it('takeDowned: every man of the army seen to fall leaves it its last company, and an empty roll', () => {
    const { c, home, army, men, size } = mapped();
    down(c, men);
    const out = takeDowned(c);
    expect(out.sort()).toEqual(men.map((m) => `${m.name} ${m.family}`).sort());
    expect(rollOf(c, army.id)).toEqual([]);
    expect(c.musters![army.id].men[home.id]).toBeUndefined();
    expect(size()).toBe(1);
    expect(c.log.at(-1)).toMatch(new RegExp(`^3 more men of ${home.name} fell with the army, seen to fall on the field\\. They were `));
  });

  it('takeDowned: a man the reckoning already took, or one of an army with no roll, is left as he is', () => {
    const { c, home, men, size } = mapped();
    const gone = men[0];
    const h = folkOf(c, home.id).houses!.find((x) => x.family === gone.family)!;
    h.away = h.away.filter((s) => s.name !== gone.name); // taken already, home hurt
    down(c, [gone]);
    expect(takeDowned(c)).toEqual([]);
    expect(size()).toBe(3);
    const other = mapped();
    delete other.c.musters![other.army.id];
    down(other.c, [other.men[0]]);
    expect(takeDowned(other.c)).toEqual([]);
    expect(fate(other.c, other.home.id, other.men[0].name, other.men[0].family)).toBe('away');
  });

  it('takeDowned: a rival\'s man is taken off as well, without a word in the player\'s log', () => {
    const { c } = mapped();
    const rival = c.armies.find((a) => a.owner === 1)!;
    const theirs = rollOf(c, rival.id);
    expect(theirs.length).toBeGreaterThan(0);
    const log = c.log.length;
    down(c, [theirs[0]]);
    expect(takeDowned(c)).toEqual([`${theirs[0].name} ${theirs[0].family}`]);
    expect(rollOf(c, rival.id).map((m) => m.name)).not.toContain(theirs[0].name);
    expect(c.log.length).toBe(log);
  });

  it('takeDowned: an army no longer on the map still has its roll put right', () => {
    const { c, home, army, men } = mapped();
    c.armies = c.armies.filter((a) => a.id !== army.id);
    down(c, [men[1]]);
    expect(takeDowned(c)).toEqual([`${men[1].name} ${men[1].family}`]);
    expect(c.musters![army.id].men[home.id].length).toBe(2);
  });
});
