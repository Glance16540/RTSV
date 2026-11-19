// The style rules' numbers that were set by rounds of computer games (src/sim/data.ts STYLE_RULES; game.ts lore).
import { describe, expect, it } from 'vitest';
import { STYLES, STYLE_RULES } from '../src/sim/data';
import { Game } from '../src/sim/game';

const game = (civ: string): Game => new Game(5, [{ name: 'A', color: 1, isAI: true, civ }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);

describe('what each style\'s rule is worth to its villagers', () => {
  it('builders gather 5% faster, always; and are told so', () => {
    const g = game('stonekin');
    expect(STYLE_RULES.masonry).toBe(0.05);
    expect(g.lore(0)).toBeCloseTo(1.05, 10);
    g.players[0].techs.add('stonetools');
    expect(g.lore(0)).toBeCloseTo(1.05, 10); // nothing more for what they learn: that is the Scholars'
    expect(STYLES.builder.rule).toContain('gather 5% faster');
    expect(STYLES.builder.rule).toContain('mend themselves');
  });
  it('scholars gather 5% faster before they have learned anything, and 2% more for each technology, up to 30% in all', () => {
    const g = game('forge');
    expect(g.lore(0)).toBeCloseTo(1 + STYLE_RULES.loreBase, 10);
    expect(STYLE_RULES.loreBase).toBe(0.05);
    g.players[0].techs.add('stonetools'); g.players[0].techs.add('bronzetools');
    expect(g.lore(0)).toBeCloseTo(1.05 + 2 * STYLE_RULES.lore, 10);
    for (let i = 0; i < 40; i++) g.players[0].techs.add(`t${i}`);
    expect(g.lore(0)).toBeCloseTo(1 + STYLE_RULES.loreMax, 10);
    expect(STYLES.scholar.rule).toContain('gather 5% faster');
  });
  it('nobody else\'s villagers gather faster by a rule', () => {
    for (const civ of ['hearth', 'persia', 'japan', 'dawn', 'steppe']) expect(game(civ).lore(0)).toBe(1);
  });
  it('a trader\'s market earns two gold each time, where it earned three', () => {
    expect(STYLE_RULES.caravan).toBe(2);
    expect(STYLE_RULES.caravanMarkets).toBe(3);
  });
});
