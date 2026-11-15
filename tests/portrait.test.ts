// Portraits (docs/DESIGN.md, "Icons tell status"; the choice is src/sim/portrait.ts): who a person is, the one body
// they keep for life, how they are, and what has befallen them, read as the key of a woodblock icon.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import type { Captive } from '../src/sim/game';
import { CHAMPION_KILLS } from '../src/sim/champion';
import { FAMINE } from '../src/sim/famine';
import {
  CONQUERED_FOR, NATIONS, Portrait, bodyOf, captivePortrait, captiveKeys, enslavedNumber, feelingOf, markKey, MARK_ORDER, nationOf, notablePortrait,
  personKeys, pickKey, seedOf, standingKeys, standingOf, townStanding, unitKeys, unitPortrait,
} from '../src/sim/portrait';
import { villagers } from './helpers';

/** The icons there are, by key. */
const ICONS = new Set(Object.keys(import.meta.glob('../public/assets/icons/*.webp')).map((f) => f.slice(f.lastIndexOf('/') + 1, -5)));
const has = (k: string): boolean => ICONS.has(k);
const drawn = (p: Portrait | null): string | null => (p ? pickKey(p.keys, has) : null);

const game = (civA = 'england', civB = 'japan') => {
  const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: civA }, { name: 'B', color: 2, isAI: false, civ: civB }]);
  for (const p of g.players) p.dilemmaT = 1e9;
  return g;
};

describe('the icons the portraits need are there', () => {
  it('every people has two bodies of each sex in four feelings, four standings, and its captives', () => {
    for (const n of NATIONS) {
      for (const body of ['woman_full', 'woman_slender', 'man_broad', 'man_lean'])
        for (const f of ['content', 'afraid', 'grief', 'angry']) expect(has(`${n}_${body}_${f}`), `${n}_${body}_${f}`).toBe(true);
      for (const who of ['man', 'woman', 'soldier', 'tavern'])
        for (const st of ['holy', 'plain', 'worldly', 'low']) expect(has(`${n}_${who}_${st}`), `${n}_${who}_${st}`).toBe(true);
      for (const s of ['m', 'f']) {
        expect(has(`${n}_captive_${s}`)).toBe(true);
        for (const k of [1, 2, 3]) expect(has(`${n}_enslaved_${s}_${k}`)).toBe(true);
      }
    }
  });
  it('every mark of condition has its icon', () => {
    for (const m of MARK_ORDER) expect(has(markKey(m, 'f')), m).toBe(true);
  });
});

