// Plague that comes from outside (src/sim/contagion.ts), fire by accident (src/sim/calamity.ts), and what a
// hungry town is told and can be sent (src/sim/famine.ts).
import { describe, expect, it } from 'vitest';
import { FIRE, accident } from '../src/sim/calamity';
import { CONTAGION, boughtIn, contagion } from '../src/sim/contagion';
import { TRADE } from '../src/sim/data';
import { FAMINE, advice, buyFood, canSend, succour, want } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { run, spot } from './helpers';

const town = (opts: { sea?: boolean; allied?: boolean; field?: boolean } = {}) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', team: opts.allied ? 0 : undefined }, { name: 'B', color: 2, isAI: false, civ: 'england', team: opts.allied ? 0 : undefined }], 96, !!opts.field, !!opts.sea);
  g.weatherT = 1e6;
  return g;
};
const said = (g: Game, player: number, what: string) => g.events.some((e) => e.t === 'msg' && e.player === player && e.text.includes(what));
const hallOf = (g: Game, owner: number) => g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;
/** Tick the clock on a second at a time, running only the rule under test. */
const seconds = (g: Game, n: number, each: () => void) => { for (let s = 0; s < n; s++) { g.tick += 20; g.time += 1; each(); } };

describe('plague from outside', () => {
  const meet = (virtue = 0) => {
    const g = town();
    const at = hallOf(g, 1);
    const sick = g.spawnUnit('clubman', 0, at.x + 5, at.y + 5), near = g.spawnUnit('clubman', 1, at.x + 5.6, at.y + 5), far = g.spawnUnit('clubman', 1, at.x + 12, at.y + 5);
    g.players[1].virtue = virtue;
    sick.plagueT = 1e4;
    let caught = 0;
    seconds(g, 120, () => { caught += contagion(g); });
    return { g, near, far, caught };
  };

  it('a plagued soldier gives it to another people\'s who stands by him, and they are told once; not to one across the field', () => {
    const { g, near, far, caught } = meet();
    expect(near.plagueT).toBeGreaterThan(0);
    expect(far.plagueT).toBe(0);
    expect(caught).toBe(1);
    expect(g.events.filter((e) => e.t === 'msg' && e.player === 1 && e.text.includes('Plague has come among your people from A')).length).toBe(1);
  });

  it('the Righteous take it too, but about a third as readily', () => {
    const crossed = (virtue: number) => {
      let n = 0;
      for (let i = 0; i < 60; i++) {
        const g = town();
        g.seed = 500 + i;
        g.players[1].virtue = virtue;
        const at = hallOf(g, 1);
        const sick = g.spawnUnit('clubman', 0, at.x + 5, at.y + 5), near = g.spawnUnit('clubman', 1, at.x + 5.6, at.y + 5);
        sick.plagueT = 1e4;
        seconds(g, 4, () => { contagion(g); });
        if (near.plagueT > 0) n++;
      }
      return n;
    };
    const plain = crossed(0), holy = crossed(100), fallen = crossed(-100);
    expect(holy).toBeGreaterThan(0);
    expect(holy).toBeLessThan(plain * 0.65);
    expect(fallen).toBeGreaterThan(plain);
  });

  it('it takes about as long to cross as CONTAGION.touch says', () => {
    let total = 0;
    const tries = 40;
    for (let i = 0; i < tries; i++) {
      const g = town();
      g.seed = 100 + i;
      const at = hallOf(g, 1);
      const sick = g.spawnUnit('clubman', 0, at.x + 5, at.y + 5), near = g.spawnUnit('clubman', 1, at.x + 5.6, at.y + 5);
      sick.plagueT = 1e4;
      let s = 0;
      while (near.plagueT <= 0 && s < 400) { s++; g.tick += 20; g.time += 1; contagion(g); }
      total += s;
    }
    const mean = total / tries;
    expect(mean).toBeGreaterThan(0.5 / CONTAGION.touch);
    expect(mean).toBeLessThan(2 / CONTAGION.touch);
  });

  it('in the hold of a ship one sick passenger gives it to the rest', () => {
    const g = town({ sea: true });
    const ship = g.spawnUnit('transport', 0, g.size / 2, g.size / 2);
    const men = [0, 1, 2, 3].map(() => g.spawnUnit('clubman', 0, ship.x, ship.y));
    ship.cargo = men.map((m) => m.id);
    for (const m of men) m.inside = ship.id;
    men[0].plagueT = 1e4;
    seconds(g, 60, () => { contagion(g); });
    expect(men.every((m) => m.plagueT > 0)).toBe(true);
    expect(said(g, 0, 'plague aboard your ship')).toBe(true);
  });

  it('a purchase at the Market now and then brings plague, at about the rate CONTAGION.trade says, and never twice in three minutes', () => {
    const g = town();
    const at = spot(g, 'market', 0);
    const m = g.spawnBuilding('market', 0, at.cx, at.cy, true);
    g.spawnUnit('villager', 0, m.x + 2.5, m.y);
    const p = g.players[0];
    p.res.gold = 1e9;
    let broke = 0;
    const buys = 3000;
    for (let i = 0; i < buys; i++) {
      g.tick += 20; g.time += 200; // far enough apart that the last outbreak never stands in the way
      const before = p.plagueAt;
      expect(g.cmdTrade(0, m.id, 'food', 'buy')).toBe(true);
      if (p.plagueAt !== before) broke++;
      for (const u of g.units) u.plagueT = 0;
    }
    expect(broke).toBeGreaterThan(buys * CONTAGION.trade / 2);
    expect(broke).toBeLessThan(buys * CONTAGION.trade * 2);
    expect(said(g, 0, 'plague has broken out at the Market')).toBe(true);
    // One has just broken out: another cannot for three minutes, however it is forced.
    expect(boughtIn(g, m, true)).toBe(true);
    g.time += 100;
    expect(boughtIn(g, m, true)).toBe(false);
    g.time += 100;
    expect(boughtIn(g, m, true)).toBe(true);
    // Among the Righteous it can break out too, and lasts a third as long.
    p.virtue = 100; g.time += 500;
    for (const u of g.units) u.plagueT = 0;
    expect(boughtIn(g, m, true)).toBe(true);
    expect(Math.max(...g.units.filter((u) => u.owner === 0).map((u) => u.plagueT))).toBeCloseTo(CONTAGION.sick / 3, 5);
  });
});

