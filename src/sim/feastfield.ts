// A feast day kept in a town (docs/CLOSING.md, "Feast Days and Pilgrimage": "Feast Days is only a nation's study on the
// map: a Church in a town keeps no feast day").
//
// On the map, Feast Days lifts the nation's towns toward the holy way once a year (feastdays.ts). Here, in the town:
//   - a town of the player's with a Church (on the map, or standing in the town as last left) keeps its feast day once a year: the first visit or battle fought there in a
//     year (a battle only where the player holds the town and it is fought for, not a field battle) opens on its feast;
//   - for FEAST_FIELD.span seconds (cut short if the town's Church is pulled down or burned), the feast holds the town's drift back: no one leaves
//     their work for the tavern or the gold, however strained, and care brings the drifted back the more readily
//     (`feastHolds`, `feastCare`, read by driftintown.ts);
//   - the town is told as it begins and as it ends, and the hall's and the church's panels say it is a feast day;
//   - once the visit or battle is over, the feast is kept for that year (`keepFeast`): the next in the same year has none.
// It needs no study: the Church keeps it. Plain data in, plain data out; nothing drawn by chance.
import type { Campaign } from './campaign';
import type { Game, Player } from './game';
import { yearOf } from './chroniclethreads';

export const FEAST_FIELD = {
  /** Seconds the feast lasts, from the start of the visit or battle. */
  span: 120,
  /** How much more readily care brings the drifted back while it lasts. */
  care: 2,
  /** Care the feast itself gives the town while it lasts (0 to 1), even with no other comfort. */
  lift: 0.4,
};

/** What the field is told of the feast: whose it is. */
export interface FeastIn { town: string }

declare module './campaign' {
  interface Territory { /** The turn its feast day was last kept, in a visit or a battle (feastfield.ts). */ feastKept?: number }
}
declare module './game' {
  interface Player { /** This side's town is keeping its feast day (feastfield.ts): whether a Church stood as it began. */ feast?: { town: string; until: number; church?: boolean; told?: 0 | 1 | 2 } }
}

/** Is the feast day due in this town: the player's, with a Church on the map or a finished one in the town, and not yet kept this year? */
export function feastDue(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || !(t.buildings.includes('church') || (t.town?.b ?? []).some((x) => x[0] === 'temple' && x[4] === undefined))) return false;
  return t.feastKept === undefined || yearOf(t.feastKept) !== yearOf(c.turn);
}

/** The feast for the field's setup, when one is due. */
export function feastFor(c: Campaign, tid: number): FeastIn | undefined {
  return feastDue(c, tid) ? { town: c.territories[tid].name } : undefined;
}

/** The visit or battle is over: a feast that was due is kept for the year. */
export function keepFeast(c: Campaign, tid: number): void {
  if (feastDue(c, tid)) c.territories[tid].feastKept = c.turn;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40) : '');

const church = (g: Game, owner: number): boolean => g.buildings.some((b) => b.owner === owner && b.type === 'temple' && b.complete && !b.dead);

/** The field begins on the town's feast day. */
export function holdFeast(g: Game, owner: number, raw: unknown): void {
  const p = g.players[owner];
  if (!p || !raw || typeof raw !== 'object') return;
  p.feast = { town: clean((raw as FeastIn).town) || 'the town', until: g.time + FEAST_FIELD.span, church: church(g, owner) };
}

/** Is the feast being kept now: within its span, and the Church that stood as it began not lost? */
export function feasting(g: Game, p: Player): boolean {
  return !!p.feast && g.time < p.feast.until && (!p.feast.church || church(g, p.id));
}

/** Seconds left of the feast, or 0. */
export const feastLeft = (g: Game, p: Player): number => (feasting(g, p) ? Math.ceil(p.feast!.until - g.time) : 0);

/**
 * Each second, from driftintown.ts: tells the town as the feast begins and ends. Returns whether it holds the
 * town's drift back this second.
 */
export function feastHolds(g: Game, p: Player): boolean {
  const f = p.feast;
  if (!f) return false;
  const on = feasting(g, p);
  if (on && !f.told) { f.told = 1; g.events.push({ t: 'msg', player: p.id, text: `🕯️ It is the feast day of ${f.town}. The church keeps it, and no one leaves their work while it lasts.` }); }
  if (!on && f.told === 1) { f.told = 2; g.events.push({ t: 'msg', player: p.id, text: `🕯️ The feast day of ${f.town} is over.` }); }
  return on;
}

/** Care in the town while the feast lasts: at least FEAST_FIELD.lift. */
export const feastLift = (g: Game, p: Player, care: number): number => (feasting(g, p) ? Math.max(care, FEAST_FIELD.lift) : care);
/** How much more readily care brings the drifted back: FEAST_FIELD.care while the feast lasts. */
export const feastPull = (g: Game, p: Player): number => (feasting(g, p) ? FEAST_FIELD.care : 1);

/** The words for a hall's or a church's panel while the feast lasts, or ''. */
export function feastWords(g: Game, owner: number): string {
  const p = g.players[owner];
  if (!p || !feasting(g, p)) return '';
  const s = feastLeft(g, p);
  return `It is the feast day of ${p.feast!.town}: no one leaves their work while it lasts, and the drifted come home the sooner (${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left).`;
}
