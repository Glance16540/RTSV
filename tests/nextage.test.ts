// What the next age opens, told on the land panel (src/sim/nextage.ts; docs/PLAYTEST.md finding 14).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { AGES, BUILDINGS, TECHS } from '../src/sim/data';
import { nextAgeOpens, nextAgeText } from '../src/sim/nextage';

describe('what the next age opens', () => {
  it('names the works raised on the map and the studies the nation may learn in the next age, and what it costs', () => {
    const c = newCampaign(3, 1, 1, 'hearth');
    const o = nextAgeOpens(c, 0)!;
    expect(o.age).toBe(AGES[1].name);
    expect(o.works).toContain(BUILDINGS.infirmary.name);
    for (const name of o.works) expect(Object.values(BUILDINGS).find((b) => b.name === name)).toMatchObject({ onMap: true, age: 1 });
    for (const name of o.studies) {
      const t = Object.values(TECHS).find((x) => x.name === name)!;
      expect(t.age).toBe(1);
      expect(t.answers).toBeTruthy();
      expect(!t.civ || t.civ === c.factions[0].civ).toBe(true); // another people's own study is not offered
    }
    expect(o.works).not.toContain(BUILDINGS.granary.name); // the first age's works are open already
    const line = nextAgeText(c, 0, 20);
    expect(line).toMatch(new RegExp(`^The ${AGES[1].name} opens the .*${BUILDINGS.infirmary.name}`));
    expect(line).toContain('Save 20 supplies for it.');
  });

  it('says nothing in the last age', () => {
    const c = newCampaign(3, 1, 1, 'hearth');
    c.factions[0].age = AGES.length - 1;
    expect(nextAgeOpens(c, 0)).toBeNull();
    expect(nextAgeText(c, 0, 0)).toBe('');
  });
});
