// A leader's chosen skin and face (the hero creator's look, carried to the figure).
import { describe, expect, it } from 'vitest';
import { cleanHero } from '../src/sim/hero';
import { leaderOutfit } from '../src/client/person';
import type { Outfit } from '../src/client/person';

const base: Outfit = { female: false, girth: 1, chest: 1, skin: 0xc89a70, hair: 0x3a2a1a, seed: 7, top: 1, sleeves: 'short', neck: 1, legs: 1, skirt: 'short', skirtColor: 1, hairStyle: 'short', beard: false, helmet: '', plate: false, shield: null, weapon: '', metal: null, hat: '', hatColor: 1, cloak: null, mantle: false, apron: null, trim: null };
const hero = (look: object) => ({ name: 'Ada', female: true, calling: 'warlord', bent: 'strength', might: 3, guard: 2, vigour: 1, look });

describe('a leader\'s skin and face', () => {
  it('are kept with the hero, within bounds, and left out when not chosen', () => {
    expect(cleanHero(hero({ skin: 0x74482c, face: 18 }) as never, 'hearth').look).toMatchObject({ skin: 0x74482c, face: 18 });
    expect(cleanHero(hero({ skin: 0x1ffffff, face: 500 }) as never, 'hearth').look).toMatchObject({ skin: 0xffffff, face: 99 });
    const plain = cleanHero(hero({}) as never, 'hearth').look!;
    expect('skin' in plain || 'face' in plain).toBe(false);
  });
  it('reach the figure, and a leader with none keeps their people\'s skin and the face chance gave', () => {
    expect(leaderOutfit(base, true, { skin: 0x74482c, face: 18 })).toMatchObject({ skin: 0x74482c, face: 18 });
    const o = leaderOutfit(base, false, {});
    expect([o.skin, o.face]).toEqual([0xc89a70, undefined]);
  });
});
