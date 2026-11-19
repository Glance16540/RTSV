// Lines fixed in the browser sweep of 19 November 2026: how a house speaks of a son away, and of its mother.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { notableOf } from '../src/sim/notable';
import { awayHtml } from '../src/client/housepanel';
import { setups, spot } from './helpers';

describe('the sweep\'s lines', () => {
  it('a son away with no name of his own is spoken of as the son of the house, his arm once', () => {
    const g = new Game(5, setups), at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const son = g.spawnUnit('spearman', 0, h.x + 3, h.y, 'm'); son.lifespan = 2000; son.bornAt = h.id; son.homeId = 0; son.name = '';
    const html = awayHtml(g, h);
    expect(html).toContain('A son of the house is away at war as a spearman');
    expect(html).not.toMatch(/Spearman<\/b>, a son/);
  });
  it('a mother of a house of renown is the mother of that house, of so many children', () => {
    const g = new Game(5, setups), at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const w = g.units.find((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'f')!;
    h.residents.f = w.id; w.homeId = h.id; h.family = 'Ashby'; h.children = 6;
    expect(notableOf(g, w)?.known).toBe('Mother of the Ashby house, which has raised 6 children');
  });
});
