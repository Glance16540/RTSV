// More dilemmas, and which comes when (src/sim/dilemmas.ts, src/sim/creed.ts).
import { describe, expect, it } from 'vitest';
import { DILEMMAS } from '../src/sim/creed';
import { FITS, MORE_DILEMMAS, askOrder, nextDilemma } from '../src/sim/dilemmas';
import { RES_TYPES } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

/** Words that would put a child in a dilemma. */
const CHILD = /\b(child|children|childhood|baby|babies|infant|boy|boys|girl|girls|son|sons|daughter|daughters|kid|kids|youngster|orphan)\b/i;
/** Words that would make one suggestive. */
const SUGGESTIVE = /\b(bed|beds|bedded|naked|lust|kiss|seduce|harlot|whore|brothel|mistress)\b/i;

describe('the dilemmas', () => {
  it('are at least twice as many as the first nine, each its own', () => {
    expect(DILEMMAS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(DILEMMAS.map((d) => d.id)).size).toBe(DILEMMAS.length);
    for (const d of MORE_DILEMMAS) expect(DILEMMAS).toContain(d);
    for (const id of Object.keys(FITS)) expect(DILEMMAS.some((d) => d.id === id)).toBe(true);
  });

  it('answer through the rules there are: the pious way up, the worldly down, goods in the town\'s own stores', () => {
    const g = new Game(4, setups, 72), p = g.players[0];
    for (const d of DILEMMAS) {
      expect(d.a.virtue).toBeGreaterThan(0);
      expect(d.b.virtue).toBeLessThan(0);
      for (const k of ['a', 'b'] as const) {
        const c = d[k];
        expect(c.label && c.result && d.title && d.text).toBeTruthy();
        for (const [r, n] of Object.entries(c.res)) { expect(RES_TYPES).toContain(r); expect(Number.isFinite(n)).toBe(true); }
        Object.assign(p.res, { food: 1000, wood: 1000, gold: 1000, stone: 1000 });
        p.virtue = 0;
        const before = { ...p.res };
        p.dilemma = d.id;
        expect(g.cmdDecide(0, k)).toBe(true);
        for (const r of RES_TYPES) expect(p.res[r] - before[r]).toBe(c.res[r] ?? 0);
        expect(p.virtue).toBe(c.virtue);
        expect(p.dilemma).toBeNull();
      }
    }
  });

  it('name no child, say nothing suggestive, and speak of those held only as held', () => {
    for (const d of DILEMMAS) {
      const words = [d.title, d.text, d.a.label, d.a.result, d.b.label, d.b.result].join(' ');
      expect(words, d.id).not.toMatch(CHILD);
      expect(words, d.id).not.toMatch(SUGGESTIVE);
    }
  });
});

describe('which dilemma comes when', () => {
  it('asks one that belongs to a moment only while it holds', () => {
    const g = new Game(4, setups, 72);
    const asked = new Set<string>();
    for (let i = 0; i < 80; i++) asked.add(nextDilemma(g, 0, DILEMMAS));
    for (const id of ['lamps', 'watch', 'alms', 'hunt', 'mill', 'seed', 'vintage', 'frost', 'held']) expect(asked.has(id), id).toBe(false);
    const at = spot(g, 'tavern', 0);
    g.spawnBuilding('tavern', 0, at.cx, at.cy, true);
    g.season = 'spring';
    const now = new Set<string>();
    for (let i = 0; i < 40; i++) now.add(nextDilemma(g, 0, DILEMMAS));
    for (const id of ['lamps', 'watch', 'seed']) expect(now.has(id), id).toBe(true);
    expect(now.has('vintage')).toBe(false);
  });

  it('asks every fitting one before any comes round again, and without the battle\'s dice', () => {
    const g = new Game(4, setups, 72);
    const fitting = DILEMMAS.filter((d) => !FITS[d.id] || FITS[d.id](g, 0)).length;
    const rng = g.rngState;
    const round = Array.from({ length: fitting }, () => nextDilemma(g, 0, DILEMMAS));
    expect(new Set(round).size).toBe(fitting);
    expect(g.rngState).toBe(rng);
    expect(round).toContain(nextDilemma(g, 0, DILEMMAS)); // a new round begins
    // Each battle and people has its own order.
    expect(askOrder(4, 0, DILEMMAS)).not.toEqual(askOrder(5, 0, DILEMMAS));
    expect(askOrder(4, 0, DILEMMAS)).not.toEqual(askOrder(4, 1, DILEMMAS));
  });

  it('is kept with a battle that is saved', () => {
    const g = new Game(4, setups, 72);
    for (let i = 0; i < 3; i++) nextDilemma(g, 0, DILEMMAS);
    const back = Game.restore(g.serialize());
    expect(back.players[0].asked).toEqual(g.players[0].asked);
    expect(nextDilemma(back, 0, DILEMMAS)).toBe(nextDilemma(g, 0, DILEMMAS));
  });
});
