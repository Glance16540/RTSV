// Signs of a play style's rule at work on the field (src/sim/stylesigns.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { STYLE_RULES } from '../src/sim/data';
import { STYLE_SIGN, styleSign } from '../src/sim/stylesigns';
import { run, setups, spot } from './helpers';

const as = (civ: string) => [{ ...setups[0], civ }, setups[1]];
const signs = (g: Game, style: string) => g.events.filter((e) => e.t === 'style' && e.style === style);

describe('stylesigns', () => {
  it('a Builder\'s hall mending in peace is told, and not every tick', () => {
    const g = new Game(3, as('egypt'));
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    tc.hp = tc.maxHp * 0.5;
    run(g, 10);
    const n = signs(g, 'builder').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(Math.ceil(10 / 4) + 1);
    expect(signs(g, 'builder')[0]).toMatchObject({ player: 0, x: tc.x, y: tc.y });
  });
  it('a people of another style shows no such sign', () => {
    const g = new Game(3, as('hearth'));
    g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!.hp *= 0.5;
    run(g, 10);
    expect(signs(g, 'builder')).toHaveLength(0);
  });
  it('a Trader\'s market tells of the gold it earns', () => {
    const g = new Game(3, as('arabs'));
    const at = spot(g, 'market', 0), m = g.spawnBuilding('market', 0, at.cx, at.cy, true);
    run(g, STYLE_RULES.caravanEvery + 1);
    expect(signs(g, 'trader').some((e) => e.t === 'style' && e.x === m.x && e.y === m.y)).toBe(true);
  });
  it('the Faithful healed at their house of faith', () => {
    const g = new Game(3, as('dawn'));
    const at = spot(g, 'temple', 0), t = g.spawnBuilding('temple', 0, at.cx, at.cy, true);
    const v = g.spawnUnit('villager', 0, t.x + 2, t.y + 2, 'f');
    v.hp = v.maxHp * 0.3;
    run(g, 3);
    expect(signs(g, 'faithful').length).toBe(1); // once in a while for one person, however long the healing
  });
  it('every style has a sign, and the wait is kept per spot', () => {
    for (const s of ['raider', 'builder', 'farmer', 'scholar', 'faithful', 'trader', 'warrior'] as const) expect(STYLE_SIGN[s].icon).toBeTruthy();
    const f = { time: 0, events: [] as unknown[] };
    styleSign(f, 0, 'builder', 1, 1, 7); styleSign(f, 0, 'builder', 1, 1, 7); styleSign(f, 0, 'builder', 2, 2, 8);
    expect(f.events).toHaveLength(2);
    f.time = 10; styleSign(f, 0, 'builder', 1, 1, 7);
    expect(f.events).toHaveLength(3);
  });
});
