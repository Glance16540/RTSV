// How each nation dresses its ordinary people: the villagers, and the plain soldiers every nation trains.
// A nation's own special units keep the dress they were given in `person.ts`.
import type { Outfit } from './person';

type Cut = Partial<Outfit>;
/** What a nation changes on a village man, a village woman and a plain soldier, given what they would wear anyway. */
interface Dress { man: (o: Outfit, s: number, color: number) => Cut; woman: (o: Outfit, s: number, color: number) => Cut; soldier: (o: Outfit, s: number, color: number) => Cut }

const LINEN = 0xe8e0cc, GOLD = 0xd8b040, BRONZE = 0xb08a3a, LACQUER = 0x2a2a30;
const of = <T>(list: T[], s: number): T => list[s % list.length];
/** A soldier with no helmet of metal: bare-headed, hooded or in a leather cap. */
const soft = (o: Outfit): boolean => o.helmet === '' || o.helmet === 'leather';
/** Not yet in mail or plate. */
const light = (o: Outfit): boolean => !o.mail && !o.plate;

/** The soldiers every nation trains, as against the units that are a nation's own or a character of their own. */
const PLAIN = new Set(['clubman', 'spearman', 'swordsman', 'pikeman', 'slinger', 'javelineer', 'bowman', 'crossbowman', 'musketeer', 'grenadier', 'rider', 'knight', 'chariot']);
/** Is this unit dressed by its nation? Villagers and the plain line are; so is anyone `person.ts` has no dress of their own for. */
export const plainDress = (type: string, named: boolean): boolean => type === 'villager' || PLAIN.has(type) || !named;

