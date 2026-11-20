// The Prophet and the Shaman are a mirror pair (src/sim/darkarts.ts; docs/DESIGN.md, the owner's word).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { ABILITIES, CALAMITY, UNITS } from '../src/sim/data';
import { DARK, PROPHET_CASTS, SHAMAN_CASTS, castsOf, cursed, darkChoice, darkFaith, isLow } from '../src/sim/darkarts';
import { run, spot } from './helpers';

/** Two towns; the first of the standing given, rich, in the Bronze Age, with a Temple. */
const town = (virtue: number, foe = 0) => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 4; p.virtue = virtue; p.dilemmaT = 1e9; p.popCap = 80;
  g.players[1].virtue = foe; g.players[1].dilemmaT = 1e9;
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 9000;
  const at = spot(g, 'temple', 0), temple = g.spawnBuilding('temple', 0, at.cx, at.cy, true);
  g.aging = false;
  return { g, p, temple };
};
const STEPS = [80, 40, 0, -40, -80]; // the five steps of standing, top to bottom

describe('who trains whom', () => {
  it('the Prophet only on the top two steps, the Shaman only on the bottom two, and the middle neither', () => {
    const can = (unit: string) => STEPS.map((v) => town(v).g.creedBar(0, UNITS[unit]) === null);
    expect(can('prophet')).toEqual([true, true, false, false, false]);
    expect(can('shaman')).toEqual([false, false, false, true, true]);
    expect(isLow(-30)).toBe(true);
    expect(isLow(-29)).toBe(false);
  });
  it('a town says why in the new names, and the order to train is refused with it', () => {
    const mid = town(0), low = town(-40), good = town(40);
    expect(mid.g.creedBar(0, UNITS.shaman)).toBe('Only a Dissolute or Depraved town would have a Shaman.');
    expect(mid.g.cmdTrain(0, mid.temple.id, 'shaman')).toBe(false);
    expect(mid.g.cmdTrain(0, mid.temple.id, 'prophet')).toBe(false);
    expect(low.g.cmdTrain(0, low.temple.id, 'shaman')).toBe(true);
    expect(low.g.cmdTrain(0, low.temple.id, 'prophet')).toBe(false);
    expect(good.g.cmdTrain(0, good.temple.id, 'prophet')).toBe(true);
    expect(good.g.cmdTrain(0, good.temple.id, 'shaman')).toBe(false);
    expect(UNITS.shaman.desc).toContain('Dissolute or Depraved');
    expect(UNITS.prophet.desc).toContain('Upright or Virtuous');
  });
  it('one already in the town when its standing changes is not sent away', () => {
    const { g, p } = town(-40);
    const shaman = g.spawnUnit('shaman', 0, 40, 40);
    p.virtue = 80;
    run(g, 10);
    expect(shaman.dead).toBe(false);
    expect(shaman.owner).toBe(0);
  });
});

