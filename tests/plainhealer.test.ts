// Every town has a plain healer (src/sim/plainhealer.ts; docs/DESIGN.md, the owner's word).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { BUILDINGS, CIV_IDS, UNITS } from '../src/sim/data';
import { HEALERS, HEALERS_KEPT, curesPlague, healerFor } from '../src/sim/plainhealer';
import { run, spot } from './helpers';

const town = (virtue: number, civ = 'hearth') => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 4; p.virtue = virtue; p.dilemmaT = 1e9; p.popCap = 80;
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 9000;
  const at = spot(g, 'temple', 0), temple = g.spawnBuilding('temple', 0, at.cx, at.cy, true);
  g.aging = false;
  return { g, p, temple };
};
const STEPS = [80, 40, 0, -40, -80];

describe('the plain Healer', () => {
  it('is every people\'s, at any standing: nothing bars her', () => {
    expect(UNITS.healer.civ).toBeUndefined();
    expect(UNITS.healer.needs).toBeUndefined();
    expect(UNITS.healer.pagan).toBeFalsy();
    for (const v of STEPS) {
      const { g, temple } = town(v);
      expect(g.creedBar(0, UNITS.healer)).toBeNull();
      expect(g.cmdTrain(0, temple.id, 'healer')).toBe(true);
    }
    for (const civ of CIV_IDS.filter((c) => c !== 'wild' && c !== 'steppe')) expect(town(0, civ).g.creedBar(0, UNITS.healer)).toBeNull();
    expect(BUILDINGS.temple.trains).toContain('healer');
  });
  it('is a modest healer: slower than a Shaman and a Priest, no faith, no calamities, no blow', () => {
    expect(UNITS.healer.heal!).toBeLessThan(UNITS.shaman.heal!);
    expect(UNITS.shaman.heal!).toBeLessThan(UNITS.priest.heal!);
    expect(UNITS.healer.mana).toBeUndefined();
    expect(UNITS.healer.atk).toBe(0);
    expect(UNITS.healer.age).toBeLessThanOrEqual(UNITS.shaman.age);
  });
  it('binds wounds, and does not cure plague: that is still the Priest\'s and the Shaman\'s', () => {
    expect(curesPlague(UNITS.healer)).toBe(false);
    expect(curesPlague(UNITS.shaman)).toBe(true);
    expect(curesPlague(UNITS.priest)).toBe(true);
    expect(curesPlague(UNITS.herbwife)).toBe(true);
    const tend = (type: string) => {
      const { g } = town(0);
      g.spawnUnit(type, 0, 40, 40);
      const hurt = g.spawnUnit('spearman', 0, 41, 40), sick = g.spawnUnit('spearman', 0, 41, 41);
      hurt.hp = hurt.maxHp * 0.5; sick.plagueT = 60;
      const was = hurt.hp;
      run(g, 6);
      return { mended: hurt.hp - was, sick: sick.plagueT > 0 };
    };
    const plain = tend('healer'), shaman = tend('shaman');
    expect(plain.mended).toBeGreaterThan(0);
    expect(plain.mended).toBeLessThan(shaman.mended);
    expect(plain.sick).toBe(true);
    expect(shaman.sick).toBe(false);
  });
  it('a plague-struck man who is also wounded has his wound bound and keeps his sickness', () => {
    const { g } = town(0);
    g.spawnUnit('healer', 0, 40, 40);
    const man = g.spawnUnit('spearman', 0, 41, 40);
    man.hp = man.maxHp * 0.4; man.plagueT = 60;
    run(g, 3);
    expect(man.plagueT).toBeGreaterThan(0);
  });
});

describe('the healer an army keeps', () => {
  it('is a Priest in a town of good standing, a Shaman in one of low, and the plain Healer in the middle', () => {
    expect(STEPS.map((v) => healerFor(town(v).g, 0))).toEqual(['priest', 'priest', 'healer', 'shaman', 'shaman']);
    expect(HEALERS).toEqual(['healer', 'shaman', 'priest']);
  });
  it('the computer keeps one or two in all, of whichever its standing gives, and no more as its standing changes', () => {
    const g = new Game(9, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'persia' }]);
    const ais = g.players.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
    let most = 0, seen = false;
    for (let s = 0; s < 16 * 60 && g.winner < 0; s++) {
      for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; }
      ais.forEach((a) => a.update());
      for (const pid of [0, 1]) {
        const n = g.units.filter((u) => u.owner === pid && !u.dead && HEALERS.includes(u.type)).length + g.buildings.filter((b) => b.owner === pid).reduce((k, b) => k + b.queue.filter((q) => q.kind === 'unit' && HEALERS.includes(q.id)).length, 0);
        most = Math.max(most, n); if (n > 0) seen = true;
      }
    }
    expect(seen).toBe(true); // a middle town's army has a healer again
    expect(most).toBeLessThanOrEqual(HEALERS_KEPT);
  }, 600000);
});
