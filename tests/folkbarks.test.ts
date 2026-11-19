// The people speak when it happens to them (src/client/folkbarks.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';
const said: [number, string][] = [];
vi.mock('../src/client/voice', () => ({ bark: (_g: unknown, u: { id: number }, m: string) => { said.push([u.id, m]); } }));
import { FolkBarks, HURT } from '../src/client/folkbarks';
import { Game } from '../src/sim/game';
import { setups, villagers } from './helpers';

const all = () => true, none = () => false;
let now = 0;
beforeEach(() => { said.length = 0; now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now); });

describe('folkbarks', () => {
  it('a badly hurt soldier cries out once, until whole again, and not if unseen', () => {
    const g = new Game(3, setups), s = g.spawnUnit('spearman', 0, 20, 20, 'm'), b = new FolkBarks();
    s.hp = s.maxHp * 0.2;
    b.update(g, 0, 1, none);
    expect(said).toHaveLength(0);
    b.update(g, 0, 1, all);
    expect(said).toEqual([[s.id, 'hurt']]);
    now += (HURT.every + 1) * 1000; b.update(g, 0, 1, all);
    expect(said).toHaveLength(1); // once while hurt
    s.hp = s.maxHp; b.update(g, 0, 1, all); s.hp = s.maxHp * 0.2;
    now += (HURT.every + 1) * 1000; b.update(g, 0, 1, all);
    expect(said).toHaveLength(2); // whole, then hurt again
  });
  it('the town struck: the nearest of its people there cries out, where the player can see, once in a while', () => {
    const g = new Game(3, setups), vs = villagers(g, 0), b = new FolkBarks();
    const near = vs.reduce((a, v) => (Math.hypot(v.x - vs[0].x - 1, v.y - vs[0].y) < Math.hypot(a.x - vs[0].x - 1, a.y - vs[0].y) ? v : a));
    expect(b.struck(g, 0, vs[0].x + 1, vs[0].y, none)).toBeNull();
    expect(b.struck(g, 0, vs[0].x + 1, vs[0].y, all)?.id).toBe(near.id);
    expect(said).toEqual([[near.id, 'fear']]);
    expect(b.struck(g, 0, vs[0].x + 1, vs[0].y, all)).toBeNull(); // too soon
  });
});
