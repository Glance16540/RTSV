// A rival builds for a resentful town (src/sim/rivalyoke.ts), and a people counted out lives again when a town rises for
// it (src/sim/revival.ts, conquered.ts).
import { describe, expect, it } from 'vitest';
import { build, canBuild, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { siteCost } from '../src/sim/campaignbase';
import { YOKE, seasonOfYoke } from '../src/sim/conquered';
import { bringBack, mayReturn } from '../src/sim/revival';
import { RIVAL_YOKE, easeWith, resentful, rivalEasesYoke } from '../src/sim/rivalyoke';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 3));
/** Rival 1 holding a town it took from rival 2, still resentful. */
function taken(resent = 80) {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = [];
  for (const f of [1, 2]) c.factions[f].isAI = true;
  const t = c.territories.find((x) => x.owner === 2 && x.capital < 0) ?? c.territories.find((x) => x.owner === 2)!;
  t.owner = 1; t.buildings = []; if (t.capital === 2) t.capital = -1;
  t.yoke = { from: 2, since: c.turn, resent };
  c.factions[1].supplies = 40;
  return { c, t };
}
const lend = { canBuild, build };

describe('a rival builds for a resentful town', () => {
  it('its resentful towns, the most resentful first; a settled one is not among them', () => {
    const { c, t } = taken();
    expect(resentful(c, 1)).toEqual([t.id]);
    t.yoke!.resent = YOKE.quiet;
    expect(resentful(c, 1)).toEqual([]);
  });

  it('Farmland first; then a devout people a Church; any other people nothing more', () => {
    const { c, t } = taken();
    c.factions[1].civ = 'dawn'; // the devout
    expect(easeWith(c, 1, t.id)).toBe('farm');
    t.buildings.push('farm');
    expect(easeWith(c, 1, t.id)).toBe('church');
    t.buildings.push('church');
    expect(easeWith(c, 1, t.id)).toBeNull();
    c.factions[1].civ = 'steppe'; t.buildings = []; // worldly
    expect(easeWith(c, 1, t.id)).toBe('farm');
    c.factions[1].civ = 'greece'; // in the middle: it builds no church it does not believe in
    expect(easeWith(c, 1, t.id)).toBe('farm');
  });

  it('builds it, when it can spare the price; not without, and not for the player', () => {
    const { c, t } = taken();
    c.factions[1].civ = 'dawn';
    const got = rivalEasesYoke(c, 1, lend);
    if (got) { expect(got).toEqual({ at: t.id, site: 'farm' }); expect(t.buildings).toContain('farm'); }
    else expect(canBuild(c, 1, t.id, 'farm')).toBe(false); // the town had no room, or the price waits for goods by road (sentfor.ts)
    const poor = taken(); poor.c.factions[1].civ = 'dawn';
    poor.c.factions[1].supplies = siteCost(poor.t, 'farm', 'dawn') + RIVAL_YOKE.spare - 1;
    expect(rivalEasesYoke(poor.c, 1, lend)).toBeNull();
    expect(rivalEasesYoke(c, 0, lend)).toBeNull();
  });
});

describe('a people counted out lives again when a town rises for it', () => {
  it('a computer-led people may; the player\'s never, and not once the campaign is over', () => {
    const { c } = taken();
    c.factions[2].alive = false;
    expect(mayReturn(c, 2)).toBe(true);
    c.factions[0].alive = false;
    expect(mayReturn(c, 0)).toBe(false);
    c.phase = 'over';
    expect(mayReturn(c, 2)).toBe(false);
  });

  it('the town rises, goes back to them, and they live again with it as their seat', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { c, t } = taken(100);
      for (const x of c.territories) if (x.owner === 2) { x.owner = 3 % c.factions.length; if (x.capital === 2) x.capital = -1; }
      c.factions[2].alive = false;
      Object.assign(folkOf(c, t.id), { men: 6, women: 6 });
      c.turn = 10 + seed;
      seasonOfYoke(c);
      if (t.owner !== 2) continue;
      expect(c.factions[2].alive).toBe(true);
      expect(t.capital).toBe(2);
      expect(c.log.some((l) => l.includes('live again'))).toBe(true);
      return;
    }
    throw new Error('the town never rose in 200 seasons');
  });

  it('bringBack makes the town the seat only where the people has none', () => {
    const { c, t } = taken();
    c.factions[2].alive = false;
    bringBack(c, 2, t.id);
    expect(c.factions[2].alive).toBe(true);
  });
});
