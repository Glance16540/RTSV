// Your people's name and your house's (the owner's word, 15 November 2026: "you choose Japanese but you make up your
// own dynasty name"). The people you choose still decides dress, units and leaders; only the names are yours.
//
//   people  what your nation is called wherever the game names it: "You lead the Ashfolk", the chronicle, the map.
//           Blank: the people's own name, as before.
//   house   your ruling house or dynasty: the leader and the heirs born to them are of it, and the chronicle says so.
//           Blank: no name, and the house is the leader's, as before. A house that is set aside or ended (a captain
//           raised on the shields, a stranger hired) takes its name with it: the new leader's house has none.
//
// Plain data on the faction, kept in the save, made safe and capped when given. Rivals keep their written names.
import type { Campaign } from './campaign';
import { CIVS } from './data';

/** The names a player gives. */
export interface Names { people?: string; house?: string }
declare module './campaign' {
  interface Faction {
    /** The name the player gave their people (naming.ts). */
    people?: string;
    /** The name the player gave their ruling house, while it rules (naming.ts). */
    dynasty?: string;
  }
}

/** The longest a name may be. */
export const MAX_NAME = 32;

/** A name made safe: letters, numbers, spaces and a little punctuation, trimmed and capped. Empty if nothing is left. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[^\p{L}\p{N} '\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

/** Give a people and its house their names. Blank leaves the default. */
export function nameNation(c: Campaign, f: number, names: Names = {}): void {
  const fac = c.factions[f];
  if (!fac) return;
  const people = cleanName(names.people), house = cleanName(names.house);
  if (people) fac.people = people; else delete fac.people;
  if (house) fac.dynasty = house; else delete fac.dynasty;
}

/** What a people is called: the name its player gave it, or its own. */
export const peopleName = (c: Campaign, f: number): string => (c.factions[f]?.people || CIVS[c.factions[f]?.civ]?.name || 'people');
/** The name of a people's ruling house, if it has one. */
export const houseName = (c: Campaign, f: number): string | undefined => c.factions[f]?.dynasty || undefined;
/** "the House of X" or, with no name, "<leader>'s house". */
export const houseTitle = (c: Campaign, f: number, leader: string): string => (houseName(c, f) ? `the House of ${houseName(c, f)}` : `${leader}'s house`);
/** An heir's name with their house: "Kell of the House of X". */
export const ofHouse = (c: Campaign, f: number, name: string): string => (houseName(c, f) ? `${name} of the House of ${houseName(c, f)}` : name);
/** The house is set aside or ended: its name goes with it. */
export const endHouse = (c: Campaign, f: number): void => { if (c.factions[f]) delete c.factions[f].dynasty; };
