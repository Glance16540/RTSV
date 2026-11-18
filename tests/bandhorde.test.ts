// The marauders who hold a land, as one kind of band (src/sim/bandhorde.ts).
import { describe, expect, it } from 'vitest';
import { HORDE_MAX, HORDE_PRIZE, HORDE_SPREAD, HORDE_TURN, eventsAt, income, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { hordeSeason } from '../src/sim/bandhorde';
import { OLD_SEASON } from '../src/sim/ageing';
import { THREATS, heldFrom } from '../src/sim/threats';
import { STORE_KINDS, TOWN_SCALE as S, folkOf } from '../src/sim/township';
import { SUPPLY_UNITS } from '../src/sim/stores';

function world(seed = 5) {
  const c = newCampaign(seed, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const camp = c.territories[home.adj.find((n) => c.territories[n].owner < 0)!];
  c.armies = c.armies.filter((a) => a.at !== home.id);
  return { c, home, camp };
}
const marauders = (c: Campaign) => (c.bands ?? []).filter((b) => b.kind === 'marauders');

describe('the marauders are a band', () => {
  it('none before their season; then they appear in a tribe\'s land, which is theirs, with a band on record', () => {
    const { c } = world();
    for (c.turn = 1; c.turn < HORDE_TURN; c.turn++) hordeSeason(c, []);
    expect(marauders(c)).toHaveLength(0);
    const out: string[] = [];
    for (; c.turn < 40 && !marauders(c).length; c.turn++) hordeSeason(c, out);
    const [b] = marauders(c);
    expect(b).toBeDefined();
    const t = c.territories[b.at];
    expect(t.horde).toBe(true);
    expect(t.owner).toBe(-1);
    expect(t.militia).toBeGreaterThanOrEqual(4);
    expect(b.strength).toBe(t.militia);
    expect(out.join(' ')).toContain('Marauders have made camp at');
    expect(c.bandNews!.some((n) => n.kind === 'came' && n.band === b.id)).toBe(true);
  });

  it('a land marked theirs with no band on record is taken up as one', () => {
    const { c, camp } = world();
    camp.horde = true; camp.militia = 5;
    hordeSeason(c, []);
    expect(marauders(c)).toHaveLength(1);
    expect(marauders(c)[0].at).toBe(camp.id);
  });

  it('a camp grows every season up to its most, and its raid is a strike on a town that defends itself, with a report', () => {
    const { c, home, camp } = world();
    camp.horde = true; camp.militia = 6;
    home.capital = -1; // a town like any other: a chief town's guard and its men turned out are more than a camp of six breaks cheaply enough to sack it (raidclash.ts RAID.easilyOut)
    const f = folkOf(c, home.id);
    Object.assign(f, { men: 1 * S, women: 8 * S, elders: 0, children: 3 * S }); delete f.ages; // as many as that was of a town (township.ts TOWN_SCALE)
    home.buildings = []; delete home.town;
    for (const n of camp.adj) if (n !== home.id) c.territories[n].owner = -1;
    let raid;
    for (c.turn = 10; c.turn < 40 && !raid; c.turn++) { [raid] = hordeSeason(c, []); if (camp.militia < 6) camp.militia = 6; }
    c.turn--; // the season it happened in
    expect(raid).toBeDefined();
    expect(raid!.kind).toBe('marauders');
    expect(raid!.at).toBe(home.id);
    expect(raid!.outcome).toBe('taken');
    expect(raid!.taken.women).toBe(Math.ceil(8 * S * THREATS.carried));
    expect(raid!.taken.men).toBe(0);
    expect(f.children).toBe(3 * S);
    const [b] = marauders(c);
    expect(b.held[0].women.every((s) => s < OLD_SEASON)).toBe(true);
    expect(heldFrom(c, home.id)).toEqual([{ band: b, held: b.held[0] }]); // the one record of who was taken
    expect('taken' in home).toBe(false); // and no count of them on the land
    expect(eventsAt(c, home.id).some((e) => e.kind === 'taken' || e.kind === 'carried')).toBe(true);
    expect(c.bands).toContain(b); // a camp is not scattered by a raid, won or lost
    for (let i = 0; i < 30; i++) { c.turn++; hordeSeason(c, []); }
    expect(camp.militia).toBeLessThanOrEqual(HORDE_MAX);
  });

  it('a town strong enough holds them off, and the camp is the weaker for it but still there', () => {
    const { c, home, camp } = world();
    camp.horde = true; camp.militia = 4;
    home.buildings = ['fortress', 'barracks'];
    Object.assign(folkOf(c, home.id), { men: 12 * S, women: 8 * S, elders: 0, children: 3 * S });
    c.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    for (const n of camp.adj) if (n !== home.id) c.territories[n].owner = -1;
    let raid;
    for (c.turn = 10; c.turn < 40 && !raid; c.turn++) { camp.militia = 4; [raid] = hordeSeason(c, []); }
    expect(raid!.outcome).toBe('held');
    expect(raid!.broken).toBeUndefined();
    expect(marauders(c)).toHaveLength(1);
    expect(camp.horde).toBe(true);
    expect(camp.militia).toBeLessThan(5);
    expect(camp.militia).toBeGreaterThanOrEqual(1);
  });

  it('when the camp\'s land falls to someone, those it held come home, the land is theirs no longer, and the victor is paid', () => {
    const { c, home, camp } = world();
    camp.horde = true; camp.militia = 5;
    hordeSeason(c, []);
    const [b] = marauders(c);
    const f = folkOf(c, home.id), women = f.women;
    b.held.push({ from: home.id, owner: 0, men: [], women: [80, 88], since: c.turn });
    (home as { taken?: number }).taken = 1; // as a campaign saved before the count was retired would have it
    const before = income(c, 0);
    const goods = () => STORE_KINDS.reduce((n, k) => n + folkOf(c, camp.id).stores[k], 0), had = goods();
    camp.owner = 0;
    c.turn++;
    const out: string[] = [];
    hordeSeason(c, out);
    expect(camp.horde).toBe(false);
    expect(marauders(c)).toHaveLength(0);
    expect(f.women + f.elders).toBeGreaterThanOrEqual(women + 2);
    expect('taken' in home).toBe(false); // the old count is dropped on the way
    expect(heldFrom(c, home.id)).toEqual([]);
    expect(income(c, 0)).toBeGreaterThanOrEqual(before);
    expect(goods()).toBe(had + HORDE_PRIZE * SUPPLY_UNITS); // the camp's goods, in the town freed (stores.ts gainAt)
    expect(eventsAt(c, camp.id).some((e) => e.kind === 'freed')).toBe(true);
    expect(out.join(' ')).toContain('You have broken the marauders at');
  });

  it('strong enough, they overrun a land next door that no army holds, and that is a camp of theirs too', () => {
    let seen = false;
    for (let seed = 1; seed <= 12 && !seen; seed++) {
      const { c, camp } = world(seed);
      camp.horde = true;
      for (c.turn = 10; c.turn < 80 && marauders(c).length < 2; c.turn++) { camp.militia = Math.max(camp.militia, HORDE_SPREAD + 2); hordeSeason(c, []); }
      if (marauders(c).length < 2) continue;
      c.turn--; // the season it happened in
      seen = true;
      const next = c.territories[marauders(c)[1].at];
      expect(camp.adj).toContain(next.id);
      expect(next.horde).toBe(true);
      expect(next.owner).toBe(-1);
      expect(c.armies.some((a) => a.at === next.id)).toBe(false);
      expect(eventsAt(c, next.id).some((e) => e.kind === 'overrun')).toBe(true);
    }
    expect(seen).toBe(true);
  });
});
