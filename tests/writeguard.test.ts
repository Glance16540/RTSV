// A town is not written off by a field it was never on (src/sim/writeguard.ts).
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { Census, cleanCensus, folkOf, headcount, settleFolk } from '../src/sim/township';

/** A rival's army marches on the player's capital: the town's people take the field; the camp has none of a town's. */
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
const nobody = (): Census => ({ men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, taken: 0, named: [] });

describe('writeguard', () => {
  it('a side whose people were never set on the field hands back a count marked so; a town on the field does not', () => {
    const { g } = siege();
    expect(g.census(0).unfielded).toBeUndefined();
    expect(g.census(1).unfielded).toBe(true);
  });

  it('the mark comes through the map\'s check, and only as true', () => {
    expect(cleanCensus({ ...nobody(), unfielded: true })?.unfielded).toBe(true);
    expect(cleanCensus({ ...nobody(), unfielded: 'yes' } as never)?.unfielded).toBeUndefined();
    expect(cleanCensus(nobody())?.unfielded).toBeUndefined();
  });

  it('such a count leaves the whole record exactly as it was (ages, the named, the widowed, orphans, couples, the drifted), and the log says so', () => {
    const { c, home } = siege();
    const f = folkOf(c, home.id);
    f.notables.push({ name: 'Aelfrun', gender: 'f', kind: 'mother', kids: 4, deed: 'raised four', turn: 0 } as never);
    const snap = JSON.stringify({ ...f, fieldHome: undefined });
    settleFolk(c, home.id, { ...nobody(), unfielded: true });
    expect(JSON.stringify({ ...f, fieldHome: undefined })).toBe(snap);
    expect(f.notables.find((n) => n.name === 'Aelfrun')?.lost).toBeUndefined();
  });

  it('read back through the end of a battle, nothing after the write-back takes the empty count for the town', () => {
    const { c, home } = siege();
    const people = headcount(folkOf(c, home.id));
    finishBattle(c, true, {}, { folk: { ...nobody(), unfielded: true }, drifted: { tavern: 0, mines: 0 } });
    expect(headcount(folkOf(c, home.id))).toBeGreaterThanOrEqual(people); // kept, and any man of the army home hurt joins it (armytown.ts)
    expect(c.log.some((l) => l.includes('were not on the field: their record is kept as it was'))).toBe(true);
  });

  it('such a count leaves the town\'s record as it was, and the log says so', () => {
    const { c, home } = siege();
    const f = folkOf(c, home.id), was = { men: f.men, women: f.women, elders: f.elders, children: f.children, stores: { ...f.stores } };
    expect(headcount(f)).toBeGreaterThan(0);
    f.fieldHome = { m: [100], f: [] } as never;
    const r = settleFolk(c, home.id, { ...nobody(), unfielded: true });
    expect({ men: f.men, women: f.women, elders: f.elders, children: f.children, stores: f.stores }).toEqual(was);
    expect(f.fieldHome).toBeUndefined();
    expect(r.after).toBe(r.before);
    expect(c.log.at(-1)).toBe(`The people of ${home.name} were not on the field: their record is kept as it was.`);
  });

  it('a count of nobody from a town that was on the field is written back as before: the guard never hides a real sack', () => {
    const { c, home } = siege();
    const f = folkOf(c, home.id);
    delete f.fieldHome; // nobody held back from the field (fieldcap.ts would join them back)
    f.notables.push({ name: 'Aelfrun', gender: 'f', kind: 'mother', kids: 4, deed: 'raised four', turn: 0 } as never);
    settleFolk(c, home.id, nobody());
    expect(headcount(f)).toBe(0);
    expect(f.notables.find((n) => n.name === 'Aelfrun')?.lost).toBeDefined();
  });
});
