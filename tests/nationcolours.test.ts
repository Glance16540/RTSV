// No two peoples of one world wear colours too alike to tell apart (src/sim/nationcolours.ts).
import { describe, expect, it } from 'vitest';
import { CIV_COLOR, CIV_IDS } from '../src/sim/data';
import { TOO_ALIKE, colourDistance, distinctColours } from '../src/sim/nationcolours';
import { newCampaign } from '../src/sim/campaign';

const apart = (cs: number[]): boolean => cs.every((a, i) => cs.every((b, j) => i === j || colourDistance(a, b) >= TOO_ALIKE));

describe('the colours of the peoples', () => {
  it('keep each people its own colour when no other in the world is like it', () => {
    expect(distinctColours([CIV_COLOR.japan, CIV_COLOR.mali, CIV_COLOR.stonekin])).toEqual([CIV_COLOR.japan, CIV_COLOR.mali, CIV_COLOR.stonekin]);
  });

  it('give the later of two alike a colour of its own, the player keeping theirs', () => {
    const [you, them] = distinctColours([CIV_COLOR.hearth, CIV_COLOR.arabs]);
    expect(you).toBe(CIV_COLOR.hearth);
    expect(colourDistance(you, them)).toBeGreaterThanOrEqual(TOO_ALIKE);
  });

  it('are apart in every world of up to four peoples', () => {
    const ids = CIV_IDS.filter((id) => CIV_COLOR[id] !== undefined);
    for (const a of ids) for (const b of ids) for (const c of ids) for (const d of ids) {
      if (new Set([a, b, c, d]).size < 4) continue;
      expect(apart(distinctColours([a, b, c, d].map((x) => CIV_COLOR[x]))), `${a} ${b} ${c} ${d}`).toBe(true);
    }
  });

  it('the Japanese wear a colour that reads on parchment', () => {
    expect(colourDistance(CIV_COLOR.japan, 0xf4e7c9)).toBeGreaterThan(400);
  });

  it('a new campaign is dealt them', () => {
    for (let seed = 1; seed < 30; seed++) expect(apart(newCampaign(seed, 3).factions.map((f) => f.color))).toBe(true);
  });
});

describe('the pairs the playtest found', () => {
  it('the Franks and the Kushites, and the Malians and the English, are told apart', () => {
    for (const [a, b] of [['hearth', 'kush'], ['mali', 'england']]) {
      const [x, y] = distinctColours([CIV_COLOR[a], CIV_COLOR[b]]);
      expect(y).not.toBe(CIV_COLOR[b]);
      expect(colourDistance(x, y)).toBeGreaterThanOrEqual(TOO_ALIKE);
    }
  });
});
