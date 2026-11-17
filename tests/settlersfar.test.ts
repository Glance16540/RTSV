// Settlers go further, and a founding is told (docs/PLAYTEST.md 2.2, 2.5, 2.9; src/sim/founding.ts wayOut, emptyWords).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { FOUNDING, emptyWords, settleable, wayOut } from '../src/sim/founding';
import { MIGRATE, freeLands, movesReport, seasonsTo, settle, settleBar } from '../src/sim/migration';
import { convoysTurn, onTheRoad } from '../src/sim/convoys';
import { folkOf } from '../src/sim/township';
import { wilderness } from '../src/sim/wilds';

const empty = (c: Campaign, id: number): void => {
  const t = c.territories[id];
  t.owner = -1; t.militia = 0; t.buildings = []; delete t.town; t.horde = false;
  t.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
  c.bands = (c.bands ?? []).filter((b) => b.at !== id && b.to !== id);
};
/** A one-land player whose capital has an unheld land beside it, and beyond that another: both made empty, the far one plain ground. */
function world(): { c: Campaign; home: number; mid: number; far: number } {
  for (let seed = 1; seed < 80; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    for (const mid of home.adj) {
      const m = c.territories[mid];
      if (m.owner >= 0 || m.capital >= 0) continue;
      const far = m.adj.find((n) => n !== home.id && c.territories[n].owner < 0 && c.territories[n].capital < 0 && !home.adj.includes(n) && !wilderness(c, n));
      if (far === undefined) continue;
      empty(c, mid); empty(c, far);
      const f = folkOf(c, home.id); f.men = 12; f.women = 12; f.elders = 2; f.children = 6; delete f.ages; delete f.hungry;
      f.stores = { food: 3000, wood: 900, gold: 900, stone: 900 };
      return { c, home: home.id, mid, far };
    }
  }
  throw new Error('no seed with two unheld lands in a line from the capital');
}

describe('settlers go further than the land beside their own', () => {
  it('over lands with nobody on them, a season a land, at most FOUNDING.reach out', () => {
    const { c, home, mid, far } = world();
    expect(wayOut(c, 0, far)).toEqual({ gate: home, through: [mid, far] });
    expect(seasonsTo(c, 0, far)).toBe(2);
    expect(seasonsTo(c, 0, mid)).toBe(1);
    expect(freeLands(c, 0).slice(0, 2)).toContain(mid); // the nearest first
    expect(freeLands(c, 0)).toContain(far);
    expect(settleBar(c, 0, home, far)).toBe('');
    // Not through a land somebody lives on: a tribe there bars the way.
    folkOf(c, mid).men = 3;
    expect(wayOut(c, 0, far)).toBeNull();
    expect(settleBar(c, 0, home, far)).toContain('too far');
    expect(FOUNDING.reach).toBeGreaterThanOrEqual(2);
  });

  it('they are two seasons on the road to a land two out, and coming in they found it; the log and the season\'s report say so', () => {
    const { c, home, far } = world();
    const since = c.turn;
    expect(settle(c, 0, home, far)).toBe('');
    expect(c.log.at(-1)).toContain('in 2 seasons');
    const x = onTheRoad(c, 0).find((y) => y.found)!;
    expect(x.road.at(-1)).toBe(far);
    c.turn++;
    expect(convoysTurn(c).some((a) => a.founded)).toBe(false); // still on the way
    c.turn++;
    expect(convoysTurn(c).some((a) => a.founded)).toBe(true);
    expect(c.territories[far].owner).toBe(0);
    expect(c.territories[far].foundedBy).toEqual({ from: home, turn: c.turn });
    const said = `Settlers from ${c.territories[home].name} have founded ${c.territories[far].name}`;
    expect(c.log.some((l) => l.includes(said))).toBe(true);
    expect(movesReport(c, 0, since).some((l) => l.startsWith(said))).toBe(true);
    expect(MIGRATE.provisions.food).toBeGreaterThan(0);
  });
});

describe('a land with nobody on it says what it is', () => {
  it('true wilderness, or an empty land for settlers; nothing for a land somebody lives on', () => {
    const { c, mid } = world();
    expect(emptyWords(c, mid)!.name).toBe(wilderness(c, mid) ? 'Wilderness' : 'Empty land');
    expect(emptyWords(c, mid)!.desc).toContain('Nobody lives here');
    const home = c.territories.find((t) => t.capital === 0)!;
    expect(emptyWords(c, home.id)).toBeNull();
    for (let seed = 1; seed < 40; seed++) {
      const w = newCampaign(seed, 1, 1, 'hearth');
      const wild = w.territories.find((t) => wilderness(w, t.id));
      if (!wild) continue;
      expect(settleable(w, wild.id)).toBe(false);
      expect(emptyWords(w, wild.id)).toMatchObject({ name: 'Wilderness' });
      expect(emptyWords(w, wild.id)!.desc).toContain('cannot be settled or taken');
      return;
    }
    throw new Error('no wilderness');
  });
});
