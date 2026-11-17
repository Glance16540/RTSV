// Several campaigns (docs/DESIGN.md, "Relationships": a player can keep more than one world, each with its own
// history, and go back to any of them). Each world is kept in a slot of the browser's storage. The first slot is
// the key every campaign has always been saved under (`rtsv-campaign`), so no saved game is lost; the others sit
// beside it (`rtsv-campaign-2` and on). Which world is being played is kept too, and everything that reads or
// writes "the campaign" (the map, a battle, a visit) goes to that one.
//
// Plain data: this works on anything shaped like the browser's storage, so it is tested headless.
import type { Campaign } from './campaign';
import { CAMPAIGN_VERSION } from './campaignbase';
import { peopleName, houseName } from './naming';
import { rollOld } from './armytown';

/** What a slot is kept in: the browser's localStorage, or anything that behaves like it. */
export interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** The key every campaign was saved under before there were slots: it is slot 1, and keeps its name. */
export const FIRST_KEY = 'rtsv-campaign';
/** Which slot is being played. */
export const ACTIVE_KEY = 'rtsv-campaign-active';
/** How many worlds can be kept. */
export const MAX_SLOTS = 6;

declare module './campaign' {
  interface Campaign { /** When this world was last played, in milliseconds since 1970 (slots.ts). */ played?: number }
}

/** The storage key of slot `n` (1 to MAX_SLOTS). */
export const slotKey = (n: number): string => (n <= 1 ? FIRST_KEY : `${FIRST_KEY}-${n}`);

/** What the campaign menu shows of a world. */
export interface SlotInfo {
  slot: number;
  /** The player's people as they are called, and their ruling house if it has a name. */
  people: string; house?: string;
  civ: string;
  turn: number;
  /** When it was last played (0 if never stamped: a campaign saved before there were slots). */
  played: number;
  /** The campaign is over: won or lost. */
  over: boolean; won: boolean;
  /** Something is kept here that this version of the game cannot load: it can only be deleted. */
  stale?: boolean;
}

const get = (s: Store, key: string): string | null => { try { return s.getItem(key); } catch { return null; } };
const set = (s: Store, key: string, value: string): boolean => { try { s.setItem(key, value); return true; } catch { return false; } };

/** The world kept in slot `n`, if there is one this version of the game can load. */
export function readSlot(s: Store, n: number): Campaign | null {
  try {
    const c = JSON.parse(get(s, slotKey(n)) ?? 'null') as Campaign | null;
    if (!c || typeof c !== 'object' || c.v !== CAMPAIGN_VERSION) return null;
    rollOld(c); // an army in a world kept before armies had rolls is given one (armytown.ts)
    return c;
  } catch {
    return null;
  }
}
/** Keep a world in slot `n`, stamped with when it was played. Returns whether it could be kept. */
export function writeSlot(s: Store, n: number, c: Campaign, now = Date.now()): boolean {
  c.played = now;
  return set(s, slotKey(n), JSON.stringify(c));
}
/** What the menu shows of a world. */
export function infoOf(c: Campaign, n: number): SlotInfo {
  const house = houseName(c, 0);
  return {
    slot: n, people: peopleName(c, 0), ...(house ? { house } : {}), civ: c.factions[0]?.civ ?? '',
    turn: c.turn, played: c.played ?? 0, over: c.phase === 'over', won: c.phase === 'over' && c.winner === 0,
  };
}
/** Every world kept, the most lately played first. */
export function listSlots(s: Store): SlotInfo[] {
  const out: SlotInfo[] = [];
  for (let n = 1; n <= MAX_SLOTS; n++) {
    const c = readSlot(s, n);
    if (c) out.push(infoOf(c, n));
    else if (get(s, slotKey(n)) !== null) out.push({ slot: n, people: 'A world from an older version of the game', civ: '', turn: 0, played: 0, over: false, won: false, stale: true });
  }
  return out.sort((a, b) => b.played - a.played || a.slot - b.slot);
}
/** The slot being played: as kept, or slot 1. */
export function activeSlot(s: Store): number {
  const n = Number(get(s, ACTIVE_KEY));
  return Number.isInteger(n) && n >= 1 && n <= MAX_SLOTS ? n : 1;
}
/** Play the world in slot `n` from now on. */
export const setActive = (s: Store, n: number): void => { set(s, ACTIVE_KEY, String(Math.max(1, Math.min(MAX_SLOTS, Math.round(n))))); };
/** The first slot with no world in it, or null when every slot is taken. */
export function freeSlot(s: Store): number | null {
  for (let n = 1; n <= MAX_SLOTS; n++) if (get(s, slotKey(n)) === null) return n;
  return null;
}
/**
 * Make ready to begin a new world without losing any other: the first free slot becomes the one played.
 * Returns that slot, or null when every slot is taken (one must be deleted first).
 */
export function beginNew(s: Store): number | null {
  const n = freeSlot(s);
  if (n !== null) setActive(s, n);
  return n;
}
/** Delete the world in slot `n`. If it was the one being played, the most lately played of the rest is played instead. */
export function deleteSlot(s: Store, n: number): void {
  try { s.removeItem(slotKey(n)); } catch { /* storage unavailable */ }
  if (activeSlot(s) === n) setActive(s, listSlots(s)[0]?.slot ?? 1);
}
