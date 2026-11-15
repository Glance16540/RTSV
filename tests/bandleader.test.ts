// The leader fights beside the army they ride with against a band, at the usual risk (src/sim/bandfight.ts).
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, heroFor, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { FIGHT, attackBand, bandBattle, fightByMeans } from '../src/sim/bandfight';
import { MAX_RANK } from '../src/sim/hero';
import type { Band } from '../src/sim/threats';

function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  const t = c.territories.find((x) => x.owner === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].heroAlive = true; c.factions[0].heroRank = 2;
  return { c, t };
}
const band = (c: Campaign, t: Territory, strength: number): Band => {
  const b: Band = { id: 900 + (c.bands?.length ?? 0), kind: 'raiders', name: 'the Test Men', at: t.id, strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
const army = (c: Campaign, at: number, n: number, hero: boolean, owner = 0, id = 801) => { const a = { id, owner, at, units: { infantry: n } as Record<string, number>, hero, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('the leader fights beside the army against a band', () => {
  it('with the army they ride with they are in the fight; an army without them fights alone', () => {
    const { c, t } = world();
    const b = band(c, t, 3), a = army(c, t.id, 6, true);
    attackBand(c, a.id, b.id);
    const led = bandBattle(c)!;
    expect(led.setups[0].leaderAway).toBeUndefined();
    expect(led.setups[0].hero).toMatchObject({ name: heroFor(c, 0).name });
    expect(battleConfig(c)!.setups[0].leaderAway).toBeUndefined();
    const other = world();
    const b2 = band(other.c, other.t, 3), a2 = army(other.c, other.t.id, 6, false);
    attackBand(other.c, a2.id, b2.id);
    expect(bandBattle(other.c)!.setups[0].leaderAway).toBe(true);
  });

  it('fallen in a fight fought in person, they are dead, and the army goes on without them', () => {
    const { c, t } = world();
    const b = band(c, t, 3), a = army(c, t.id, 6, true), name = heroFor(c, 0).name;
    attackBand(c, a.id, b.id);
    finishBattle(c, true, { clubman: 8 }, { fell: true });
    expect(c.factions[0].heroAlive).toBe(false);
    expect(c.factions[0].heroRank).toBe(1);
    expect(a.hero).toBe(false);
    expect(c.armies).toContain(a);
    expect(c.log.join('\n')).toContain(`${name} fell in the fight with the Test Men`);
  });

  it('come through a fight won, they are the more seasoned: by what they earned on the field, or a rank', () => {
    const one = world();
    const b = band(one.c, one.t, 3), a = army(one.c, one.t.id, 6, true);
    attackBand(one.c, a.id, b.id);
    const calling = heroFor(one.c, 0).calling;
    finishBattle(one.c, true, { clubman: 8, [calling]: 1, warlord: 1 }, { heroRank: 4 });
    expect(one.c.factions[0].heroAlive).toBe(true);
    expect(one.c.factions[0].heroRank).toBe(4);
    expect(a.hero).toBe(true);
    // Left to the army: a rank for a band broken.
    const two = world();
    const b2 = band(two.c, two.t, 1), a2 = army(two.c, two.t.id, 9, true);
    attackBand(two.c, a2.id, b2.id);
    expect(resolvePending(two.c, 'auto')).toBe(true);
    expect(two.c.factions[0].heroRank).toBe(Math.min(MAX_RANK, 3));
    expect(two.c.factions[0].heroAlive).toBe(true);
  });

  it('an army without the leader leaves them and their standing as they were', () => {
    const { c, t } = world();
    const b = band(c, t, 1), a = army(c, t.id, 9, false);
    attackBand(c, a.id, b.id);
    resolvePending(c, 'auto');
    expect(c.factions[0].heroRank).toBe(2);
    expect(c.factions[0].heroAlive).toBe(true);
  });

  it('routed with nobody watching, the leader falls about one time in ten', () => {
    const { c, t } = world();
    let falls = 0, routs = 0;
    for (let i = 0; i < 300; i++) {
      c.factions[0].heroAlive = true;
      c.armies = c.armies.filter((x) => x.owner !== 0);
      c.bands = [];
      const b: Band = { id: 2000 + i, kind: 'raiders', name: 'the Test Men', at: t.id, strength: 40, since: c.turn, held: [] };
      c.bands.push(b);
      const a = army(c, t.id, 2, true, 0, 3000 + i);
      if (fightByMeans(c, a, b, [])) continue;
      routs++;
      if (!c.factions[0].heroAlive) { falls++; expect(a.hero).toBe(false); }
    }
    expect(routs).toBe(300);
    expect(falls / routs).toBeGreaterThan(FIGHT.leaderFalls / 2);
    expect(falls / routs).toBeLessThan(FIGHT.leaderFalls * 2);
  });
});
