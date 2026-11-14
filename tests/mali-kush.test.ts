// Mali and Kush: two nations added whole. What every nation must have is checked for all of them in sim.test.ts
// ("every nation is complete"); here is what is theirs alone, and that they are drawn as who they are.
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_EDGE, PERSONA, defence, newCampaign, territoryIncome } from '../src/sim/campaign';
import { BUILDINGS, CIVS, CIV_STYLE, UNITS, baseMods } from '../src/sim/data';
import { LEANING } from '../src/sim/creed';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { LEADERS, LEADER_EVENTS, monogram, personaLines } from '../src/sim/leaders';
import { rivalHero } from '../src/sim/powers';
import { run } from './helpers';

describe('Mali', () => {
  it('is a trading people: its villagers carry more and its horsemen cost less', () => {
    expect(CIV_STYLE.mali).toBe('trader');
    const m = baseMods();
    CIVS.mali.apply(m);
    expect(m.carry).toBe(baseMods().carry + 2);
    expect(m.cavCost).toBe(0.9);
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'mali' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    expect(g.unitCost(0, 'rider').food).toBeLessThan(g.unitCost(1, 'rider').food!);
  });

  it('trains the Sofa Archer and the Mandekalu Horseman, and nobody else does', () => {
    expect(UNITS.sofa).toMatchObject({ civ: 'mali', cls: 'ranged', age: 1 });
    expect(UNITS.sofa.bonus!.infantry).toBeGreaterThan(UNITS.bowman.bonus!.infantry!); // poisoned arrows tell on men on foot
    expect(UNITS.sofa.range).toBe(UNITS.bowman.range);
    expect(UNITS.mandekalu).toMatchObject({ civ: 'mali', cls: 'cavalry', age: 2 });
    expect(UNITS.mandekalu.rangedResist).toBeGreaterThan(0);
    expect(UNITS.mandekalu.hp).toBeLessThan(UNITS.knight.hp); // a lancer of the Iron Age, not a knight before his time
    expect(BUILDINGS.range.trains).toContain('sofa');
    expect(BUILDINGS.stable.trains).toContain('mandekalu');
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'mali' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    const mine = g.spawnBuilding('range', 0, 30, 30, true), theirs = g.spawnBuilding('range', 1, 60, 60, true);
    g.players[0].age = g.players[1].age = 2;
    for (const p of g.players) p.res = { food: 999, wood: 999, gold: 999, stone: 999 };
    expect(g.cmdTrain(1, theirs.id, 'sofa')).toBe(false);
    expect(g.cmdTrain(0, mine.id, 'setibowman')).toBe(false); // nor does Mali train Kush's
    expect(g.cmdTrain(0, mine.id, 'sofa')).toBe(true);
  });

  it('a quilted horseman takes less from arrows than a rider of the same health would', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'mali' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
    const horse = g.spawnUnit('mandekalu', 0, 40.5, 40.5), plain = g.spawnUnit('rider', 0, 40.5, 50.5);
    horse.stance = plain.stance = 'hold';
    plain.maxHp = plain.hp = horse.hp;
    const a = g.spawnUnit('bowman', 1, 45.5, 40.5), b = g.spawnUnit('bowman', 1, 45.5, 50.5);
    g.cmdTarget(1, [a.id], horse.id); g.cmdTarget(1, [b.id], plain.id);
    horse.order = plain.order = null;
    for (let i = 0; i < 6; i++) { horse.x = 40.5; horse.y = 40.5; plain.x = 40.5; plain.y = 50.5; run(g, 1); }
    expect(horse.maxHp - horse.hp).toBeGreaterThan(0);
    expect(horse.maxHp - horse.hp).toBeLessThan(plain.maxHp - plain.hp);
  });

  it('on the map, gold country is worth two more to them', () => {
    const c = newCampaign(4, 2, 1, 'mali');
    const t = { ...c.territories[5], trait: 'gold', buildings: [], capital: -1 };
    expect(territoryIncome(t, 'mali')).toBe(territoryIncome(t, 'hearth') + 2);
    expect(territoryIncome({ ...t, trait: 'hills' }, 'mali')).toBe(territoryIncome({ ...t, trait: 'hills' }, 'persia'));
    expect(CAMPAIGN_EDGE.mali).toContain('Gold');
    expect(PERSONA.mali.peace).toBeGreaterThan(PERSONA.kush.peace); // readier to deal than to fight
    expect(LEANING.mali).toBeGreaterThan(0.5);
  });
});

