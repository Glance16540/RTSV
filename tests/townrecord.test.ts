// What stands on a town's record, read without anything else (src/sim/townrecord.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { onRecord, standing } from '../src/sim/townrecord';

/** A campaign whose capital's record holds a finished granary, a damaged mill and a well still being built. */
const recorded = () => {
  const c = newCampaign(4, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.capital === 0)!;
  t.town = { at: 0, b: [['granary', 4, 4], ['mill', 8, 4, 0.5], ['well', 6, 9, undefined, 0.3]] };
  return { c, t };
};

describe('townrecord', () => {
  it('onRecord: a building begun or standing, whole or damaged, is on the record', () => {
    const { c, t } = recorded();
    expect(onRecord(c, t.id, 'granary')).toBe(true);
    expect(onRecord(c, t.id, 'mill')).toBe(true);
    expect(onRecord(c, t.id, 'well')).toBe(true); // only begun
    expect(onRecord(c, t.id, 'infirmary')).toBe(false);
  });

  it('standing: only one that is finished, damaged or not; one still being built does not stand', () => {
    const { c, t } = recorded();
    expect(standing(c, t.id, 'granary')).toBe(true);
    expect(standing(c, t.id, 'mill')).toBe(true); // damaged but finished
    expect(standing(c, t.id, 'well')).toBe(false);
    expect(standing(c, t.id, 'infirmary')).toBe(false);
  });

  it('a second of the same kind, finished, makes it stand even if the first is unfinished', () => {
    const { c, t } = recorded();
    t.town!.b.push(['well', 12, 12]);
    expect(standing(c, t.id, 'well')).toBe(true);
  });

  it('a land with no town on its record, an empty record, or no such land, has nothing on it', () => {
    const { c, t } = recorded();
    const bare = c.territories.find((x) => x.id !== t.id && !x.town)!;
    expect(onRecord(c, bare.id, 'granary')).toBe(false);
    expect(standing(c, bare.id, 'granary')).toBe(false);
    t.town = { at: 0, b: [] };
    expect(onRecord(c, t.id, 'granary')).toBe(false);
    expect(onRecord(c, 9999, 'granary')).toBe(false);
    expect(standing(c, -1, 'granary')).toBe(false);
  });

  it('the type is matched exactly', () => {
    const { c, t } = recorded();
    expect(onRecord(c, t.id, 'Granary')).toBe(false);
    expect(onRecord(c, t.id, 'gran')).toBe(false);
  });
});