describe('the choice of key', () => {
  it('a villager is their people, their body and their feeling, then plainer pictures', () => {
    expect(personKeys('greece', 'f', 'woman_full', 'afraid')).toEqual(['greece_woman_full_afraid', 'greece_woman_full_content', 'greece_woman_plain', 'villager_f', 'villager']);
    expect(personKeys('', 'm', 'man_lean', 'angry')).toEqual(['villager_m', 'villager']);
  });
  it("a unit is drawn as its people's, falling back to the one picture of it", () => {
    expect(unitKeys('japan', 'knight')).toEqual(['japan_knight', 'knight']);
    expect(pickKey(unitKeys('japan', 'knight'), has)).toBe('japan_knight');
    // A people's own unit has no second drawing of itself: the plain key stands.
    expect(pickKey(unitKeys('japan', 'samurai'), has)).toBe('samurai');
    expect(unitKeys('', 'wolf')).toEqual(['wolf']);
  });
  it('a town shows its standing on the same lines as the rules', () => {
    expect([100, 30, 29, -29, -30, -69, -70, -100].map(standingOf)).toEqual(['holy', 'holy', 'plain', 'plain', 'worldly', 'worldly', 'low', 'low']);
    expect(standingKeys('egypt', 'tavern', 'low')[0]).toBe('egypt_tavern_low');
    expect(townStanding('mali', 50).woman[0]).toBe('mali_woman_holy');
    expect(standingKeys('', 'tavern', 'low')).toEqual(['milkmaid']);
  });
  it('a captive of a rival people stays clothed; one of slavers is matched to their body', () => {
    expect(captiveKeys('persia', 'f', 'rival', 'woman_full')[0]).toBe('persia_captive_f');
    expect(enslavedNumber('woman_full')).toBe(1);
    expect(enslavedNumber('woman_slender')).toBe(3);
    expect(enslavedNumber('man_broad')).toBe(1);
    expect(enslavedNumber('man_lean')).toBe(2);
    expect(enslavedNumber('man_lean', true)).toBe(3);
    expect(captiveKeys('persia', 'm', 'slaver', 'man_lean', true)).toEqual(['persia_enslaved_m_3', 'persia_enslaved_m', 'status_enslaved_m', 'captive']);
    // Of no people the icons know: the plain mark of one enslaved.
    expect(pickKey(captiveKeys('', 'f', 'slaver', 'woman_full'), has)).toBe('status_enslaved_f');
  });
  it('only peoples the icons know are used', () => {
    expect(nationOf('england')).toBe('england');
    expect(nationOf('')).toBe('');
    expect(nationOf('atlantis')).toBe('');
  });
  it('never a child: no key that names one is ever picked', () => {
    expect(pickKey(['england_child_f', 'villager_f'], () => true)).toBe('villager_f');
    for (const k of ICONS) expect(k).not.toMatch(/child/);
  });
});

describe('one body for life', () => {
  it('is the same every time for the same person, and of their sex', () => {
    for (let id = 1; id < 60; id++) {
      expect(bodyOf('f', id)).toBe(bodyOf('f', id));
      expect(bodyOf('f', id)).toMatch(/^woman_/);
      expect(bodyOf('m', id)).toMatch(/^man_/);
    }
  });
  it('is spread across both bodies', () => {
    const f = new Set(Array.from({ length: 40 }, (_, i) => bodyOf('f', i + 1)));
    const m = new Set(Array.from({ length: 40 }, (_, i) => bodyOf('m', `Name${i}|Hale`)));
    expect(f.size).toBe(2);
    expect(m.size).toBe(2);
  });
  it('follows a named person by name, so it is kept when they are made again', () => {
    expect(seedOf({ id: 7, name: 'Ada', family: 'Hale' })).toBe(seedOf({ id: 99, name: 'Ada', family: 'Hale' }));
    expect(seedOf({ id: 7 })).toBe(7);
  });
  it('a captive keeps the body they had at home', () => {
    const g = game();
    const v = villagers(g, 1).find((u) => u.gender === 'f')!;
    const c: Captive = { from: 1, name: v.name, family: v.family, gender: 'f', trait: '', trait2: '', age: 0, lifespan: 1000 };
    expect(captivePortrait(g, c, 'slaver').body).toBe(unitPortrait(g, v)!.body);
  });
});