const DRESS: Record<string, Dress> = {
  // Romans: bare legs under a short tunic, clean-shaven; soldiers in red cloaks.
  stonekin: {
    man: (o, s) => ({ legs: o.skin, sleeves: 'short', hat: '', beard: s % 7 === 0, trim: LINEN }),
    woman: (_o, s) => ({ apron: null, trim: GOLD, hairStyle: 'bun', cloak: s % 3 === 0 ? 0xd8cdb8 : null }),
    soldier: (o, _s, color) => ({ legs: o.skin, sleeves: 'short', beard: false, cloak: o.helmet === 'iron' || o.plate ? color : o.cloak, trim: GOLD }),
  },
  // Mongols: a long-sleeved coat, fur hats, trimmed in yellow.
  steppe: {
    man: (_o, s) => ({ sleeves: 'long', neck: 0, hat: s % 3 !== 0 ? 'fur' : '', hatColor: of([0x7a3a2a, 0x5a4634], s), trim: 0xc8a040, legs: 0x4a3a2c, mantle: s % 5 === 0 }),
    woman: (_o, s) => ({ apron: null, trim: 0xc8a040, hairStyle: 'long', mantle: s % 2 === 0 }),
    soldier: (o, s) => ({ sleeves: 'long', trim: 0xc8a040, legs: 0x4a3a2c, mantle: !o.plate, ...(soft(o) ? { helmet: '', hat: 'fur', hatColor: of([0x7a3a2a, 0x5a4634], s) } : {}) }),
  },
  // Franks: hoods and caps, hose.
  hearth: {
    man: (_o, s) => ({ hat: s % 4 === 1 ? 'hood' : s % 4 === 2 ? 'cap' : s % 20 === 3 ? 'straw' : '', hatColor: of([0x6a5238, 0x5a4a5a], s), legs: of([0x54483c, 0x6a3a30, 0x4a4a5a], s) }),
    woman: () => ({}),
    soldier: (_o, s) => ({ trim: LINEN, legs: of([0x54483c, 0x6a3a30], s) }),
  },
  // Chinese: closed collars, straw hats in the fields, dark lacquered armour, long coats.
  forge: {
    man: (_o, s) => ({ sleeves: 'long', neck: 0, hat: s % 2 ? 'straw' : '', hatColor: 0xc8a868, legs: 0x3a4458, beard: s % 6 === 0, trim: LACQUER }),
    woman: () => ({ apron: null, hairStyle: 'bun', trim: 0xa03028 }),
    soldier: (o) => ({ legs: 0x3a4458, trim: 0xa03028, skirt: 'long', metal: o.metal ?? 0x4a4048, ...(o.hat === 'hood' ? { hat: 'straw', hatColor: 0xc8a868 } : {}) }),
  },
  // Egyptians: bare to the waist in a linen kilt, barefoot, a headcloth in their colour.
  egypt: {
    man: (o, s, color) => ({ top: o.skin, sleeves: 'bare', neck: 2, skirtColor: LINEN, legs: o.skin, barefoot: true, hat: s % 2 ? 'cap' : '', hatColor: color, beard: false, trim: color }),
    woman: (_o, s, color) => ({ top: LINEN, skirtColor: LINEN, apron: null, trim: color, barefoot: true, hairStyle: 'long', hat: s % 2 ? 'circlet' : '', hatColor: color }),
    soldier: (o, _s, color) => ({ legs: o.skin, skirtColor: LINEN, beard: false, trim: color, ...(light(o) ? { top: o.skin, sleeves: 'bare', neck: 2, barefoot: true } : {}), ...(soft(o) && o.hat === '' ? { helmet: '', hat: 'cap', hatColor: color } : {}) }),
  },
  // Babylonians: long fringed robes and full beards.
  babylon: {
    man: (_o, s) => ({ skirt: 'long', sleeves: 'short', beard: s % 4 !== 0, hat: s % 2 ? 'cap' : '', hatColor: 0x7a4a3a, trim: GOLD }),
    woman: () => ({ apron: null, trim: GOLD, hairStyle: 'long' }),
    soldier: (o, s) => ({ skirt: 'long', beard: s % 4 !== 0, trim: GOLD, ...(o.helmet === 'leather' ? { helmet: '', hat: 'cap', hatColor: 0x7a4a3a } : {}) }),
  },
  // Persians: bright trousers, long sleeves, a soft pale cap.
  persia: {
    man: (_o, s) => ({ sleeves: 'long', legs: of([0x7a4a6a, 0x3a6a7a, 0xb08a3a], s), hat: s % 3 !== 1 ? 'cap' : '', hatColor: 0xd8c890, beard: s % 3 !== 0, trim: GOLD }),
    woman: (_o, s) => ({ apron: null, trim: GOLD, cloak: s % 3 === 0 ? 0x7a4a6a : null }),
    soldier: (o, s) => ({ sleeves: 'long', legs: of([0x7a4a6a, 0x3a6a7a, 0xb08a3a], s), trim: GOLD, beard: s % 3 !== 0, ...(soft(o) && o.hat === '' ? { helmet: '', hat: 'cap', hatColor: 0xd8c890 } : {}) }),
  },
  // Greeks: bare arms and legs, bronze on the soldiers.
  greece: {
    man: (o, s) => ({ sleeves: 'bare', neck: 1, legs: o.skin, hat: s % 4 === 0 ? 'straw' : '', hatColor: 0xc8a868, trim: LINEN }),
    woman: () => ({ apron: null, trim: LINEN, hairStyle: 'bun' }),
    soldier: (o) => ({ legs: o.skin, trim: LINEN, ...(light(o) ? { sleeves: 'bare' } : {}), ...(o.helmet === 'iron' ? { helmet: 'bronze', metal: BRONZE } : {}) }),
  },
  // English: hoods in green and russet, hose, the kettle hat.
  england: {
    man: (_o, s) => ({ sleeves: 'long', hat: s % 3 === 0 ? 'hood' : s % 3 === 1 ? 'cap' : '', hatColor: of([0x4a5a3a, 0x6a4a34], s), legs: of([0x4a5a3a, 0x6a5238, 0x7a3a30], s) }),
    woman: () => ({ apron: 0xb8c0a0, hairStyle: 'long' }),
    soldier: (o, s) => ({ legs: of([0x4a5a3a, 0x6a5238, 0x7a3a30], s), trim: LINEN, ...(o.helmet === 'iron' ? { helmet: 'kettle' } : {}) }),
  },
  // Abbasids: long robes and turbans.
  arabs: {
    man: (_o, s, color) => ({ skirt: 'long', sleeves: 'long', neck: 0, hat: s % 5 !== 0 ? 'turban' : 'cap', hatColor: of([0xf0ece0, 0xd8c8a0, color], s), beard: s % 2 === 0, legs: LINEN }),
    woman: () => ({ apron: null, trim: GOLD, legs: LINEN }),
    soldier: (o, s, color) => ({ skirt: 'long', sleeves: 'long', legs: LINEN, cloak: o.helmet === 'iron' ? color : o.cloak, ...(soft(o) && o.hat === '' ? { helmet: '', hat: 'turban', hatColor: of([0xf0ece0, 0xd8c8a0], s) } : {}) }),
  },
  // Japanese: indigo leggings, straw hats, lacquered armour in black or red.
  japan: {
    man: (_o, s) => ({ sleeves: 'short', neck: 1, legs: 0x2e3a5a, hat: s % 2 ? 'straw' : '', hatColor: 0xc8a868, beard: false, trim: LACQUER }),
    woman: () => ({ apron: null, hairStyle: 'bun', trim: LACQUER }),
    soldier: (o, s) => ({ legs: LACQUER, beard: false, trim: LACQUER, metal: o.metal ?? of([LACQUER, 0x7a2028], s), ...(o.helmet === 'iron' ? { helmet: 'kettle' } : o.helmet === 'leather' ? { helmet: '', hat: 'straw', hatColor: LACQUER } : {}) }),
  },
  // Arameans: long robes, a head-cloth or a hood, bearded men, a brown cloak.
  dawn: {
    man: (_o, s) => ({ skirt: 'long', sleeves: 'long', hat: s % 3 === 0 ? 'turban' : s % 3 === 1 ? 'hood' : '', hatColor: of([0xd8cdb8, 0x8a7a5a], s), beard: s % 3 !== 2, cloak: s % 4 === 0 ? 0x8a7a5a : null, trim: LINEN }),
    woman: (_o, s) => ({ apron: null, trim: LINEN, cloak: s % 2 ? 0x8a7a5a : null }),
    soldier: (o, s) => ({ skirt: 'long', beard: s % 3 !== 2, trim: LINEN, cloak: o.helmet === 'iron' ? 0x8a7a5a : o.cloak, ...(o.helmet === 'leather' ? { helmet: '', hat: 'hood', hatColor: 0xd8cdb8 } : {}) }),
  },
  // Norse: furs over the shoulders, beards, dark wool.
  wild: {
    man: (_o, s) => ({ sleeves: 'long', mantle: s % 3 === 0, hat: s % 4 === 1 ? 'fur' : '', hatColor: 0x5a4634, beard: s % 2 === 0, legs: 0x4a4238, cloak: s % 5 === 0 ? 0x4a5a4a : null }),
    woman: (_o, s) => ({ apron: 0x6a5a48, hairStyle: 'long', mantle: s % 3 === 0, trim: 0xc8b890 }),
    soldier: (o, s) => ({ mantle: !o.plate, beard: s % 3 !== 1, legs: 0x2a2420, ...(o.helmet === '' && o.hat === '' && s % 3 === 0 ? { hat: 'fur', hatColor: 0x5a4634 } : {}) }),
  },
};

/**
 * Dresses someone the way their nation does. A village woman's neckline, sleeves and head covering stay as her town
 * gave them; a rider keeps no skirt; a child wears the grown-ups' cloth without their hats, cloaks or furs.
 */
export function nationDress(civ: string, type: string, o: Outfit, color: number): Outfit {
  const d = DRESS[civ];
  if (!d) return o;
  const s = o.seed;
  if (type !== 'villager') {
    const cut = d.soldier(o, s, color);
    if (o.skirt === 'none') delete cut.skirt;
    if (o.female) cut.beard = false;
    return { ...o, ...cut };
  }
  const cut = o.female ? d.woman(o, s, color) : d.man(o, s, color);
  if (o.female) {
    delete cut.sleeves; delete cut.neck;
    if (o.hairStyle === 'covered') delete cut.hairStyle;
    if (o.apron == null && cut.apron != null) delete cut.apron;
    cut.beard = false;
  }
  if (o.child) return { ...o, ...cut, hat: '', beard: false, cloak: null, mantle: false, hairStyle: o.hairStyle, skirt: o.skirt };
  return { ...o, ...cut };
}
