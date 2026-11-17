// A people's house of faith, by name and sign (docs/PLAYTEST.md, finding 9). The rules call it the church (SITES.church,
// the 'church' decree); a player sees it as their own people would call it: a Church where the faith keeps a cross, a
// Mosque under the crescent, a Shrine under rings, and so on. The 3D models read the same sign (src/client/shapes.ts).
// Plain data, no DOM.

/** What a people sets on a house of its faith: a cross, a crescent, an ankh, a star, a flame, a spire of rings; nothing where its faith keeps no such sign. */
export type Faith = 'cross' | 'crescent' | 'ankh' | 'star' | 'flame' | 'rings' | '';
export const FAITH_SIGN: Record<string, Faith> = { hearth: 'cross', england: 'cross', stonekin: 'cross', greece: 'cross', arabs: 'crescent', mali: 'crescent', egypt: 'ankh', kush: 'ankh', babylon: 'star', dawn: 'star', persia: 'flame', japan: 'rings', forge: 'rings' };
export const faithOf = (civ: string | undefined): Faith => FAITH_SIGN[civ ?? ''] ?? '';

/** The house of each faith: its name, the word for it in a sentence, and its icon. */
export const FAITH_HOUSE: Record<Faith, { name: string; word: string; icon: string }> = {
  cross: { name: 'Church', word: 'church', icon: '⛪' },
  crescent: { name: 'Mosque', word: 'mosque', icon: '🕌' },
  ankh: { name: 'Temple', word: 'temple', icon: '🏛️' },
  star: { name: 'Temple', word: 'temple', icon: '🏛️' },
  flame: { name: 'Fire Temple', word: 'fire temple', icon: '🔥' },
  rings: { name: 'Shrine', word: 'shrine', icon: '⛩️' },
  '': { name: 'Sacred Grove', word: 'sacred grove', icon: '🌳' },
};
export const houseOfFaith = (civ: string | undefined): { name: string; word: string; icon: string } => FAITH_HOUSE[faithOf(civ)];

/** A site's name and icon as the people building it would call it: only the church changes. */
export const siteLook = (site: string, s: { name: string; icon: string }, civ: string | undefined): { name: string; icon: string } =>
  site === 'church' ? { name: houseOfFaith(civ).name, icon: houseOfFaith(civ).icon } : { name: s.name, icon: s.icon };

/** Words about the church put in the people's own: "Call them to church" becomes "Call them to the shrine". */
export function inFaith(text: string, civ: string | undefined): string {
  const h = houseOfFaith(civ);
  if (h.word === 'church') return text;
  return text.replace(/\bto church\b/g, `to the ${h.word}`).replace(/\bThe church\b/g, `The ${h.word}`).replace(/\bthe church\b/g, `the ${h.word}`).replace(/\bChurch\b/g, h.name).replace(/\bchurch\b/g, h.word);
}
