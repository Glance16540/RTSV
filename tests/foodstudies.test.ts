// The food and health studies (croprotation.ts, salting.ts, quarantine.ts, midwifery.ts, physicians.ts): each a
// study of the nation's (studies.ts), taught at a food or health building, and doing its work on the map and in a town.
import { describe, expect, it } from 'vitest';
import type { Campaign } from '../src/sim/campaign';
import { TECHS } from '../src/sim/data';
import { actsOfGod, sicken } from '../src/sim/acts';
import { eatTown } from '../src/sim/larder';
import { seasonTown } from '../src/sim/seasonfolk';
import { isStudy, learn, pressing, studySeason, teacherOf } from '../src/sim/studies';
import { leanYear, famine } from '../src/sim/famine';
import { contagion } from '../src/sim/contagion';
import { Game } from '../src/sim/game';
import { ROTATION } from '../src/sim/croprotation';
import { SALTING, saltGrace } from '../src/sim/salting';
import { QUARANTINE, quarantinePass } from '../src/sim/quarantine';
import { MIDWIFERY, midwifeLossIn } from '../src/sim/midwifery';
import { PHYSICIANS, physicianCare } from '../src/sim/physicians';
import { setups, spot, villagers } from './helpers';
import { stand, town } from './foodtown';

const knows = (c: Campaign, f: number, ...ids: string[]): void => { c.factions[f].studies = [...(c.factions[f].studies ?? []), ...ids]; };
const copy = (c: Campaign): Campaign => JSON.parse(JSON.stringify(c)) as Campaign;

describe('the food and health studies', () => {
  it('are studies of the nation\'s, each taught at its building', () => {
    for (const [id, at] of [['croprotation', 'mill'], ['salting', 'granary'], ['quarantine', 'infirmary'], ['midwifery', 'infirmary'], ['physicians', 'infirmary']]) {
      expect(isStudy(id), id).toBe(true);
      expect(teacherOf(id), id).toBe(at);
    }
    expect(TECHS.physicians.requires).toBe('herbalism'); // it improves on Herbalism
  });

  it('are learned in a town where the building that teaches them stands, and paid for', () => {
    const { c, t } = town(['farm']);
    c.factions[0].age = 1;
    expect(learn(c, 0, 'salting', t.id)).toContain('Granary');
    stand(c, t.id, 'granary');
    expect(learn(c, 0, 'salting', t.id)).toBe('');
    expect(c.factions[0].studies).toContain('salting');
  });
});

describe('Crop Rotation', () => {
  it('on the map, a people that rotates its crops loses harvests less often', () => {
    const base = town(['farm']);
    let without = 0, within = 0;
    for (let turn = 20; turn < 420; turn++) {
      const a = copy(base.c); a.turn = turn;
      const b = copy(base.c); b.turn = turn; knows(b, 0, 'croprotation');
      without += actsOfGod(a).filter((s) => s.kind === 'famine' && s.owner === 0).length;
      within += actsOfGod(b).filter((s) => s.kind === 'famine' && s.owner === 0).length;
    }
    expect(without).toBeGreaterThan(0);
    expect(within).toBeLessThan(without);
    expect(within).toBeGreaterThanOrEqual(Math.floor(without * ROTATION.fail * 0.5));
  });

  it('in a town, its fields fail less often', () => {
    const fails = (rotated: boolean): number => {
      const g = new Game(5, setups, 64, false);
      for (let i = 0; i < 3; i++) { const at = spot(g, 'farm', 0); g.spawnBuilding('farm', 0, at.cx, at.cy, true); }
      if (rotated) g.players[0].techs.add('croprotation');
      let n = 0;
      for (let s = 0; s < 6000; s++) { g.tick++; if (leanYear(g).some((b) => b.owner === 0)) n++; for (const b of g.buildings) b.blightT = 0; }
      return n;
    };
    const without = fails(false), within = fails(true);
    expect(without).toBeGreaterThan(0);
    expect(within).toBeLessThan(without);
  });
});

