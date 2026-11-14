// Fire that starts without an enemy (lightning in a storm) and a town that turns out to fight it.
import { describe, expect, it } from 'vitest';
import { FIRE, calamity, fighting, lightning, sentTo, turnOut } from '../src/sim/calamity';
import { Game } from '../src/sim/game';
import { run, spot, villagers } from './helpers';

const town = (seed = 7) => {
  const g = new Game(seed, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
  g.weatherT = 1e6; // no weather unless a test brings it
  return g;
};
const kill = (g: Game, e: unknown) => (g as unknown as { kill(e: unknown): void }).kill(e);
const house = (g: Game, owner = 0) => { const at = spot(g, 'house', owner); return g.spawnBuilding('house', owner, at.cx, at.cy, true); };
/** Everyone in the town sent far off, so that nobody turns out unasked. */
const away = (g: Game, owner = 0) => { for (const u of villagers(g, owner)) kill(g, u); };
const light = (b: { burnT: number; hp: number }, s: number) => { b.burnT = s; b.hp -= 1; };

describe('fighting a fire', () => {
  it('a villager sent to a burning building puts it out sooner, and it is left less hurt', () => {
    const burn = (hands: number) => {
      const g = town();
      const h = house(g);
      const vs = villagers(g, 0);
      for (const u of vs.slice(hands)) kill(g, u);
      light(h, 20);
      if (hands) g.cmdTarget(0, vs.slice(0, hands).map((u) => u.id), h.id);
      let out = -1, most = 0;
      for (let s = 1; s <= 40 && out < 0; s++) { run(g, 1); most = Math.max(most, fighting(g, h)); if (h.burnT <= 0) out = s; }
      return { out, lost: h.maxHp - h.hp, most, g, h };
    };
    const alone = burn(0), two = burn(2);
    expect(alone.out).toBeGreaterThanOrEqual(20);
    expect(two.most).toBe(2);
    expect(two.out).toBeGreaterThan(0);
    expect(two.out).toBeLessThan(alone.out - 5);
    expect(two.lost).toBeLessThan(alone.lost);
  });

  it('nothing is mended while it burns; once the fire is out the same villagers mend it', () => {
    const g = town();
    const h = house(g);
    const u = villagers(g, 0)[0];
    for (const o of villagers(g, 0)) if (o !== u) kill(g, o);
    h.hp = h.maxHp / 2;
    light(h, 12);
    g.cmdTarget(0, [u.id], h.id);
    let rose = false, last = h.hp;
    while (h.burnT > 0) { run(g, 1); if (h.burnT > 0 && h.hp > last) rose = true; last = h.hp; }
    expect(rose).toBe(false);
    const after = h.hp;
    run(g, 10);
    expect(h.hp).toBeGreaterThan(after);
  });

  it('no more than FIRE.hands villagers count at one fire', () => {
    const g = town();
    const h = house(g);
    for (let i = 0; i < FIRE.hands + 4; i++) g.spawnUnit('villager', 0, h.x + 2, h.y + 2);
    light(h, 1e4);
    h.maxHp = h.hp = 1e6;
    light(h, 1e4);
    g.cmdTarget(0, villagers(g, 0).map((u) => u.id), h.id);
    let most = 0;
    run(g, 30, () => { most = Math.max(most, fighting(g, h)); });
    expect(most).toBe(FIRE.hands);
  });

  it('idle villagers near a fire turn out unasked; villagers at work stay at it until called', () => {
    const g = town();
    const h = house(g);
    const vs = villagers(g, 0);
    const tree = g.resources.find((r) => r.type === 'tree')!;
    const busy = vs[0], idle = vs[1];
    for (const o of vs.slice(2)) kill(g, o);
    g.cmdTarget(0, [busy.id], tree.id);
    idle.x = h.x + 3; idle.y = h.y + 3;
    run(g, 1);
    h.maxHp = h.hp = 1e6;
    light(h, 1e4);
    run(g, 2);
    expect(idle.order).toMatchObject({ t: 'build', id: h.id });
    expect(busy.order?.t).not.toBe('build');
    // Called out, the one at work comes too, and goes back to the wood when the fire is out.
    expect(turnOut(g, 0, 1e3)).toBe(1);
    expect(busy.order).toMatchObject({ t: 'build', id: h.id });
    expect(sentTo(g, h)).toBe(2);
    expect(turnOut(g, 0, 1e3)).toBe(0); // nobody is left to call
    h.burnT = 0.5;
    h.hp = h.maxHp;
    run(g, 6);
    expect(busy.order?.t).toBe('gather');
  });

  it('a fire in someone else\'s town calls nobody out', () => {
    const g = town();
    const theirs = house(g, 1);
    light(theirs, 30);
    run(g, 3);
    expect(villagers(g, 0).some((u) => u.order?.t === 'build')).toBe(false);
    expect(turnOut(g, 0, 1e3)).toBe(0);
  });
});

describe('lightning', () => {
  const storm = (g: Game, kind: 'rain' | 'dust' | 'snow') => { g.weather = kind; g.weatherAmt = g.weatherWant = 1; g.weatherT = 1e6; };

  it('falls only while rain or dust is heavy, and sets buildings alight with a warning to their owner', () => {
    const count = (kind: '' | 'rain' | 'dust' | 'snow') => {
      const g = town(11);
      away(g, 0); away(g, 1);
      if (kind) storm(g, kind);
      let lit = 0, warned = 0;
      for (let s = 0; s < 1200; s++) {
        g.tick += 20; g.time += 1;
        const before = new Set(g.buildings.filter((b) => b.burnT > 0));
        calamity(g);
        for (const b of g.buildings) if (b.burnT > 0 && !before.has(b)) lit++;
        for (const e of g.events) if (e.t === 'msg' && e.text.includes('Lightning has struck')) warned++;
        g.events.length = 0;
        for (const b of g.buildings) b.burnT = 0;
      }
      return { lit, warned };
    };
    expect(count('').lit).toBe(0);
    expect(count('snow').lit).toBe(0);
    const rain = count('rain'), dust = count('dust');
    // About one bolt in FIRE.storm seconds, and FIRE.struck of them find a building: near ten in twenty minutes.
    const about = (1200 / FIRE.storm) * FIRE.struck;
    for (const n of [rain, dust]) {
      expect(n.lit).toBeGreaterThan(about / 3);
      expect(n.lit).toBeLessThan(about * 3);
      expect(n.warned).toBe(n.lit);
    }
  });

  it('never strikes a wall, and finds a tower more often than a house', () => {
    const g = town(5);
    for (const b of [...g.buildings]) kill(g, b);
    const at = spot2(g);
    const h = g.spawnBuilding('house', 0, at.cx, at.cy, true), t = g.spawnBuilding('tower', 0, at.cx + 4, at.cy, true);
    const w = g.spawnBuilding('palisade', 0, at.cx + 8, at.cy, true);
    const hits = new Map<number, number>();
    for (let i = 0; i < 4000; i++) {
      g.tick++;
      const b = lightning(g);
      if (b) { hits.set(b.id, (hits.get(b.id) ?? 0) + 1); b.burnT = 0; }
    }
    expect(hits.get(w.id) ?? 0).toBe(0);
    expect(hits.get(t.id)!).toBeGreaterThan(hits.get(h.id)! * 2);
  });

  it('a strike in rain is soon out and does not spread; dry lightning burns longer', () => {
    const struck = (kind: 'rain' | 'dust') => {
      const g = town();
      away(g, 0);
      storm(g, kind);
      const h = house(g);
      h.burnT = FIRE.bolt; h.litAt = g.time; h.hp -= 1;
      let s = 0;
      while (h.burnT > 0 && s < 60) { for (let i = 0; i < 20; i++) g.step(); s++; }
      return s;
    };
    expect(struck('rain')).toBeLessThan(struck('dust') / 2);
  });
});

function spot2(g: Game) {
  for (let cy = 10; cy < g.size - 20; cy++)
    for (let cx = 10; cx < g.size - 20; cx++)
      if (g.canPlace('house', cx, cy) && g.canPlace('tower', cx + 4, cy) && g.canPlace('palisade', cx + 8, cy)) return { cx, cy };
  throw new Error('no spot');
}