describe('each casts his own', () => {
  it('the Prophet\'s four are as they were; the Shaman has three, and blight is in both', () => {
    expect(castsOf('prophet')).toEqual(['plague', 'quake', 'fire', 'blight']);
    expect(castsOf('shaman')).toEqual(['curse', 'blight', 'sickness']);
    for (const id of [...PROPHET_CASTS, ...SHAMAN_CASTS]) expect(ABILITIES[id]).toBeTruthy();
    expect(UNITS.shaman.mana).toBe(DARK.faith);
    expect(UNITS.prophet.mana).toBe(100);
  });
  it('neither can cast the other\'s, however much faith he has', () => {
    const { g } = town(0);
    const shaman = g.spawnUnit('shaman', 0, 40, 40), prophet = g.spawnUnit('prophet', 0, 42, 40);
    shaman.mana = prophet.mana = 100;
    expect(g.cmdCast(0, [shaman.id], 'quake', 44, 44)).toBe(false);
    expect(g.cmdCast(0, [shaman.id], 'plague', 44, 44)).toBe(false);
    expect(g.cmdCast(0, [prophet.id], 'curse', 44, 44)).toBe(false);
    expect(g.cmdCast(0, [prophet.id], 'sickness', 44, 44)).toBe(false);
    expect(g.cmdCast(0, [shaman.id], 'curse', 44, 44)).toBe(true);
    expect(g.cmdCast(0, [prophet.id], 'quake', 44, 44)).toBe(true);
    expect(g.cmdCast(0, [shaman.id, prophet.id], 'blight', 44, 44)).toBe(true); // either may
  });
  it('he keeps his healing: a low town has no Priest, so the Shaman is still its healer', () => {
    expect(UNITS.shaman.heal).toBe(5);
    expect(UNITS.shaman.atk).toBe(0);
    expect(UNITS.priest.needs).toBe('holy');
  });
  it('the Shaman\'s faith comes back the faster the lower his town, as the Prophet\'s does the higher his', () => {
    const rate = (unit: string, v: number) => { const { g } = town(v); return darkFaith(g, g.spawnUnit(unit, 0, 40, 40)); };
    expect(rate('shaman', -80)).toBeGreaterThan(rate('shaman', -40));
    expect(rate('shaman', -40)).toBeGreaterThan(rate('shaman', 0));
    expect(rate('prophet', 80)).toBeGreaterThan(rate('prophet', 40));
    expect(rate('prophet', 40)).toBeGreaterThan(rate('prophet', 0));
    expect(rate('shaman', 0)).toBe(rate('prophet', 0)); // level in the middle
  });
});

describe('the Shaman\'s dark calamities', () => {
  /** A Shaman of the first town beside three soldiers and a villager of the second, whose standing is given. */
  const scene = (foe: number) => {
    const { g } = town(-40, foe);
    const shaman = g.spawnUnit('shaman', 0, 40, 40);
    shaman.mana = DARK.faith;
    const men = [0, 1, 2].map((i) => g.spawnUnit('spearman', 1, 43 + i * 0.6, 41));
    const villager = g.spawnUnit('villager', 1, 43.5, 42, 'f'), own = g.spawnUnit('spearman', 0, 43, 40);
    for (const u of g.units) u.stance = 'hold';
    return { g, shaman, men, villager, own };
  };
  it('a curse: enemy soldiers in the place strike weaker for a time; not villagers, and not his own', () => {
    const { g, shaman, men, villager, own } = scene(0);
    expect(g.cmdCast(0, [shaman.id], 'curse', 43.6, 41)).toBe(true);
    run(g, 2);
    expect(shaman.mana).toBeLessThan(DARK.faith - ABILITIES.curse.cost + 5);
    for (const m of men) expect(cursed(g, m)).toBe(DARK.curse);
    expect(cursed(g, villager)).toBe(1);
    expect(cursed(g, own)).toBe(1);
    run(g, DARK.cursed + 1);
    for (const m of men) expect(cursed(g, m)).toBe(1);
  });
  it('a cursed soldier does less harm with every blow', () => {
    const hurt = (curse: boolean): number => {
      const { g, shaman, men } = scene(0);
      const dummy = g.spawnUnit('swordsman', 0, 43.6, 41.8);
      dummy.stance = 'hold';
      if (curse) { g.cmdCast(0, [shaman.id], 'curse', 43.6, 41); run(g, 1.5); }
      else run(g, 1.5);
      const hp = dummy.hp;
      g.cmdTarget(1, [men[1].id], dummy.id);
      run(g, 8);
      return hp - dummy.hp;
    };
    const plain = hurt(false), weak = hurt(true);
    expect(plain).toBeGreaterThan(0);
    expect(weak).toBeLessThan(plain);
  });
  it('sickness: they sicken as with plague, for a shorter time than the Prophet\'s', () => {
    const { g, shaman, men, own } = scene(0);
    expect(g.cmdCast(0, [shaman.id], 'sickness', 43.6, 41)).toBe(true);
    run(g, 1.5);
    for (const m of men) { expect(m.plagueT).toBeGreaterThan(0); expect(m.plagueT).toBeLessThanOrEqual(DARK.sick); }
    expect(own.plagueT).toBe(0);
    expect(DARK.sick).toBeLessThan(20);
  });
  it('blight is the Prophet\'s own rule in the Shaman\'s hands: enemy fields yield nothing for a time', () => {
    const { g, shaman } = scene(0);
    const at = spot(g, 'farm', 1), farm = g.spawnBuilding('farm', 1, at.cx, at.cy, true);
    shaman.x = farm.x + 3; shaman.y = farm.y;
    expect(g.cmdCast(0, [shaman.id], 'blight', farm.x, farm.y)).toBe(true);
    run(g, 1.5);
    expect(farm.blightT).toBeGreaterThan(0);
    expect(farm.blightT).toBeLessThanOrEqual(CALAMITY.blight);
  });
  it('each falls by the standing of those struck: lightest on the top step, heaviest on the bottom', () => {
    const lasts = (ability: 'curse' | 'sickness') => STEPS.map((foe) => {
      const { g, shaman, men } = scene(foe);
      g.cmdCast(0, [shaman.id], ability, 43.6, 41);
      run(g, 1.5);
      return ability === 'curse' ? (men[0].cursedUntil ?? 0) - g.time : men[0].plagueT;
    });
    for (const xs of [lasts('curse'), lasts('sickness')]) for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });
});

