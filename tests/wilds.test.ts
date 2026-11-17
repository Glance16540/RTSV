// The wild lands: a share of the far and poor lands start with no tribe and no town (src/sim/wilds.ts).
import { describe, expect, it } from 'vitest';
import { moveArmy, newCampaign } from '../src/sim/campaign';
import { DOMINION_SHARE, biomeOf, dominionNeed } from '../src/sim/campaignbase';
import { claimLand, emptyLand, nobodyThere, settleable } from '../src/sim/founding';
import { freeLands, settleBar } from '../src/sim/migration';
import { WILD, farOrPoor, wildable, wilderness } from '../src/sim/wilds';
import { warriorsOf } from '../src/sim/tribes';

describe('the wild lands', () => {
  it('a share of the far and poor lands start wild: nobody there, no warriors, no works, empty for settlers', () => {
    let wild = 0, may = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      const lands = c.territories.filter((t) => t.wild);
      wild += lands.length;
      for (const t of lands) {
        expect(farOrPoor(c, t)).toBe(true);
        expect(t.owner).toBe(-1);
        expect(t.capital).toBe(-1);
        expect(t.buildings).toEqual([]);
        expect(emptyLand(c, t.id)).toBe(true);
        expect(warriorsOf(c, t.id)).toBe(0); // never made up to a tribe's strength
        // Beside no people's chief town: nobody starts with a free land at the door.
        expect(t.adj.some((n) => c.territories[n].capital >= 0)).toBe(false);
      }
      // Of all the far and poor lands, the share made wild:
      may += wildable(c).length; // the wild lands are among them
    }
    expect(wild).toBeGreaterThan(0);
    expect(wild / may).toBeCloseTo(WILD.share, 1);
  });

  it('the same seed makes the same wilds, and the far lands are snow, desert or the map\'s edge', () => {
    const a = newCampaign(5, 2, 1, 'hearth'), b = newCampaign(5, 2, 1, 'hearth');
    expect(a.territories.filter((t) => t.wild).map((t) => t.id)).toEqual(b.territories.filter((t) => t.wild).map((t) => t.id));
    const c = newCampaign(5, 2, 1, 'hearth');
    for (const t of c.territories) {
      const b = biomeOf(c, t.id);
      if (b === 'snow' || b === 'desert') expect(farOrPoor(c, t)).toBe(true);
    }
  });

  it('every people still has tribes to conquer', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 3, 1, 'hearth');
      expect(c.territories.filter((t) => t.owner < 0 && !t.wild).length).toBeGreaterThan(c.territories.length / 3);
    }
  });
});

describe('a land with nobody on it is settled, not conquered', () => {
  it('no army marches on it, a rival does not aim at it, and the land is not counted toward dominion', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      const wild = c.territories.find((t) => t.wild && emptyLand(c, t.id));
      if (!wild) continue;
      // An army of the player's stands on the land beside it.
      const by = c.territories[wild.adj[0]];
      by.owner = 0; c.fronts = [];
      c.armies.push({ id: 77, owner: 0, at: by.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
      expect(nobodyThere(c, wild.id)).toBe(true);
      expect(moveArmy(c, 77, wild.id)).toBe('invalid');
      expect(c.pending).toBeFalsy();
      // A band camped there is fought as a band; the land is still nobody's to take.
      (c.bands ??= []).push({ id: 71, kind: 'raiders', name: 'the Grey Wolves', at: wild.id, strength: 2, since: c.turn, held: [] });
      expect(emptyLand(c, wild.id)).toBe(false);
      expect(moveArmy(c, 77, wild.id)).toBe('invalid');
      // Dominion is a share of the lands with somebody on them.
      const peopled = c.territories.filter((t) => !nobodyThere(c, t.id)).length;
      expect(dominionNeed(c)).toBe(Math.ceil(peopled * DOMINION_SHARE));
      expect(dominionNeed(c)).toBeLessThan(Math.ceil(c.territories.length * DOMINION_SHARE));
      return;
    }
    throw new Error('no seed with a wild land');
  });
});

describe('true wilderness', () => {
  it('a wild land of snow or desert can never be settled, though it is empty for the bands of the far wilds', () => {
    let seen = 0;
    for (let seed = 1; seed <= 40 && seen < 3; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      for (const t of c.territories.filter((x) => x.wild)) {
        const b = biomeOf(c, t.id), hard = b === 'snow' || b === 'desert';
        expect(wilderness(c, t.id)).toBe(hard);
        expect(emptyLand(c, t.id)).toBe(true); // the far-wilds bands still arise there (bandmarch.ts)
        expect(settleable(c, t.id)).toBe(!hard);
        if (!hard) continue;
        seen++;
        // Settlers of the player's beside it are refused, by name, and it is not offered.
        const by = c.territories[t.adj[0]];
        by.owner = 0;
        expect(freeLands(c, 0)).not.toContain(t.id);
        expect(settleBar(c, 0, by.id, t.id)).toContain('true wilderness');
        expect(claimLand(c, t.id, 0)).toBe(false);
        expect(t.owner).toBe(-1);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