describe('fire by accident', () => {
  const count = (g: Game, n: number) => { let lit = 0; seconds(g, n, () => { const b = accident(g); if (b) { lit++; b.burnT = 0; } }); return lit; };
  const smithy = (working: boolean) => {
    const g = town();
    const at = spot(g, 'blacksmith', 0);
    const b = g.spawnBuilding('blacksmith', 0, at.cx, at.cy, true);
    if (working) b.queue.push({ kind: 'tech', id: 'weapons1', t: 0, time: 1e9 } as never);
    return g;
  };

  it('a Blacksmith with work in hand catches about once in FIRE.forge seconds; an idle one never', () => {
    const n = FIRE.forge * 20;
    const lit = count(smithy(true), n);
    expect(lit).toBeGreaterThan(10);
    expect(lit).toBeLessThan(40);
    expect(count(smithy(false), n)).toBe(0);
  });

  it('never in heavy rain, and about twice as often in a dust storm', () => {
    const n = FIRE.forge * 40;
    const wet = smithy(true); wet.weather = 'rain'; wet.weatherAmt = wet.weatherWant = 1;
    expect(count(wet, n)).toBe(0);
    const dry = smithy(true); dry.weather = 'dust'; dry.weatherAmt = dry.weatherWant = 1;
    const clear = count(smithy(true), n), dusty = count(dry, n);
    expect(dusty).toBeGreaterThan(clear * 1.4);
    expect(dusty).toBeLessThan(clear * 2.8);
  });

  it('a hearth catches only by night and only in a lived-in house, and a hamlet less often than a town', () => {
    const homes = (lived: number) => {
      const g = town();
      for (let i = 0; i < 8; i++) { const at = spot(g, 'house', 0); const h = g.spawnBuilding('house', 0, at.cx, at.cy, true); if (i < lived) h.residents.m = 1; }
      return g;
    };
    const night = (g: Game, n: number) => { let lit = 0; for (let s = 0; s < n; s++) { g.tick += 20; g.time = 240 + (s % 50); expect(g.night).toBe(true); const b = accident(g); if (b) { lit++; expect(b.residents.m).toBe(1); b.burnT = 0; } } return lit; };
    const n = FIRE.hearth * 40;
    const full = night(homes(8), n), one = night(homes(1), n);
    expect(full).toBeGreaterThan(20);
    expect(full).toBeLessThan(80);
    expect(one).toBeLessThan(full / 3);
    expect(night(homes(0), n)).toBe(0);
    const day = homes(8);
    let lit = 0;
    for (let s = 0; s < n; s++) { day.tick += 20; day.time = 10 + (s % 150); if (accident(day)) lit++; }
    expect(lit).toBe(0);
  });

  it('the owner is told, and there are none in a field battle', () => {
    const g = smithy(true);
    count(g, FIRE.forge * 20);
    expect(said(g, 0, 'A spark from the forge')).toBe(true);
    const f = town({ field: true });
    const b = f.spawnBuilding('blacksmith', 0, 20, 20, true);
    b.queue.push({ kind: 'tech', id: 'weapons1', t: 0, time: 1e9 } as never);
    expect(count(f, FIRE.forge * 20)).toBe(0);
  });
});

