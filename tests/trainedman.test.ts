// A townsman trained in a visit is a company when the player leaves, as a man left training is (src/sim/visit.ts armsHome).
import { describe, expect, it } from 'vitest';
import { armyAt, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit } from '../src/sim/visit';
import { MEN, musterOf } from '../src/sim/armytown';
import { folkOf } from '../src/sim/township';

describe('a man trained in a visit, at the present size of towns', () => {
  it('one man is one company: he is on the army\'s roll and gone from the town\'s count', () => {
    expect(MEN.company).toBe(1);
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const a = armyAt(c, home.id)!, had = a.units.infantry, men = folkOf(c, home.id).men, roll = musterOf(c, a.id)!.men[home.id].length;
    beginVisit(c, home.id);
    // The army's soldiers stand as they came (two to a company on the field), and one townsman was trained.
    expect(finishVisit(c, { arms: { army: { infantry: had * 2 }, trained: { infantry: 1 } } })).toBe(true);
    expect(a.units.infantry).toBe(had + 1);
    expect(musterOf(c, a.id)!.men[home.id]).toHaveLength(roll + 1);
    expect(folkOf(c, home.id).men).toBe(men - 1);
    expect(c.log.join('\n')).toContain('you trained in');
  });

  it('three men are three companies', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const a = armyAt(c, home.id)!, had = a.units.infantry;
    beginVisit(c, home.id);
    finishVisit(c, { arms: { army: { infantry: had * 2 }, trained: { infantry: 3 } } });
    expect(a.units.infantry).toBe(had + 3);
  });
});