describe('Salting and Smoking', () => {
  it('on the map, laid-by food spoils SALTING.rot as fast', () => {
    const a = town(['farm'], { food: 4000 }), b = town(['farm'], { food: 4000 });
    knows(b.c, 0, 'salting');
    const without = eatTown(a.c, a.t.id).rotted, within = eatTown(b.c, b.t.id).rotted;
    expect(without).toBeGreaterThan(0);
    expect(within).toBeCloseTo(without * SALTING.rot, -1);
  });

  it('in a town, a bare store takes SALTING.grace times as long to turn to hunger', () => {
    const hunger = (salted: boolean): number => {
      const g = new Game(5, setups, 64, false);
      if (salted) g.players[0].techs.add('salting');
      expect(saltGrace(g, 0)).toBe(salted ? SALTING.grace : 1);
      for (let s = 0; s < 30; s++) { g.players[0].res.food = 0; famine(g); }
      return g.players[0].hunger ?? 0;
    };
    expect(hunger(true)).toBeCloseTo(hunger(false) / SALTING.grace, 5);
  });
});

describe('Quarantine', () => {
  it('on the map, plague passes QUARANTINE.pass as often where either town\'s people keep it', () => {
    const { c } = town(['farm']);
    expect(quarantinePass(c, 0, 1)).toBe(1);
    knows(c, 1, 'quarantine');
    expect(quarantinePass(c, 0, 1)).toBe(QUARANTINE.pass); // the well town shuts its gates
    expect(quarantinePass(c, 1, 0)).toBe(QUARANTINE.pass); // the sick town keeps its own
    expect(quarantinePass(c, 0, -1)).toBe(1);
  });

  it('in a town, a people that keeps it catches plague from strangers less readily', () => {
    const caught = (kept: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const g = new Game(seed, setups);
        if (kept) g.players[0].techs.add('quarantine');
        const mine = villagers(g, 0), theirs = villagers(g, 1)[0];
        for (const v of mine) { v.x = mine[0].x + (v.id % 3) * 0.3; v.y = mine[0].y; v.hp = 1e6; }
        theirs.x = mine[0].x + 0.4; theirs.y = mine[0].y + 0.3; theirs.plagueT = 60; theirs.hp = 1e6;
        for (let s = 0; s < 10; s++) { g.tick++; contagion(g); }
        n += mine.filter((v) => v.plagueT > 0).length;
      }
      return n;
    };
    const without = caught(false), within = caught(true);
    expect(without).toBeGreaterThan(0);
    expect(within).toBeLessThan(without);
  });
});

describe('Midwifery', () => {
  it('on the map, fewer of the births that are due fail to come, and a rival pressed by them learns it', () => {
    const missed = (taught: boolean): number => {
      const { c, t, f } = town(['farm'], { people: 30, food: 4000 });
      t.virtue = -90; // a decadent town, where many births do not come
      if (taught) knows(c, 0, 'midwifery');
      let n = 0;
      for (let s = 0; s < 30; s++) { c.turn++; n += seasonTown(c, t.id).missed; f.stores.food = 4000; }
      return n;
    };
    const without = missed(false), within = missed(true);
    expect(without).toBeGreaterThan(0);
    expect(within).toBeLessThan(without);
    // A rival whose towns have lost births, with an Infirmary standing and goods to spare, learns it.
    const { c, t, f } = town(['farm']);
    t.owner = 1; c.factions[1].age = 1;
    f.missed = 3;
    stand(c, t.id, 'infirmary');
    f.stores = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    expect(pressing(c, 1, 'births')).toBeGreaterThan(0);
    expect(studySeason(c, 1)).not.toBeNull();
    expect(c.factions[1].studies ?? []).toContain('midwifery');
  });

  it('in a town, MIDWIFERY.loss of the births that would not come still do not', () => {
    const g = new Game(5, setups);
    expect(midwifeLossIn(g, 0)).toBe(1);
    g.players[0].techs.add('midwifery');
    expect(midwifeLossIn(g, 0)).toBe(MIDWIFERY.loss);
  });
});

describe('Physicians', () => {
  it('on the map, plague takes PHYSICIANS.sick of those it would', () => {
    let without = 0, within = 0;
    for (let turn = 1; turn <= 40; turn++) {
      const a = town([], { people: 90 }), b = town([], { people: 90 }); // a big town, so the toll is more than one person rounded
      knows(b.c, 0, 'physicians');
      a.c.turn = b.c.turn = turn;
      without += sicken(a.c, a.t); within += sicken(b.c, b.t);
    }
    expect(physicianCare(town([]).c, 0)).toBe(1);
    expect(within).toBeLessThan(without);
  });

  it('in a town, healers heal faster on top of Herbalism', () => {
    const m = { heal: 1 } as Parameters<(typeof TECHS)['physicians']['apply']>[0];
    TECHS.herbalism.apply(m);
    const herbs = m.heal;
    TECHS.physicians.apply(m);
    expect(m.heal).toBeCloseTo(herbs + PHYSICIANS.heal, 6);
  });
});
