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
import { LEADERS } from './leaders';

/** The names a player gives. */
export interface Names { people?: string; house?: string }
declare module './campaign' {
  interface Faction {
    /** The name the player gave their people (naming.ts). */
    people?: string;
    /** The name the player gave their ruling house, while it rules (naming.ts). */
    dynasty?: string;
    /** A new house founded and not yet named: the name offered (naming.ts). */
    newHouse?: string;
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
/**
 * A people's name set before a thing of theirs: "the Arameans'" (a name in -s, as most are), "the English" (a name
 * that is its own adjective: English, Chinese, Japanese, Norse), "the Ashfolk's" (any other, a chosen name mostly).
 * Followed by the thing: `${possessive('Arameans')} army` is "the Arameans' army".
 */
export function possessive(name: string): string {
  if (/(ese|ish|sh|ch|se)$/i.test(name)) return `the ${name}`;
  return /s$/i.test(name) ? `the ${name}'` : `the ${name}'s`;
}
/** Whose, of a people: "your" for the player, and for another people its possessive ("the Arameans'"). */
export const whoseOf = (c: Campaign, f: number): string => (f === 0 ? 'your' : possessive(peopleName(c, f)));
/** A people's army, in the middle of a sentence: "your army", "the Arameans' army", "the English army". */
export const peoplesArmy = (c: Campaign, f: number): string => `${whoseOf(c, f)} army`;
/** The name of a people's ruling house, if it has one. */
export const houseName = (c: Campaign, f: number): string | undefined => c.factions[f]?.dynasty || undefined;
/** "the House of X" or, with no name, "<leader>'s house". */
export const houseTitle = (c: Campaign, f: number, leader: string): string => (houseName(c, f) ? `the House of ${houseName(c, f)}` : `${leader}'s house`);
/** An heir's name with their house: "Kell of the House of X". */
export const ofHouse = (c: Campaign, f: number, name: string): string => (houseName(c, f) ? `${name} of the House of ${houseName(c, f)}` : name);
/**
 * The house is set aside or ended: its name goes with it, and the leader who follows founds a new one. The player is
 * offered a name for it, taken from the new leader's own (a captain's name without the rank, a stranger's without
 * "the Hired"); a rival's new house has none.
 */
export function endHouse(c: Campaign, f: number): void {
  const fac = c.factions[f];
  if (!fac) return;
  delete fac.dynasty;
  if (fac.isAI) { delete fac.newHouse; return; }
  const offered = cleanName((fac.hero?.name ?? '').replace(/^(Captain|Sergeant|Lord|Lady)\s+/i, '').replace(/\s+the\s+Hired$/i, '').split(/[\s,]+/)[0]);
  fac.newHouse = offered || 'New';
}
/** The name offered for a new house of the player's, while it waits to be named. */
export const houseToName = (c: Campaign, f: number): string | undefined => c.factions[f]?.newHouse;
/** Name the new house (blank: it goes unnamed). Returns the name given, or '' for none. */
export function foundHouse(c: Campaign, f: number, name: unknown): string {
  const fac = c.factions[f];
  if (!fac || fac.newHouse === undefined) return '';
  delete fac.newHouse;
  const given = cleanName(name);
  if (given) {
    fac.dynasty = given;
    (c.chronicle ??= []).push({ turn: c.turn, text: `A new house rules the ${peopleName(c, f)}: the House of ${given}.` });
  }
  return given;
}
/** What a side in a battle is called where the player reads it: its people's name. */
export const sideName = (c: Campaign, f: number): string => peopleName(c, f);
/**
 * A line the player's own leader speaks, as it is shown: where it names their people's land or people by its written
 * name, the name the player gave them stands in its place. (The recording, if there is one, says what it says.)
 */
export const ownLine = (c: Campaign, text: string): string => renameOwn(text, c.factions[0]?.civ ?? '', c.factions[0]?.people);
/** A line of a people's own leader with the written names of that people and their land put as `given`. */
export function renameOwn(text: string, civ: string, given?: string): string {
  if (!given || !text) return text;
  let out = text;
  for (const w of ownWords(civ).sort((a, b) => b.length - a.length)) out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), given);
  return out;
}
/** The written names of a people and its land: "Kushites", and "Kush" from "Kandake of Kush". */
export function ownWords(civ: string): string[] {
  const L = LEADERS[civ], words = new Set<string>([CIVS[civ]?.name ?? '']);
  for (const title of [L?.title, L?.alt?.title]) { const m = /\bof ([A-Z][\w'-]+)/.exec(title ?? ''); if (m) words.add(m[1]); }
  return [...words].filter(Boolean);
}
