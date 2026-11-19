// A face of one's own (docs/systems-board, "The leader's household": faces of people who were not notable were generic
// ones of their people). Every grown person shown on the roll and in the panels is given a face drawn from who they
// are, so that two men of one town do not look alike, and the same man looks the same in every battle and every save.
//
// This module only chooses: it returns a plain description (colours as hex, shapes by name), and src/client/facedraw.ts
// draws it. The choice is seeded by the person (portrait.ts seedOf: their name and family where they have one, which a
// person keeps when they are carried off, freed or brought into the next battle; otherwise their id), and varies within
// their people's look:
//   - colouring: skin, hair and the cloth they wear from their people's ranges; grey or white hair when old;
//   - hair and beard: the styles their people wear, a man's beard as often as their men keep one;
//   - lines: none or a few for the grown, more for the old and for mothers who have raised children;
//   - shape: a broad or full body gives a rounder face, a lean or slender one a narrower (portrait.ts bodyOf);
//   - headgear by station: a helmet of their people for one under arms; for the leader's kin and court, most often a
//     fillet or circlet, else what their people wear; bare-headed when held captive; and otherwise what their common
//     folk wear, or nothing;
//   - feeling: the brows and mouth show the feeling the portrait already reads (content, afraid, grief, angry).
// Children are never shown (DESIGN.md): there is no face for a child, and nothing here describes one.
import type { Body, Feeling, Sex } from './portrait';

export type HairStyle = 'short' | 'cropped' | 'long' | 'braids' | 'bun' | 'topknot' | 'curls' | 'receding' | 'bald';
export type Beard = 'none' | 'stubble' | 'moustache' | 'short' | 'full' | 'long';
export type Headgear = 'none' | 'cap' | 'hood' | 'fur' | 'veil' | 'scarf' | 'turban' | 'wrap' | 'headcloth' | 'fillet' | 'circlet'
  | 'helm_nasal' | 'helm_crest' | 'helm_cone' | 'helm_round' | 'helm_kabuto' | 'helm_cap';
/** Who a person is, as far as what they wear on their head goes. */
export type Station = 'common' | 'kin' | 'soldier' | 'captive';

/** A face, described. Colours are hex strings; the rest are names the drawing knows. */
export interface Face {
  sex: Sex; old: boolean; feeling: Feeling;
  skin: string; hair: string; garb: string; trim: string;
  hairStyle: HairStyle; beard: Beard; headgear: Headgear;
  jaw: 'round' | 'square' | 'narrow'; eyes: 'round' | 'almond'; nose: 'small' | 'long' | 'broad'; brows: 'thin' | 'thick';
  /** Lines of age and care, 0 to 3. */
  lines: number;
  /** Cheeks a little flushed. */
  ruddy: boolean;
}

/** A people's look: the ranges a face of theirs is drawn from. */
interface Look {
  skin: string[]; hair: string[]; garb: string[];
  /** How many of their men keep a beard, and which. */
  beard: number; beards: Beard[];
  men: HairStyle[]; women: HairStyle[];
  /** What their common folk wear on their heads, with 'none' for as many as go bare. */
  menHats: Headgear[]; womenHats: Headgear[];
  helm: Headgear; eyes: 'round' | 'almond';
}

const PALE = ['#f3d9c1', '#eecfb2', '#e8c3a0', '#f6e1cc'];
const OLIVE = ['#e2b78f', '#d8a87e', '#cd9a6e', '#e6c09b'];
const TAN = ['#cf9b6c', '#c28c5e', '#b67e52', '#d6a679'];
const BROWN = ['#ad7448', '#9c663d', '#b98154', '#8f5a35'];
const DARK = ['#6e4327', '#5e381f', '#7c4e2f', '#4f2e19'];
const EAST = ['#efcba1', '#e7bf93', '#ddb286', '#f2d4b0'];
const DARKHAIR = ['#2b2018', '#33241a', '#1f1a16', '#3d2a1c'];
const BLACK = ['#1c1714', '#241c17', '#141110'];

