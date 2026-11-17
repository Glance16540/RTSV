// Rulers who weigh their nobles (src/sim/nobleweigh.ts): angry lords slow a rival's march and ready it to treat; it
// leaves out decrees that would anger a lord, and deals with its angriest.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { NOBLES, noblesAt, noblesOf, noblesSeason } from '../src/sim/nobles';
import { WEIGH, angersLord, angryLords, marchMargin, treatLean, weighSeason } from '../src/sim/nobleweigh';
import { sensibleDecrees, decreesAt } from '../src/sim/decrees';
import { DEALS } from '../src/sim/nobledeal';
import { folkOf } from '../src/sim/township';

const world = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 1)!.id;
  const f = folkOf(c, tid); f.men = 8; f.women = 8; f.elders = 0; delete f.ages;
  c.factions[1].supplies = 50;
  delete c.factions[1].nobles; noblesSeason(c, 1);
  return { c, tid };
};
const lordOf = (c: Campaign, tid: number) => noblesAt(c, tid).find((n) => n.rank === 'lord')!;

describe('rulers who weigh their nobles', () => {
  it('angry lords make a rival want more strength before it marches, and readier for a truce', () => {
    const { c, tid } = world();
    expect(marchMargin(c, 1)).toBe(0);
    expect(treatLean(c, 1)).toBe(0);
    lordOf(c, tid).mood = NOBLES.angry - 1;
    expect(angryLords(c, 1)).toBe(1);
    expect(marchMargin(c, 1)).toBe(WEIGH.margin);
    expect(treatLean(c, 1)).toBe(WEIGH.treat);
    // The player's own lords do not change the player's armies: the player weighs them.
    expect(marchMargin(c, 0)).toBe(0);
  });

  it('a rival leaves out a decree that would anger a lord, but not grain for a hungry town', () => {
    const { c, tid } = world();
    const lord = lordOf(c, tid);
    lord.leaning = 'worldly'; lord.mood = NOBLES.angry + 5;
    c.territories[tid].buildings = [...c.territories[tid].buildings.filter((b) => b !== 'tavern'), 'tavern'];
    expect(angersLord(c, 1, tid, 'closeTavern')).toBe(true);
    expect(angersLord(c, 1, tid, 'alms')).toBe(false);
    sensibleDecrees(c, 1, (id) => ({ hungry: false, raided: false, moved: id === tid ? -5 : 0, standing: 0 }));
    expect(decreesAt(c, tid).map((d) => d.kind)).not.toContain('closeTavern');
    expect(angersLord(c, 0, c.territories.find((t) => t.capital === 0)!.id, 'closeTavern')).toBe(false); // never for the player
  });

  it('a rival summons its angriest lord to court, and sends gifts when it can spare the goods', () => {
    const { c, tid } = world();
    const lord = lordOf(c, tid);
    lord.mood = NOBLES.angry - 10;
    expect(weighSeason(c, 1)).toBe('summon');
    expect(lord.mood).toBe(NOBLES.angry - 10 + DEALS.summon.mood);
    lord.mood = NOBLES.angry - 10;
    folkOf(c, tid).stores = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    expect(weighSeason(c, 1)).toBe('gift'); // summoned within the year already
    folkOf(c, tid).stores = { food: 0, wood: 0, gold: 0, stone: 0 };
    lord.mood = NOBLES.angry - 10;
    expect(weighSeason(c, 1)).toBe(''); // nothing to spare
    expect(noblesOf(c, 1).length).toBeGreaterThan(0);
  });
});
