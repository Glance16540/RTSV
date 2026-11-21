// Everyone grown is somebody: a town's record keeps its grown by name, and a battle's dead are named (src/sim/folkroll.ts).
import { describe, expect, it } from 'vitest';
import { answerDemand, battleConfig, continueAI, endTurn, moveArmy, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { folkOf, settleFolk, tollFolk } from '../src/sim/township';
import { bySex, cleanGrown, keyOf, levelRoll, rollSeason } from '../src/sim/folkroll';

const counts = (roll: { g: string }[] = []) => ({ m: roll.filter((p) => p.g === 'm').length, f: roll.filter((p) => p.g === 'f').length });

/** A rival's army marches on the player's capital: the town's people take the field. */
function siege() {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories[home.adj[0]];
  next.owner = 1;
  c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  c.pending!.mode = 'siege';
  const cfg = battleConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return { c, home, g };
}

describe('folkroll', () => {
  it('names every grown person of a town, of its houses, one name to each sex in the town while there are names', () => {
    const c = newCampaign(7, 2, 1, 'hearth');
    rollSeason(c);
    for (const t of c.territories) {
      if (!t.folk) continue;
      const f = folkOf(c, t.id), roll = f.roll ?? [];
      expect(counts(roll)).toEqual(bySex(f));
      expect(new Set(roll.map(keyOf)).size).toBe(roll.length);
      for (const p of roll) expect(p.h).not.toBe('');
    }
    const f = folkOf(c, c.territories.find((t) => t.capital === 0)!.id);
    const men = (f.roll ?? []).filter((p) => p.g === 'm');
    expect(new Set(men.map((p) => p.n)).size).toBeGreaterThan(men.length * 0.6);
  });

  it('follows the counts: those who die between battles go from the front of the roll, never a known woman', () => {
    const c = newCampaign(7, 2, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 0)!.id, f = folkOf(c, tid);
    levelRoll(c, tid);
    f.notables.push({ name: 'Aelfrun', family: 'Noyon', gender: 'f', kind: 'mother', kids: 4, deed: 'raised four', turn: 0 } as never);
    levelRoll(c, tid);
    expect(f.roll!.some((p) => p.n === 'Aelfrun' && p.h === 'Noyon')).toBe(true);
    const was = f.roll!.slice();
    delete f.ages; f.women = 1; f.elders = 0; f.men = 3;
    levelRoll(c, tid);
    expect(counts(f.roll)).toEqual({ m: 3, f: 1 });
    expect(f.roll!.find((p) => p.g === 'f')!.n).toBe('Aelfrun');
    const lastMen = was.filter((p) => p.g === 'm').slice(-3).map(keyOf);
    expect(f.roll!.filter((p) => p.g === 'm').map(keyOf)).toEqual(lastMen);
    f.men = 5;
    levelRoll(c, tid);
    expect(counts(f.roll)).toEqual({ m: 5, f: 1 });
  });

  it('a saved game from before has no roll: it is given one the first season, and the roll comes through a save whole', () => {
    const c = newCampaign(9, 2, 1, 'steppe');
    for (const t of c.territories) if (t.folk) { delete t.folk.roll; delete t.folk.rollSent; }
    const back = JSON.parse(JSON.stringify(c));
    rollSeason(back);
    const t = back.territories.find((x: { folk?: unknown }) => x.folk);
    expect(counts(t.folk.roll)).toEqual(bySex(t.folk));
    const again = JSON.parse(JSON.stringify(back));
    expect(again.territories[t.id].folk.roll).toEqual(t.folk.roll);
    expect(cleanGrown([{ n: '<b>Odo</b>', h: 3, g: 'x' }, null, 'Odo'])).toEqual([{ n: 'bOdo/b', h: '', g: 'm' }]);
  });

  it('a battle fought in person: the town\'s villagers bear the roll\'s names, and the report names those who died', () => {
    const { c, home, g } = siege();
    const f = folkOf(c, home.id), sent = f.rollSent ?? [];
    expect(sent.length).toBeGreaterThan(10);
    const mine = g.units.filter((u) => u.owner === 0 && !u.dead && u.lifespan > 0 && !u.hero); // villagers, and those of them in arms
    const onField = new Set(mine.map((u) => `${u.name} ${u.family}`));
    for (const p of sent) expect(onField.has(keyOf(p))).toBe(true);
    // Three of them fall.
    const fallen = mine.filter((u) => u.type === 'villager').slice(0, 3);
    for (const u of fallen) (g as unknown as { kill(e: unknown): void }).kill(u);
    const census = g.census(0);
    c.log.length = 0;
    const r = settleFolk(c, home.id, census);
    const names = fallen.map((u) => `${u.name} ${u.family}`);
    expect(r.dead!.map(keyOf).sort()).toEqual(names.sort());
    const line = c.log.find((l) => l.startsWith(`The dead of ${home.name}:`));
    expect(line).toBeDefined();
    for (const n of names) expect(line).toContain(n);
    for (const n of names) expect(f.roll!.some((p) => keyOf(p) === n)).toBe(false);
    expect(counts(f.roll)).toEqual(bySex(f));
    expect(f.rollSent).toBeUndefined();
  });

  it('men who fall where nobody watched are struck off the roll by name, and the player is told who', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!, f = folkOf(c, home.id);
    levelRoll(c, home.id);
    const before = f.roll!.length;
    c.log.length = 0;
    const dead = tollFolk(c, home.id, false, { men: 4 });
    expect(dead).toBe(4);
    expect(f.roll!.length).toBe(before - 4);
    expect(c.log.some((l) => l.startsWith(`The men of ${home.name} who fell:`))).toBe(true);
    levelRoll(c, home.id);
    expect(counts(f.roll)).toEqual(bySex(f));
  });

  it('what it costs a saved game, over twenty years of a campaign the computer plays', () => {
    const c = newCampaign(11, 3, 1, 'hearth');
    for (let s = 0; s < 80 && c.phase !== 'over'; s++) {
      for (let i = 0; i < 40 && c.phase === 'player'; i++) { playForPlayer(c); if (c.pending) resolvePending(c, 'auto'); else break; }
      endTurn(c);
      for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
      if (c.pending) resolvePending(c, 'auto');
    }
    rollSeason(c); // the last season's ending is counted after the roll was set
    const whole = JSON.stringify(c).length;
    const rolls = c.territories.reduce((n, t) => n + (t.folk?.roll ? JSON.stringify(t.folk.roll).length + 8 : 0), 0);
    const people = c.territories.reduce((n, t) => n + (t.folk?.roll?.length ?? 0), 0);
    console.log(`folkroll: ${people} named in ${c.territories.filter((t) => t.folk?.roll).length} towns at turn ${c.turn}: ${rolls} bytes of a ${whole}-byte save (${(100 * rolls / whole).toFixed(1)}%)`);
    for (const t of c.territories) if (t.folk) expect(counts(t.folk.roll)).toEqual(bySex(t.folk));
    expect(rolls).toBeLessThan(whole);
  }, 300000);
});