const LOOKS: Record<string, Look> = {
  wild: { skin: PALE, hair: ['#d8b25a', '#c49a45', '#a9542c', '#8a5b33', '#e3c77e'], garb: ['#6d5a43', '#4f6a7a', '#7a4a33'], beard: 0.85, beards: ['full', 'long', 'short'], men: ['long', 'braids', 'short'], women: ['braids', 'long'], menHats: ['none', 'none', 'fur'], womenHats: ['none', 'scarf'], helm: 'helm_nasal', eyes: 'round' },
  england: { skin: PALE, hair: ['#7b5233', '#5b3d26', '#b7863f', '#9c4a27', '#3a2a1f'], garb: ['#4f6b45', '#7b3b2f', '#5a5f72'], beard: 0.45, beards: ['short', 'full', 'moustache'], men: ['short', 'cropped', 'long'], women: ['long', 'bun'], menHats: ['none', 'hood', 'cap'], womenHats: ['veil', 'scarf', 'none'], helm: 'helm_round', eyes: 'round' },
  hearth: { skin: PALE, hair: ['#6e4a2e', '#8a5f37', '#b38443', '#4a3322', '#9b4c29'], garb: ['#5b6e8a', '#8a5a2b', '#6d7a4a'], beard: 0.55, beards: ['moustache', 'short', 'full'], men: ['long', 'short', 'cropped'], women: ['long', 'braids', 'bun'], menHats: ['none', 'none', 'cap'], womenHats: ['veil', 'none', 'scarf'], helm: 'helm_nasal', eyes: 'round' },
  stonekin: { skin: OLIVE, hair: DARKHAIR, garb: ['#a33a2c', '#d9cdb0', '#7a5a3a'], beard: 0.2, beards: ['stubble', 'short'], men: ['cropped', 'short', 'curls'], women: ['bun', 'curls'], menHats: ['none'], womenHats: ['none', 'veil'], helm: 'helm_crest', eyes: 'round' },
  greece: { skin: OLIVE, hair: DARKHAIR, garb: ['#e3d8bd', '#3f5f8a', '#a8572e'], beard: 0.7, beards: ['full', 'short', 'long'], men: ['curls', 'short'], women: ['bun', 'curls', 'long'], menHats: ['none'], womenHats: ['fillet', 'none', 'veil'], helm: 'helm_crest', eyes: 'round' },
  dawn: { skin: TAN, hair: BLACK, garb: ['#c9b68e', '#7a4d2e', '#e1d4b6'], beard: 0.8, beards: ['full', 'long'], men: ['long', 'curls'], women: ['long', 'braids'], menHats: ['headcloth', 'none'], womenHats: ['veil', 'veil', 'scarf'], helm: 'helm_cone', eyes: 'almond' },
  babylon: { skin: TAN, hair: BLACK, garb: ['#2f4f7a', '#b58a3a', '#7a2f2f'], beard: 0.9, beards: ['long', 'full'], men: ['curls', 'long'], women: ['curls', 'long', 'bun'], menHats: ['fillet', 'cap', 'none'], womenHats: ['fillet', 'veil', 'none'], helm: 'helm_cone', eyes: 'almond' },
  persia: { skin: TAN, hair: BLACK, garb: ['#6a3a7a', '#b8892f', '#2f6a5a'], beard: 0.85, beards: ['full', 'long', 'short'], men: ['curls', 'short'], women: ['long', 'braids'], menHats: ['cap', 'headcloth', 'none'], womenHats: ['veil', 'scarf'], helm: 'helm_cone', eyes: 'almond' },
  arabs: { skin: TAN, hair: BLACK, garb: ['#e6dcc4', '#2f5a3a', '#8a6a3a'], beard: 0.8, beards: ['full', 'short'], men: ['short', 'curls'], women: ['long', 'braids'], menHats: ['turban', 'turban', 'headcloth'], womenHats: ['veil', 'scarf'], helm: 'helm_cone', eyes: 'almond' },
  egypt: { skin: BROWN, hair: BLACK, garb: ['#efe7d2', '#d9c99c', '#3a6a7a'], beard: 0.25, beards: ['stubble', 'stubble', 'moustache'], men: ['cropped', 'bald', 'short', 'long'], women: ['long', 'braids', 'bun'], menHats: ['none', 'headcloth', 'fillet', 'none'], womenHats: ['fillet', 'none', 'wrap', 'veil'], helm: 'helm_cap', eyes: 'almond' },
  steppe: { skin: EAST, hair: BLACK, garb: ['#3f6a8a', '#8a3a2a', '#6a5a3a'], beard: 0.4, beards: ['moustache', 'stubble', 'short'], men: ['braids', 'topknot'], women: ['braids', 'braids', 'long'], menHats: ['fur', 'fur', 'none'], womenHats: ['fur', 'none'], helm: 'helm_cone', eyes: 'almond' },
  forge: { skin: EAST, hair: BLACK, garb: ['#2f4f6a', '#8a2f2f', '#5a6a3a'], beard: 0.3, beards: ['moustache', 'stubble', 'long'], men: ['topknot', 'bun'], women: ['bun', 'long'], menHats: ['cap', 'none'], womenHats: ['none', 'fillet'], helm: 'helm_round', eyes: 'almond' },
  japan: { skin: EAST, hair: BLACK, garb: ['#3a4a6a', '#6a2f2f', '#4a5a3a'], beard: 0.2, beards: ['stubble', 'moustache'], men: ['topknot', 'topknot', 'short'], women: ['bun', 'long'], menHats: ['none', 'cap'], womenHats: ['none'], helm: 'helm_kabuto', eyes: 'almond' },
  mali: { skin: DARK, hair: BLACK, garb: ['#e6d9b8', '#3a5a8a', '#b8692f'], beard: 0.4, beards: ['short', 'stubble'], men: ['cropped', 'short'], women: ['braids', 'braids'], menHats: ['turban', 'wrap', 'none'], womenHats: ['wrap', 'wrap', 'none'], helm: 'helm_round', eyes: 'round' },
  kush: { skin: DARK, hair: BLACK, garb: ['#d9c49a', '#8a3a2a', '#efe4cc'], beard: 0.3, beards: ['short', 'stubble'], men: ['cropped', 'bald', 'curls'], women: ['braids', 'cropped'], menHats: ['none', 'fillet'], womenHats: ['none', 'wrap'], helm: 'helm_cap', eyes: 'round' },
};
/** A people the faces know nothing of (marauders, anyone of no people): a mix of everyone. */
const ANY: Look = { ...LOOKS.england, skin: [...PALE, ...TAN, ...BROWN], hair: [...DARKHAIR, '#7b5233'], menHats: ['none', 'hood'], womenHats: ['scarf', 'none'], helm: 'helm_round' };