describe('Kush', () => {
  it('is a warrior people whose walls shoot further and who live well off the land', () => {
    expect(CIV_STYLE.kush).toBe('warrior');
    const m = baseMods();
    CIVS.kush.apply(m);
    expect(m.towerRange).toBe(baseMods().towerRange + 1);
    expect(m.hunt).toBe(1.2);
  });

  it('trains the Bowman of Ta-Seti, who out-shoots other bowmen of his age, and the Guard of Meroe', () => {
    expect(UNITS.setibowman).toMatchObject({ civ: 'kush', cls: 'ranged', age: UNITS.bowman.age });
    expect(UNITS.setibowman.range).toBeGreaterThan(UNITS.bowman.range);
    expect(UNITS.setibowman.cooldown).toBeLessThan(UNITS.bowman.cooldown);
    expect(UNITS.setibowman.range).toBeLessThan(UNITS.longbowman.range); // the longbow of a later age still reaches further
    expect(UNITS.setibowman.range).toBeLessThanOrEqual(BUILDINGS.towncenter.range!); // and he does not out-range a Town Center
    expect(UNITS.meroeguard).toMatchObject({ civ: 'kush', cls: 'infantry', age: 2 });
    expect(UNITS.meroeguard.homeBonus).toBeGreaterThan(1);
    expect(BUILDINGS.range.trains).toContain('setibowman');
    expect(BUILDINGS.barracks.trains).toContain('meroeguard');
    // In the field he reaches a mark a plain bowman's range short of him.
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'kush' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
    const seti = g.spawnUnit('setibowman', 0, 40.5, 40.5), foe = g.spawnUnit('bowman', 1, 40.5 + UNITS.setibowman.range - 0.1, 40.5);
    seti.stance = foe.stance = 'hold';
    run(g, 4);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });

  it('on the map, every land of theirs is defended at one more', () => {
    const k = newCampaign(4, 2, 1, 'kush'), h = newCampaign(4, 2, 1, 'hearth');
    const land = (c: typeof k) => { const t = c.territories.find((x) => x.owner === 0)!; c.armies = c.armies.filter((a) => a.at !== t.id); c.factions[0].virtue = 0; return t.id; };
    expect(defence(k, land(k))).toBe(defence(h, land(h)) + 1);
    expect(CAMPAIGN_EDGE.kush).toContain('defended');
  });
});

describe('who they are', () => {
  it('each has a leader and their other self, a man and a woman, with every line their own', () => {
    for (const id of ['mali', 'kush']) {
      const l = LEADERS[id], other = personaLines(id, true);
      expect(l.alt!.female).toBe(!l.female);
      for (const e of LEADER_EVENTS) {
        expect(l.lines[e].length).toBe(2);
        expect(other[e].length).toBe(2);
        for (const t of [...l.lines[e], ...other[e]]) { expect(t.length).toBeGreaterThan(8); expect(t.length).toBeLessThanOrEqual(160); }
      }
    }
    expect(LEADERS.mali.name).toContain('Mansa');
    expect(LEADERS.kush.name).toContain('Kandake');
    expect(LEADERS.kush.female).toBe(true);
    expect(monogram(LEADERS.mali.name)).toBe('M');
    expect(monogram(LEADERS.kush.name)).toBe('A');
  });

  it('as rivals each is led by a leader made for them, unlike the others of their play style', () => {
    expect(rivalHero('mali')).not.toMatchObject({ might: rivalHero('persia').might, guard: rivalHero('persia').guard, vigour: rivalHero('persia').vigour });
    expect(rivalHero('kush').powers).not.toEqual(rivalHero('japan').powers);
    expect(rivalHero('mali').name).toBe(LEADERS.mali.name);
  });

  it('a skirmish against each as a rival runs, and they build and train', () => {
    for (const civ of ['mali', 'kush']) {
      const g = new Game(9, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ }]);
      const ais = [new AIController(g, 0), new AIController(g, 1)];
      for (let s = 0; s < 600; s++) { run(g, 1); for (const ai of ais) ai.update(); }
      const mine = (o: number) => [g.buildings.filter((x) => x.owner === o).length, g.units.filter((u) => u.owner === o).length];
      expect(g.players[1].defeated, civ).toBe(false);
      // Beside a settled people played by the same hand, they are not left behind.
      expect(mine(1)[0], civ).toBeGreaterThanOrEqual(mine(0)[0] * 0.6);
      expect(mine(1)[1], civ).toBeGreaterThanOrEqual(mine(0)[1] * 0.6);
      expect(mine(1)[0], civ).toBeGreaterThan(3);
    }
  }, 120_000);
});