describe('the computer uses each where its people can train him', () => {
  it('its Shaman curses a knot of enemy soldiers, sickens them next, and blights a rival\'s fields when none are near', () => {
    const { g } = town(-40);
    const shaman = g.spawnUnit('shaman', 0, 40, 40);
    shaman.mana = DARK.faith;
    expect(darkChoice(g, 0, shaman)).toBeNull(); // nothing in reach
    const men = [0, 1, 2].map((i) => g.spawnUnit('spearman', 1, 44 + i * 0.6, 41));
    expect(darkChoice(g, 0, shaman)).toMatchObject({ ability: 'curse' });
    for (const m of men) m.cursedUntil = g.time + 20;
    expect(darkChoice(g, 0, shaman)).toMatchObject({ ability: 'sickness' });
    for (const m of men) m.plagueT = 10;
    expect(darkChoice(g, 0, shaman)).toBeNull();
    const a = spot(g, 'farm', 0);
    g.spawnBuilding('farm', 1, a.cx, a.cy, true); g.spawnBuilding('farm', 1, a.cx + 3, a.cy, true);
    shaman.x = a.cx + 1; shaman.y = a.cy + 4;
    for (const m of men) { m.x = shaman.x + 30; }
    expect(darkChoice(g, 0, shaman)).toMatchObject({ ability: 'blight' });
    expect(darkChoice(g, 0, g.spawnUnit('prophet', 0, 40, 40))).toBeNull(); // the Prophet's are chosen as they were
  });
  it('and gives the order: a computer\'s Shaman beside enemy soldiers spends his faith on them', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    g.players[0].virtue = -40; g.players[0].dilemmaT = 1e9; g.aging = false;
    const ai = new AIController(g, 0); ai.setLevel(1);
    const home = g.buildings.find((b) => b.owner === 0)!;
    const shaman = g.spawnUnit('shaman', 0, home.x + 6, home.y + 6);
    shaman.mana = DARK.faith;
    const men = [0, 1, 2].map((i) => g.spawnUnit('spearman', 1, home.x + 9 + i * 0.6, home.y + 7));
    for (const m of men) m.stance = 'hold';
    for (let s = 0; s < 6; s++) { for (let i = 0; i < 20; i++) g.step(); ai.update(); }
    expect(shaman.mana).toBeLessThan(DARK.faith);
    expect(men.some((m) => (m.cursedUntil ?? 0) > g.time || m.plagueT > 0)).toBe(true);
  });
  it('in a middle town its army has no healer of either kind', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
    expect(g.creedBar(0, UNITS.shaman)).toBeTruthy();
    expect(g.creedBar(0, UNITS.priest)).toBeTruthy();
    expect(g.creedBar(0, UNITS.prophet)).toBeTruthy();
  });
});
