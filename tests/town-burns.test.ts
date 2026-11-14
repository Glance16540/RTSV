// How fast a crowded town burns, measured: thirty-six houses a tile apart, one in the middle set alight in a dust
// storm (so that lightning falls as well), left to itself and then with a dozen villagers standing by. Eight
// matches of each. As measured when this was written, and as the systems board (scripts/systems.mjs) says:
//   left to itself:   34.1 of 36 houses catch (31 to 36), none burns down, 12.4% of the town's strength is lost, out after 41s
//   twelve villagers: 25.3 of 36 catch (7 to 36), none burns down, 1.8% lost (they mend it after), out after 34s
import { describe, expect, it } from 'vitest';
import { CALAMITY } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { run, villagers } from './helpers';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const kill = (g: Game, e: unknown) => (g as unknown as { kill(e: unknown): void }).kill(e);

function burn(seed: number, hands: number) {
  const g = new Game(seed, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
  g.weather = 'dust'; g.weatherAmt = g.weatherWant = 1; g.weatherT = 1e6;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  // A block of ground near the hall, cleared of trees and stone, where six rows of six will stand.
  let at: { cx: number; cy: number } | null = null;
  const fits = (cx: number, cy: number) => { for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (!g.canPlace('house', cx + i * 3, cy + j * 3)) return false; return true; };
  // Nearest the hall first.
  const spots: [number, number, number][] = [];
  for (let cy = 2; cy + 19 < g.size; cy += 2) for (let cx = 2; cx + 19 < g.size; cx += 2) spots.push([cx, cy, Math.hypot(cx + 9 - tc.x, cy + 9 - tc.y)]);
  for (const [cx, cy] of spots.sort((a, b) => a[2] - b[2])) {
    if (g.buildings.some((b) => b.cx + b.size > cx - 2 && b.cx < cx + 19 && b.cy + b.size > cy - 2 && b.cy < cy + 19)) continue;
    for (const r of g.resources.filter((o) => o.cx + o.size > cx && o.cx < cx + 17 && o.cy + o.size > cy && o.cy < cy + 17)) kill(g, r);
    if (fits(cx, cy)) { at = { cx, cy }; break; }
  }
  if (!at) throw new Error('no room for the town');
  const houses = [];
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) houses.push(g.spawnBuilding('house', 0, at.cx + i * 3, at.cy + j * 3, true));
  for (const u of villagers(g, 0)) kill(g, u);
  for (let i = 0; i < hands; i++) g.spawnUnit('villager', 0, at.cx - 1.5 + (i % 6) * 3.4, at.cy - 1.5 + Math.floor(i / 6) * 17);
  const first = houses[14]; // in the middle
  first.burnT = CALAMITY.fire; first.litAt = g.time; first.hp -= 1;
  const whole = houses.reduce((s, h) => s + h.maxHp, 0);
  const lit = new Set<number>([first.id]);
  let out = 0;
  for (let s = 1; s <= 600; s++) {
    run(g, 1);
    for (const h of houses) if (h.burnT > 0) lit.add(h.id);
    if (!out && houses.every((h) => h.dead || h.burnT <= 0)) out = s;
    if (out && s >= out + 60) break; // out, and stayed out for a minute
    if (houses.some((h) => !h.dead && h.burnT > 0)) out = 0;
  }
  const lost = houses.filter((h) => h.dead).length;
  const harm = 1 - houses.reduce((s, h) => s + (h.dead ? 0 : h.hp), 0) / whole;
  return { caught: lit.size, lost, harm, out: out || 600 };
}

describe('a crowded town on fire', () => {
  it('burns through far less of itself when its villagers turn out', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const alone = SEEDS.map((s) => burn(s, 0)), fought = SEEDS.map((s) => burn(s, 12));
    expect(mean(fought.map((x) => x.caught))).toBeLessThan(mean(alone.map((x) => x.caught)));
    expect(mean(fought.map((x) => x.harm))).toBeLessThan(mean(alone.map((x) => x.harm)) / 2);
    // Left alone it takes most of the town, though no house burns to the ground from catching once.
    expect(mean(alone.map((x) => x.caught))).toBeGreaterThan(24);
    expect(mean(alone.map((x) => x.harm))).toBeGreaterThan(0.08);
    expect(mean(alone.map((x) => x.harm))).toBeLessThan(0.2);
    expect(Math.max(...alone.map((x) => x.lost))).toBe(0);
    expect(mean(alone.map((x) => x.out))).toBeLessThan(90);
  }, 120000);
});
