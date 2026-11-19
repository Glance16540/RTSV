// A people's house of faith, by name and sign (docs/PLAYTEST.md, finding 9). The rules call it the church (SITES.church,
// the 'church' decree); a player sees it as their own people would call it: a Church where the faith keeps a cross, a
// Mosque under the crescent, a Shrine under rings, a Temple of the gods for Greece and Rome, and so on, each drawn as its
// own people build it (src/client/faithhouses.ts; the sign itself, src/client/shapes.ts).
// Plain data, no DOM.

/** What a people sets on a house of its faith: a cross, a crescent, an ankh, a star, a flame, a spire of rings, a laurel wreath; nothing where its faith keeps no such sign. */
export type Faith = 'cross' | 'crescent' | 'ankh' | 'star' | 'flame' | 'rings' | 'wreath' | '';
export const FAITH_SIGN: Record<string, Faith> = { hearth: 'cross', england: 'cross', stonekin: 'wreath', greece: 'wreath', arabs: 'crescent', mali: 'crescent', egypt: 'ankh', kush: 'ankh', babylon: 'star', dawn: 'star', persia: 'flame', japan: 'rings', forge: '' };
export const faithOf = (civ: string | undefined): Faith => FAITH_SIGN[civ ?? ''] ?? '';

/**
 * The house each people raises to its faith, in its own faith (folkfaith.ts): what it is called and how it is drawn
 * (src/client/faithhouses.ts). The rules know only the church (SITES.church, the 'temple' building); this is its look.
 */
export type HouseKind = 'church' | 'mosque' | 'sahel' | 'classical' | 'nile' | 'ziggurat' | 'firetemple' | 'shrine' | 'ancestral' | 'cairn' | 'hof' | 'tabernacle' | 'grove';
export const HOUSE_OF: Record<string, HouseKind> = {
  hearth: 'church', england: 'church', arabs: 'mosque', mali: 'sahel', greece: 'classical', stonekin: 'classical', egypt: 'nile', kush: 'nile',
  babylon: 'ziggurat', persia: 'firetemple', japan: 'shrine', forge: 'ancestral', steppe: 'cairn', wild: 'hof', dawn: 'tabernacle',
};
export const houseKind = (civ: string | undefined): HouseKind => HOUSE_OF[civ ?? ''] ?? 'grove';

/** Each house: its name, the word for it in a sentence, and its icon. */
export const HOUSES: Record<HouseKind, { name: string; word: string; icon: string }> = {
  church: { name: 'Church', word: 'church', icon: '⛪' },
  mosque: { name: 'Mosque', word: 'mosque', icon: '🕌' },
  sahel: { name: 'Mosque', word: 'mosque', icon: '🕌' },
  classical: { name: 'Temple', word: 'temple', icon: '🏛️' },
  nile: { name: 'Temple', word: 'temple', icon: '🏛️' },
  ziggurat: { name: 'Ziggurat Shrine', word: 'shrine', icon: '🛕' },
  firetemple: { name: 'Fire Temple', word: 'fire temple', icon: '🔥' },
  shrine: { name: 'Shrine', word: 'shrine', icon: '⛩️' },
  ancestral: { name: 'Ancestral Hall', word: 'ancestral hall', icon: '🏯' },
  cairn: { name: 'Sacred Cairn', word: 'sacred cairn', icon: '🪨' },
  hof: { name: 'Hof', word: 'hof', icon: '🛖' },
  tabernacle: { name: 'Temple', word: 'temple', icon: '🕍' },
  grove: { name: 'Sacred Grove', word: 'sacred grove', icon: '🌳' },
};
export const houseOfFaith = (civ: string | undefined): { name: string; word: string; icon: string } => HOUSES[houseKind(civ)];

/** A site's name and icon as the people building it would call it: only the church changes. */
export const siteLook = (site: string, s: { name: string; icon: string }, civ: string | undefined): { name: string; icon: string } =>
  site === 'church' ? { name: houseOfFaith(civ).name, icon: houseOfFaith(civ).icon } : { name: s.name, icon: s.icon };

/** A building's name and icon on the field as its owner's people call it: only the church ('temple') changes. */
export const buildingLook = (type: string, d: { name: string; icon: string }, civ: string | undefined): { name: string; icon: string } =>
  type === 'temple' ? { name: houseOfFaith(civ).name, icon: houseOfFaith(civ).icon } : { name: d.name, icon: d.icon };

/** Words about the church put in the people's own: "Call them to church" becomes "Call them to the shrine". */
export function inFaith(text: string, civ: string | undefined): string {
  const h = houseOfFaith(civ);
  if (h.word === 'church') return text;
  return text.replace(/\bto church\b/g, `to the ${h.word}`).replace(/\bThe church\b/g, `The ${h.word}`).replace(/\bthe church\b/g, `the ${h.word}`).replace(/\bChurch\b/g, h.name).replace(/\bchurch\b/g, h.word);
}
