// The Granary (src/sim/granary.ts): food kept longer, a failed harvest drawing less, the governor raising one, and
// a bare store lasting longer in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { BUILDINGS, BUILD_PAGES } from '../src/sim/data';
import { actsOfGod } from '../src/sim/acts';
import { FOOD_KEEP, KEEP_SEASONS, eatTown, needOf } from '../src/sim/larder';
import { governTown } from '../src/sim/governor';
import { GRANARY, famineGrace, famineShare, granaryKeeps, granaryWanted } from '../src/sim/granary';
import { famine } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';
import { begun, stand, town as foodTown } from './foodtown';

/** A town of the player's beside the capital, with fields and plenty in store. */
const town = (granary: boolean) => foodTown(granary ? ['farm', 'mill', 'granary'] : ['farm', 'mill'], { food: 3000, goods: 800 }); // a Mill stands already: it is not what is tested
const copy = (c: Campaign): Campaign => JSON.parse(JSON.stringify(c)) as Campaign;

describe('the Granary on the map', () => {
  it('is a building of the town, raised from the map too, offered after the Farm', () => {
    expect(BUILDINGS.granary.name).toBe('Granary');
    expect(BUILDINGS.granary.onMap).toBe(true); // it stands on the town's record, raised from the map (townworks.ts)
    expect(BUILD_PAGES[0].indexOf('granary')).toBe(BUILD_PAGES[0].indexOf('farm') + 1);
  });

  it('keeps more food from spoiling: GRANARY.keep more seasons of the town\'s eating', () => {
    const a = town(false), b = town(true);
    expect(granaryKeeps(a.c, a.t.id)).toBe(0);
    expect(granaryKeeps(b.c, b.t.id)).toBe(GRANARY.keep);
    const need = needOf(a.c, a.t.id);
    expect(Math.max((KEEP_SEASONS + GRANARY.keep) * need, FOOD_KEEP)).toBeLessThan(3000); // both towns hold more than either keeps
    const without = eatTown(a.c, a.t.id).rotted, within = eatTown(b.c, b.t.id).rotted;
    expect(within).toBeLessThan(without);
    expect(b.f.stores.food).toBeGreaterThan(a.f.stores.food);
  });

  it('a failed harvest draws GRANARY.famine of what it would have drawn on the store', () => {
    const base = town(false);
    expect(famineShare(base.c, base.t.id)).toBe(1);
    // The same season, the same chance: with and without the granary.
    for (let turn = 1; turn < 400; turn++) {
      const a = copy(base.c); a.turn = turn;
      const struck = actsOfGod(a).find((s) => s.kind === 'famine' && s.at === base.t.id);
      if (!struck) continue;
      const b = copy(base.c); b.turn = turn; stand(b, base.t.id, 'granary');
      const within = actsOfGod(b).find((s) => s.kind === 'famine' && s.at === base.t.id)!;
      expect(within).toBeTruthy();
      expect(within.food!).toBeLessThan(struck.food!);
      expect(within.food!).toBeCloseTo(struck.food! * GRANARY.famine, -1);
      return;
    }
    throw new Error('no failed harvest in 400 seasons');
  });

  it('the governor raises one where the town has lately lost a harvest or gone hungry, and not otherwise', () => {
    const quiet = town(false);
    expect(granaryWanted(quiet.c, quiet.t.id)).toBe(false);
    governTown(quiet.c, quiet.t.id);
    expect(begun(quiet.c, quiet.t.id, 'granary')).toBe(false);
    const lean = town(false);
    (lean.c.events ??= []).push({ kind: 'famine', at: lean.t.id, turn: lean.c.turn, until: lean.c.turn });
    expect(granaryWanted(lean.c, lean.t.id)).toBe(true);
    governTown(lean.c, lean.t.id);
    expect(begun(lean.c, lean.t.id, 'granary')).toBe(true); // begun on the town's record; the governor finishes it
    expect(granaryWanted(lean.c, lean.t.id)).toBe(false); // one is enough
    const hungry = town(false);
    hungry.f.hungry = 1;
    expect(granaryWanted(hungry.c, hungry.t.id)).toBe(true);
    const bare = town(false);
    bare.t.buildings = [];
    bare.f.hungry = 1;
    expect(granaryWanted(bare.c, bare.t.id)).toBe(false); // no fields, nothing to keep
  });
});

describe('the Granary in a town', () => {
  it('a bare store takes GRANARY.grace times as long to turn to hunger', () => {
    const hunger = (granary: boolean): number => {
      const g = new Game(5, setups, 64, false);
      const p = g.players[0];
      if (granary) { const at = spot(g, 'granary', 0); g.spawnBuilding('granary', 0, at.cx, at.cy, true); }
      expect(famineGrace(g, 0)).toBe(granary ? GRANARY.grace : 1);
      for (let s = 0; s < 40; s++) { p.res.food = 0; famine(g); }
      return p.hunger ?? 0;
    };
    const without = hunger(false), within = hunger(true);
    expect(without).toBeGreaterThan(0);
    expect(within).toBeCloseTo(without / GRANARY.grace, 5);
  });
});
