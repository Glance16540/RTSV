import { describe, expect, it } from 'vitest';
import { nationDress, plainDress } from '../src/client/dress';
import type { Outfit } from '../src/client/person';
import { CIVS } from '../src/sim/data';

const base = (over: Partial<Outfit> = {}): Outfit => ({ female: false, girth: 1, chest: 1, skin: 0xc89a70, hair: 0x3a2a1a, seed: 7, top: 0x3aa648, sleeves: 'short', neck: 1, legs: 0x6a5238, skirt: 'short', skirtColor: 0x3aa648, hairStyle: 'short', beard: false, helmet: '', plate: false, shield: null, weapon: '', metal: null, hat: '', hatColor: 0x8a6a48, cloak: null, mantle: false, apron: null, trim: null, ...over });

describe('each nation dresses its own', () => {
  it('has a dress for every nation, and no two dress a village man alike', () => {
    const seen = new Set<string>();
    for (const civ of Object.keys(CIVS)) {
      // Over a few men, since some of a nation go bare-headed like anyone else.
      const looks = [3, 7, 10, 13, 16].map((seed) => JSON.stringify(nationDress(civ, 'villager', base({ seed }), 0x3aa648))).join();
      expect(seen.has(looks), civ).toBe(false);
      seen.add(looks);
    }
    expect(seen.size).toBe(Object.keys(CIVS).length);
  });
  it('leaves a village woman\'s neckline, sleeves and head covering as her town gave them', () => {
    for (const civ of Object.keys(CIVS)) {
      const o = nationDress(civ, 'villager', base({ female: true, skirt: 'long', sleeves: 'long', neck: 0, hairStyle: 'covered' }), 0x3aa648);
      expect([o.sleeves, o.neck, o.hairStyle, o.beard], civ).toEqual(['long', 0, 'covered', false]);
      // Where the town has taken her apron off, no nation puts one back.
      expect(o.apron, civ).toBe(null);
    }
  });
  it('gives a rider no skirt', () => {
    for (const civ of Object.keys(CIVS)) expect(nationDress(civ, 'rider', base({ skirt: 'none', helmet: 'leather' }), 0x3aa648).skirt, civ).toBe('none');
  });
  it('keeps a soldier in his armour and leaves a nation\'s own units alone', () => {
    for (const civ of Object.keys(CIVS)) {
      const o = nationDress(civ, 'swordsman', base({ mail: true, helmet: 'iron', shield: 1, weapon: 'sword' }), 0x3aa648);
      expect([o.mail, o.weapon, o.shield, o.helmet !== ''], civ).toEqual([true, 'sword', 1, true]);
    }
    expect(plainDress('samurai', true)).toBe(false);
    expect(plainDress('villager', true)).toBe(true);
    expect(plainDress('spearman', true)).toBe(true);
    expect(nationDress('nobody', 'villager', base(), 1)).toEqual(base());
  });
});