const GREY = ['#9a948c', '#b5afa6', '#d8d4cc', '#8a857e'];
/** Cloth any people may wear, beside their own colours. */
const CLOTH = ['#6a4a2a', '#4a5a6a', '#7a6a3a', '#5a3a4a', '#3a5a4a', '#8a7a5a'];

/** A steady number in [0, 1) for a person and a feature. */
function roll(seed: number | string, salt: string): number {
  let h = 0x811c9dc5;
  const s = `${seed}#${salt}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const pick = <T>(seed: number | string, salt: string, from: readonly T[]): T => from[Math.floor(roll(seed, salt) * from.length)];

/** The station a notable's kind gives (portrait.ts notablePortrait): kin of the leader, a soldier, or common folk. */
export function stationOf(kind: string | undefined): Station {
  return kind === 'veteran' || kind === 'soldier' ? 'soldier' : kind === 'kin' || kind === 'leader' ? 'kin' : kind === 'captive' ? 'captive' : 'common';
}

/** What a face is drawn from. Leave out what is not known. */
export interface Who {
  seed: number | string; sex: Sex; nation: string; feeling: Feeling;
  body?: Body; old?: boolean; station?: Station;
  /** A woman who has raised children: a line or two more. */
  mother?: boolean;
  /** A child: never given a face. */
  child?: boolean;
}

/** A grown person's face, or null for a child, who is never shown. */
export function faceOf(w: Who): Face | null {
  if (w.child) return null;
  const L = LOOKS[w.nation] ?? ANY, s = w.seed, man = w.sex === 'm', station = w.station ?? 'common', old = !!w.old;
  const broad = w.body === 'man_broad' || w.body === 'woman_full', lean = w.body === 'man_lean' || w.body === 'woman_slender';
  // Hair: their people's styles; an old man may have lost some or all of it.
  let hairStyle = pick(s, 'style', man ? L.men : L.women);
  if (man && old && roll(s, 'thin') < 0.5) hairStyle = roll(s, 'bald') < 0.4 ? 'bald' : 'receding';
  const beard: Beard = man && roll(s, 'beard?') < L.beard ? pick(s, 'beard', L.beards) : 'none';
  const headgear: Headgear = station === 'soldier' ? L.helm : station === 'captive' ? 'none' : station === 'kin' ? pick(s, 'kinhat', man ? ['fillet', 'fillet', ...L.menHats] : ['circlet', 'fillet', 'circlet', ...L.womenHats]) : pick(s, 'hat', man ? L.menHats : L.womenHats);
  const lines = Math.min(3, (old ? 2 : 0) + (w.mother ? 1 : 0) + (roll(s, 'lines') < 0.3 ? 1 : 0));
  return {
    sex: w.sex, old, feeling: w.feeling,
    skin: pick(s, 'skin', L.skin), hair: old ? pick(s, 'grey', GREY) : pick(s, 'hair', L.hair),
    garb: pick(s, 'garb', roll(s, 'own cloth') < 0.6 ? L.garb : CLOTH), trim: station === 'kin' ? '#c9a23a' : pick(s, 'trim', ['#3a2a1c', '#7a5a2a', '#5a3a2a']),
    hairStyle, beard, headgear,
    // A man's jaw is squarer than a woman's, so that he reads as a man even beardless and long-haired, and small.
    jaw: man ? (lean ? pick(s, 'jaw', ['square', 'narrow'] as const) : 'square') : broad ? 'round' : lean ? 'narrow' : pick(s, 'jaw', ['round', 'narrow'] as const),
    eyes: L.eyes, nose: pick(s, 'nose', ['small', 'long', 'broad'] as const), brows: man ? pick(s, 'brows', ['thin', 'thick', 'thick'] as const) : 'thin',
    lines, ruddy: roll(s, 'ruddy') < 0.35,
  };
}
