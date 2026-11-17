// First Orders count what a town raises from the land's panel, and end on outlasting the rivals (src/sim/primer.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { primerBase, primerSteps } from '../src/sim/primer';
import { raiseWork } from '../src/sim/townworks';
import { folkOf } from '../src/sim/township';

describe('first orders', () => {
  it('count a granary raised in a town as building on the land', () => {
    const c = newCampaign(3, 2), cap = c.territories.find((t) => t.capital === 0)!;
    Object.assign(folkOf(c, cap.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
    const base = primerBase(c);
    expect(primerSteps(c, base).find((s) => s.id === 'build')!.done).toBe(false);
    expect(raiseWork(c, 0, cap.id, 'granary')).toBe('');
    expect(primerSteps(c, base).find((s) => s.id === 'build')!.done).toBe(true);
  });

  it('end on outlasting the rivals, not on taking every land', () => {
    const last = primerSteps(newCampaign(3, 2), primerBase(newCampaign(3, 2))).at(-1)!;
    expect(last.title).toBe('Outlast them');
    expect(last.how).toContain('last people left alive');
    expect(last.how).not.toContain('Take every land');
  });
});