describe('a hungry town, its Market and its allies', () => {
  it('the warning names what the town can do: no Market, a Market with gold, a Market without', () => {
    const g = town();
    const p = g.players[0];
    expect(advice(g, 0)).toContain('A Market would let you buy food');
    const at = spot(g, 'market', 0);
    g.spawnBuilding('market', 0, at.cx, at.cy, true);
    p.res.gold = 1000;
    expect(advice(g, 0)).toContain(`Your Market will sell you food for ${TRADE.food!.buy} gold`);
    p.res.gold = 0;
    expect(advice(g, 0)).toContain('which you do not have');
    p.res.food = 0;
    run(g, FAMINE.hungry + 2);
    expect(said(g, 0, 'which you do not have')).toBe(true);
  });

  it('an ally is told, and one with a Market and food to spare can send it, which ends the hunger', () => {
    const g = town({ allied: true });
    const hungry = g.players[0], friend = g.players[1];
    const at = spot(g, 'market', 1);
    g.spawnBuilding('market', 1, at.cx, at.cy, true);
    const mine = spot(g, 'market', 0);
    g.spawnBuilding('market', 0, mine.cx, mine.cy, true);
    friend.res.food = 1000;
    expect(canSend(g, 1)).toBe(true);
    hungry.res.food = 0;
    expect(succour(g, 1)).toBe(0); // not hungry yet
    run(g, FAMINE.hungry + 2);
    expect(want(hungry)).toBe('hungry');
    expect(said(g, 1, 'A\'s people are going hungry. You can send them food from your Market.')).toBe(true);
    expect(said(g, 0, 'B could send you some')).toBe(true);
    expect(succour(g, 1)).toBe(1);
    expect(hungry.res.food).toBe(FAMINE.load);
    run(g, 2);
    expect(want(hungry)).toBe('');
    // A town keeps enough for itself before it sends any.
    hungry.res.food = 0; hungry.hunger = FAMINE.hungry;
    friend.res.food = FAMINE.keep + FAMINE.load - 1;
    expect(succour(g, 1)).toBe(0);
  });

  it('a hungry town with a Market and gold can buy its way out; enemies are neither told nor helped', () => {
    const g = town();
    const p = g.players[0];
    const at = spot(g, 'market', 0);
    g.spawnBuilding('market', 0, at.cx, at.cy, true);
    const theirs = spot(g, 'market', 1);
    g.spawnBuilding('market', 1, theirs.cx, theirs.cy, true);
    g.players[1].res.food = 1000;
    p.res.gold = 1000; p.res.food = 0;
    expect(buyFood(g, 0)).toBe(false); // not hungry: it is not this rule's business
    run(g, FAMINE.hungry + 2);
    expect(said(g, 1, 'going hungry')).toBe(false);
    expect(succour(g, 1)).toBe(0);
    expect(buyFood(g, 0)).toBe(true);
    expect(p.res.food).toBe(100);
  });
});
