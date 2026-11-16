// Unrest is a town's own matter (src/sim/unrest.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { NOBLES, noblesAt } from '../src/sim/nobles';
import { folkOf } from '../src/sim/township';
import { UNREST, heldFor, mayStir, noteHolders, unrestChance, unrestSeason, unrestText, unrestWeights } from '../src/sim/unrest';

/** A plain town of the player's, long held: no army in it, nothing built, fed, with people in it. */
const town = (seed = 7) => {
  const c = newCampaign(seed, 2, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && x.capital < 0)!;
  t.owner = 0; t.buildings = []; delete t.yoke;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  c.events = [];
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 6, women: 6, elders: 0, children: 2 }); delete f.hungry;
  c.turn = 100;
  noteHolders(c); // taken as long held
  return { c, t, f };
};

describe('unrest is a town\'s own matter', () => {
  it('a plain long-held town has the base chance, eased by its long keeping', () => {
    const { c, t } = town();
    expect(heldFor(c, t.id)).toBeGreaterThanOrEqual(UNREST.settle);
    expect(unrestChance(c, t.id)).toBeCloseTo(UNREST.base * UNREST.settled * unrestWeights(c, t.id).nobles * unrestWeights(c, t.id).pious);
  });

  it('hunger, a tavern and a new holder make it likelier; a church and Farmland steady it', () => {
    const { c, t, f } = town();
    const plain = unrestChance(c, t.id);
    f.hungry = 2;
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * UNREST.hungry);
    delete f.hungry;
    t.buildings = ['church'];
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * UNREST.church);
    t.buildings = ['farm'];
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * UNREST.farm);
    t.buildings = ['tavern'];
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * UNREST.tavern);
    t.buildings = [];
    // It changes hands: held from now, and restless for it, easing as the years go.
    t.owner = 1; noteHolders(c); t.owner = 0; c.turn++; noteHolders(c);
    expect(heldFor(c, t.id)).toBe(0);
    const fresh = unrestChance(c, t.id);
    expect(fresh).toBeGreaterThan(plain * 2);
    c.turn += UNREST.settle / 2;
    expect(unrestChance(c, t.id)).toBeLessThan(fresh);
    expect(unrestChance(c, t.id)).toBeGreaterThan(plain);
    c.turn += UNREST.settle;
    expect(unrestChance(c, t.id)).toBeCloseTo(plain);
  });

  it('an angry noble doubles it, and content nobles ease it', () => {
    const { c, t, f } = town();
    Object.assign(f, { men: 12, women: 12 }); // enough people for a lord of its own
    const nobles = noblesAt(c, t.id);
    if (!nobles.length) return; // this world gives the town no noble: nothing to ask
    for (const n of nobles) n.mood = 0;
    const plain = unrestChance(c, t.id);
    for (const n of nobles) n.mood = 100;
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * (1 - UNREST.mood));
    nobles[0].mood = NOBLES.angry;
    expect(unrestWeights(c, t.id).nobles).toBe(UNREST.angry);
    expect(unrestChance(c, t.id)).toBeCloseTo(plain * UNREST.angry);
  });

  it('it is never more than the most, whatever is wrong', () => {
    const { c, t, f } = town();
    f.hungry = 5; t.buildings = ['tavern'];
    t.owner = 1; noteHolders(c); t.owner = 0; c.turn++; noteHolders(c);
    const was = UNREST.base; UNREST.base = 0.5;
    try { expect(unrestChance(c, t.id)).toBe(UNREST.most); } finally { UNREST.base = was; }
  });

  it('no unrest in a capital, a garrisoned town, a town taken and not yet settled, an empty town, or one already troubled', () => {
    const { c, t, f } = town();
    expect(mayStir(c, t.id)).toBe(true);
    expect(mayStir(c, t.id, new Set([t.id]))).toBe(false);
    c.armies.push({ id: c.nextArmy++, owner: 0, at: t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(unrestChance(c, t.id)).toBe(0);
    c.armies.pop();
    t.yoke = { from: 1, since: c.turn - 3, resent: 60 };
    expect(unrestChance(c, t.id)).toBe(0); // resentment's matter
    t.yoke.settled = true;
    expect(unrestChance(c, t.id)).toBe(0); // settled, but taken within five years: still its resentment's account
    t.yoke.since = c.turn - UNREST.taken;
    expect(unrestChance(c, t.id)).toBeGreaterThan(0); // settled and five years on, it is a town like any other
    delete t.yoke;
    Object.assign(f, { men: 0, women: 0, elders: 0, children: 0 });
    expect(unrestChance(c, t.id)).toBe(0);
    const cap = c.territories.find((x) => x.capital === 0)!;
    expect(unrestChance(c, cap.id)).toBe(0);
    expect(unrestChance(c, c.territories.find((x) => x.owner < 0)!.id)).toBe(0);
  });

  it('a season asks every town by its own chance, marks the unrest and leaves the rest alone', () => {
    const { c, t } = town();
    const was = { ...UNREST };
    UNREST.base = 1; UNREST.most = 1; // certain, where it can begin at all
    try {
      const busy = new Set<number>();
      const stirred = unrestSeason(c, busy);
      expect(stirred).toContain(t.id);
      for (const id of stirred) { expect(busy.has(id)).toBe(true); expect(c.territories[id].capital).toBeLessThan(0); }
      expect(c.events!.filter((e) => e.kind === 'unrest' && e.at === t.id)).toEqual([{ kind: 'unrest', at: t.id, turn: c.turn, until: c.turn + UNREST.turns - 1 }]);
      expect(unrestSeason(c, busy)).toEqual([]); // already troubled
      UNREST.base = 0;
      expect(unrestSeason(c)).toEqual([]);
    } finally { Object.assign(UNREST, was); }
  });

  it('a world of few towns has few risings: the count follows the towns, not the world', () => {
    const count = (towns: number): number => {
      const c = newCampaign(11, 2, 1, 'hearth');
      c.armies = [];
      c.territories.forEach((t, i) => { t.owner = i < towns ? 0 : -1; t.capital = -1; t.horde = false; t.buildings = []; delete t.yoke; Object.assign(folkOf(c, t.id), { men: 6, women: 6 }); });
      let n = 0;
      for (c.turn = 10; c.turn < 410; c.turn++) { c.events = []; n += unrestSeason(c).length; }
      return n;
    };
    const few = count(3), many = count(12);
    expect(few).toBeGreaterThan(0);
    expect(many / few).toBeGreaterThan(2.5);
    expect(many / few).toBeLessThan(6);
  });

  it('a town\'s panel can say why', () => {
    const { c, t, f } = town();
    f.hungry = 1; t.buildings = ['church'];
    expect(unrestText(c, t.id)).toContain('it is hungry');
    expect(unrestText(c, t.id)).toContain('a church');
    expect(unrestText(c, c.territories.find((x) => x.capital === 0)!.id)).toBe('');
  });
});
