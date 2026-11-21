// What a man wins at war counts to his house's output (src/sim/warspoils.ts).
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { armyAt, raise } from '../src/sim/campaign';
import type { Pending } from '../src/sim/campaign';
import { agesOf } from '../src/sim/ageing';
import { Notable, folkOf } from '../src/sim/township';
import { housesOf } from '../src/sim/warhouse';
import { WAR_SPOILS, creditSpoils, spoilsBefore, spoilsHeld, spoilsTaken } from '../src/sim/warspoils';

const two = () => {
  const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const near = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
  near.owner = 0;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  for (const t of [home, near]) {
    t.buildings = ['barracks'];
    const f = folkOf(c, t.id);
    Object.assign(f, { men: 40, women: 16, elders: 0, children: 0 }); f.notables = []; delete f.ages; delete f.houses;
    agesOf(c, t.id, f);
  }
  return { c, home, near };
};
const made = (c: ReturnType<typeof bareCampaign>, tid: number) => housesOf(folkOf(c, tid)).reduce((n, h) => n + (h.made ?? 0), 0);
const menOf = (c: ReturnType<typeof bareCampaign>, id: number) => Object.values(c.musters?.[id]?.men ?? {}).reduce((n, l) => n + l.length, 0);

describe('spoils and deeds of war', () => {
  it('are counted to the houses of the army\'s men, in their share, and to no other army\'s', () => {
    const { c, home, near } = two();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, near.id, 'infantry');
    const a = armyAt(c, home.id)!;
    const given = creditSpoils(c, a.id, 120);
    expect(given).toBeGreaterThan(100);
    expect(given).toBeLessThanOrEqual(125);
    expect(made(c, home.id)).toBe(given);
    expect(made(c, near.id)).toBe(0);
  });

  it('a house the nation knows has it on her record too, raising her house\'s standing', () => {
    const { c, home } = two();
    const f = folkOf(c, home.id);
    f.notables.push({ name: 'Ada', family: 'Harrow', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 0, kids: 3 } as Notable);
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    for (const h of housesOf(f)) h.family = 'Harrow'; // every man of the army is of her house
    creditSpoils(c, a.id, 200);
    expect(f.notables[0].made).toBeGreaterThan(150);
  });

  it('a town taken: what was looted from it, and each man\'s deed; an attack thrown back: each man\'s deed', () => {
    const { c, home, near } = two();
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    const s = folkOf(c, near.id).stores;
    Object.assign(s, { food: 300, wood: 100, gold: 0, stone: 0 });
    const p = { to: near.id, armyId: a.id } as Pending;
    spoilsBefore(c, p);
    s.food = 150; s.wood = 50; // looted of half
    const men = menOf(c, a.id);
    const got = spoilsTaken(c, p, a.id);
    expect(Math.abs(got - (200 + WAR_SPOILS.deed * men))).toBeLessThanOrEqual(men);
    const before = made(c, home.id);
    expect(spoilsHeld(c, p, a.id)).toBeGreaterThan(0);
    expect(made(c, home.id) - before).toBeCloseTo(WAR_SPOILS.deed * men, -1);
    expect(spoilsHeld(c, p, undefined)).toBe(0);
    expect(spoilsTaken(c, p, undefined)).toBe(0);
  });

  it('nothing for an army with nobody on its roll, or no goods', () => {
    const { c, home } = two();
    c.armies.push({ id: 88, owner: 0, at: home.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(creditSpoils(c, 88, 100)).toBe(0);
    raise(c, 0, home.id, 'infantry');
    expect(creditSpoils(c, armyAt(c, home.id)!.id, 0)).toBe(0);
  });
});
