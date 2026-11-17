// Men sent by kin abroad or by a story are men of a real town; an army saved before rolls is given one (armytown.ts
// levyFrom, rollOld; aftermath.ts callOn; slots.ts readSlot).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MEN, levyFrom, menOf, musterOf, rollOld, sparedMen } from '../src/sim/armytown';
import { AFTER, callOn } from '../src/sim/aftermath';
import { awayFrom } from '../src/sim/warhouse';
import { folkOf, headcount } from '../src/sim/township';

const world = (): Campaign => { const c = newCampaign(7, 1, 1, 'hearth'); c.fronts = []; return c; };

describe('companies from a real town', () => {
  it('come as far as the town can spare men, youngest first, on the army\'s roll and away from their houses', () => {
    const c = world();
    const home = c.territories.find((t) => t.capital === 0)!, a = c.armies.find((x) => x.owner === 0)!;
    const f = folkOf(c, home.id); f.men = 40; f.women = 20; delete f.ages;
    const had = { units: a.units.infantry ?? 0, men: f.men, away: awayFrom(c, home.id), spare: sparedMen(c, home.id) };
    const n = levyFrom(c, a, home.id, 2);
    expect(n).toBe(Math.min(2, Math.floor(had.spare / MEN.company)));
    expect(a.units.infantry).toBe(had.units + n);
    expect(folkOf(c, home.id).men).toBe(had.men - n * MEN.company);
    expect(awayFrom(c, home.id)).toBe(had.away + n * MEN.company);
    // A town that cannot spare a man sends none.
    const g = folkOf(c, home.id); g.men = MEN.floor; delete g.ages;
    expect(levyFrom(c, a, home.id, 1)).toBe(0);
  });
});

describe('kin abroad', () => {
  const marry = (c: Campaign) => { (c.marks ??= []).push({ id: 91, kind: 'alliance', from: 'suitor', story: 1, owner: 0, since: c.turn, until: c.turn + 40, rival: 1, name: 'Ada', text: '' }); };
  it('send men of a town of theirs, each on the roll as that town\'s; with none to spare they cannot come', () => {
    let tried = 0;
    const was = AFTER.alliance.send;
    try {
    for (let seed = 1; seed <= 30; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      c.fronts = [];
      marry(c);
      const chief = c.territories.find((t) => t.capital === 1)!;
      const f = folkOf(c, chief.id); f.men = 60; f.women = 20; delete f.ages;
      const before = headcount(folkOf(c, chief.id));
      AFTER.alliance.send = 1; // they answer, for the test
      const how = callOn(c, 91);
      if (how !== 'sent') continue;
      tried++;
      const a = c.armies.find((x) => x.owner === 0 && musterOf(c, x.id)?.men[chief.id]?.length)!;
      expect(a).toBeTruthy();
      expect(menOf(c, a).town).toBeGreaterThan(0);
      expect(headcount(folkOf(c, chief.id))).toBeLessThan(before);
      // Their towns bare of men to spare: they cannot come.
      const d = newCampaign(seed, 1, 1, 'hearth');
      marry(d);
      for (const t of d.territories.filter((x) => x.owner === 1)) { const k = folkOf(d, t.id); k.men = MEN.floor; delete k.ages; }
      expect(callOn(d, 91)).toBe('refused');
      break;
    }
    } finally { AFTER.alliance.send = was; }
    expect(tried).toBe(1);
  });
});

describe('a campaign saved before armies had rolls', () => {
  it('gives each army a roll of its people\'s men, the towns\' counts unchanged; a campaign that keeps rolls is left alone', () => {
    const c = world();
    delete c.musters;
    const counts = c.territories.map((t) => (t.folk ? headcount(t.folk) : -1));
    const n = rollOld(c);
    expect(n).toBeGreaterThan(0);
    for (const a of c.armies) expect(menOf(c, a).none).toBe(0);
    expect(c.territories.map((t) => (t.folk ? headcount(t.folk) : -1))).toEqual(counts);
    expect(rollOld(c)).toBe(0);
  });
});
