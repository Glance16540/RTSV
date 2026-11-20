// A town is not written off by a field it was never on (src/sim/writeguard.ts).
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { Census, cleanCensus, folkOf, headcount, settleFolk } from '../src/sim/township';
import { keptAsWas, unfieldedOf, unfieldedSide } from '../src/sim/writeguard';
import { setups } from './helpers';

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

  // The three functions on their own.
  it('unfieldedSide: true for a side with no town\'s people in its setup, or no setup at all; false for one with them', () => {
    const plain = new Game(7, setups);
    expect(unfieldedSide(plain, 0)).toBe(true);
    expect(unfieldedSide(plain, 1)).toBe(true);
    expect(unfieldedSide(plain, 5)).toBe(true);
    const g = new Game(7, [{ ...setups[0], bonus: { people: { men: 2, women: 2, elders: 0, children: 0 } } }, setups[1]]);
    expect(unfieldedSide(g, 0)).toBe(false);
    expect(unfieldedSide(g, 1)).toBe(true);
  });

  it('unfieldedOf: keeps the mark only when it is exactly true', () => {
    expect(unfieldedOf({ unfielded: true })).toEqual({ unfielded: true });
    for (const x of [{ unfielded: 'true' }, { unfielded: 1 }, { unfielded: false }, {}, null, undefined]) expect(unfieldedOf(x as never)).toEqual({});
  });

  it('keptAsWas: a marked count over a record with anyone in it keeps the record, drops the note of those held back, and logs it', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const f = folkOf(c, home.id);
    f.fieldHome = { m: [100], f: [] } as never;
    const log = c.log.length;
    expect(keptAsWas(c, home.id, f, { ...nobody(), unfielded: true }, 5)).toBe(true);
    expect(f.fieldHome).toBeUndefined();
    expect(c.log.length).toBe(log + 1);
    expect(c.log.at(-1)).toBe(`The people of ${home.name} were not on the field: their record is kept as it was.`);
  });

  it('keptAsWas: an unmarked count, or a record with nobody in it, is written as it stands and nothing is touched', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const f = folkOf(c, home.id);
    f.fieldHome = { m: [100], f: [] } as never;
    const log = c.log.length;
    expect(keptAsWas(c, home.id, f, nobody(), 5)).toBe(false);
    expect(keptAsWas(c, home.id, f, { ...nobody(), unfielded: true }, 0)).toBe(false);
    expect(f.fieldHome).toBeDefined();
    expect(c.log.length).toBe(log);
  });

  it('keptAsWas: a land with no name on the map is spoken of as the town', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const f = folkOf(c, c.territories.find((t) => t.capital === 0)!.id);
    expect(keptAsWas(c, 9999, f, { ...nobody(), unfielded: true }, 3)).toBe(true);
    expect(c.log.at(-1)).toBe('The people of the town were not on the field: their record is kept as it was.');
  });
});