describe('feeling, by state', () => {
  it('reads the state as a face', () => {
    expect(feelingOf({})).toBe('content');
    for (const m of [{ raided: true }, { sick: true }, { starving: true }]) expect(feelingOf(m)).toBe('afraid');
    expect(feelingOf({ bereaved: true })).toBe('grief');
    for (const m of [{ captive: true }, { conquered: true }, { rebel: true }, { wronged: true }]) expect(feelingOf(m)).toBe('angry');
    // A wrong shows over fear, and fear over grief.
    expect(feelingOf({ conquered: true, sick: true, bereaved: true })).toBe('angry');
    expect(feelingOf({ sick: true, bereaved: true })).toBe('afraid');
  });

  it('a villager fed and safe is content, of their own people', () => {
    const g = game();
    const v = villagers(g, 0)[0];
    const p = unitPortrait(g, v)!;
    expect(p.feeling).toBe('content');
    expect(drawn(p)).toBe(`england_${p.body}_content`);
  });
  it('sick, starving or raided, afraid; with the marks of sickness and famine', () => {
    const g = game();
    const v = villagers(g, 0)[0];
    v.plagueT = 10;
    let p = unitPortrait(g, v)!;
    expect(p.feeling).toBe('afraid');
    expect(p.marks).toContain('sick');
    v.plagueT = 0;
    g.players[0].hunger = FAMINE.starving + 1;
    p = unitPortrait(g, v)!;
    expect(p.feeling).toBe('afraid');
    expect(p.marks).toContain('starving');
    g.players[0].hunger = 0;
    g.players[0].lastAttacked = { x: v.x + 2, y: v.y, t: g.time };
    expect(unitPortrait(g, v)!.feeling).toBe('afraid');
  });
  it('alone in a house that raised children: grieving', () => {
    const g = game();
    const v = villagers(g, 0).find((u) => u.gender === 'f')!;
    const house = g.spawnBuilding('house', 0, Math.floor(v.x) + 4, Math.floor(v.y) + 4, true);
    house.residents = { m: 0, f: v.id };
    house.children = 2;
    v.homeId = house.id;
    const p = unitPortrait(g, v)!;
    expect(p.feeling).toBe('grief');
    expect(p.marks).toContain('grieving');
    expect(drawn(p)).toBe(`england_${p.body}_grief`);
    // With her husband living, she is not.
    house.residents.m = villagers(g, 0).find((u) => u.gender === 'm')!.id;
    expect(unitPortrait(g, v)!.feeling).toBe('content');
  });
  it('newly taken into another people: angry, and still drawn as their own', () => {
    const g = game();
    const v = villagers(g, 0)[0];
    v.people = 'japan';
    v.story = [{ t: g.time, s: 'Taken into the A' }];
    const p = unitPortrait(g, v)!;
    expect(p.feeling).toBe('angry');
    expect(drawn(p)).toBe(`japan_${p.body}_angry`);
    v.story = [{ t: g.time - CONQUERED_FOR - 1, s: 'Taken into the A' }];
    expect(unitPortrait(g, v)!.feeling).toBe('content');
  });
});

describe('soldiers, captives and marks', () => {
  it("a soldier is drawn as their people's, with a veteran's mark once they have made a name, and wounded below half", () => {
    const g = game('greece');
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const s = g.spawnUnit('swordsman', 0, tc.x + 3, tc.y + 3, 'm');
    expect(drawn(unitPortrait(g, s))).toBe('greece_swordsman');
    s.kills = CHAMPION_KILLS;
    s.hp = s.maxHp * 0.3;
    expect(unitPortrait(g, s)!.marks).toEqual(expect.arrayContaining(['veteran', 'wounded']));
  });
  it('a captive led off by raiders of a rival people is their own people bound; by slavers, enslaved', () => {
    const g = game('england', 'egypt');
    const c: Captive = { from: 1, name: 'Bram', family: 'Hale', gender: 'm', trait: '', trait2: '', age: 0, lifespan: 1000 };
    const rival = captivePortrait(g, c, 'rival', true);
    expect(drawn(rival)).toBe('egypt_captive_m');
    expect(rival.marks).toContain('led');
    const held = captivePortrait(g, c, 'slaver');
    expect(drawn(held)).toBe(`egypt_enslaved_m_${enslavedNumber(held.body!)}`);
    expect(held.marks).toContain('captive');
  });
  it('a notable of the campaign shows the town mood; a veteran is drawn as his soldier', () => {
    const w = notablePortrait('mali', { name: 'Ada', gender: 'f', kind: 'mother' }, { bereaved: true });
    expect(drawn(w)).toBe(`mali_${w.body}_grief`);
    const v = notablePortrait('mali', { name: 'Bram', gender: 'm', kind: 'veteran', unit: 'knight' }, {});
    expect(drawn(v)).toBe('mali_knight');
    expect(v.marks).toEqual(['veteran']);
  });
});
