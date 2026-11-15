// The weight of notable people (docs/DESIGN.md, "Notable people"): what makes a home known besides the children it
// raised, whose town a veteran belongs to, and what losing a known person costs beyond the line in the record.
//
//   A home's output   Everything its man and woman carry in to the stores during a battle or a visit is counted to
//                     their house (`made`); food from a field counts half again, for a farm well kept. Every
//                     MADE_RENOWN of it is a rank of standing, as children raised and foes felled in war are, and
//                     the town's record keeps it between seasons.
//   A veteran's town  A veteran is a notable person of the town they came from, when that is known (`town`), and of
//                     the nation's chief town otherwise. This takes the town as a plain number: whoever keeps armies
//                     by town hands it in.
//   A loss            The town grieves: `townGrief` is the share of its morale lost, and `nationLoss` how far the
//                     nation's standing dips. Both fade over GRIEF_SEASONS and weigh a famous person more (the
//                     nation's dip by the square of their fame). Nothing here applies them: grief and drift
//                     (drift.ts) read these numbers.
//
// Plain data in and out: a house is `{ made?: number }`, a notable is the township record, a turn is a number.
import type { Game, Unit } from './game';
import type { Notable } from './township';

/** Goods a house must carry in for one rank of standing. */
export const MADE_RENOWN = 400;
/** Food carried in from a field counts this much: a farm well kept. */
export const FIELD_WEIGHT = 1.5;
/** Seasons a loss is felt, the most a town's morale can fall for grief, and how far each degree of fame takes it. */
export const GRIEF_SEASONS = 4;
export const GRIEF_MAX = 0.5;
export const GRIEF_PER_FAME = 0.1;
/** How far the nation's standing dips for each lost person, by the square of their fame, and the most it can. */
export const NATION_PER_FAME = 0.02;
export const NATION_MAX = 0.3;

/** What a carry is worth to its house: food from a field counts more. */
export const madeWorth = (amount: number, fromField: boolean): number => Math.max(0, amount) * (fromField ? FIELD_WEIGHT : 1);
/** Count a load carried in to a house's output. */
export function addMade(house: { made?: number }, amount: number, fromField = false): void {
  const w = madeWorth(amount, fromField);
  if (w > 0) house.made = Math.round(((house.made ?? 0) + w) * 10) / 10;
}
/** The ranks of standing a house has by what it has carried in. */
export const madeRenown = (house: { made?: number }): number => Math.floor(Math.max(0, house.made ?? 0) / MADE_RENOWN);
/** A home's whole standing: children raised, a rank for every few foes felled in war, and one for every MADE_RENOWN carried in. */
export const standingWith = (kids = 0, war = 0, made = 0, warRenown = 3): number =>
  kids + Math.floor(Math.max(0, war) / warRenown) + Math.floor(Math.max(0, made) / MADE_RENOWN);
/** What a notable home is remembered for, in words. */
export function homeDeed(kids = 0, war = 0, made = 0): string {
  const parts = [kids ? `raised ${kids} ${kids === 1 ? 'child' : 'children'}` : '', made >= MADE_RENOWN ? `kept a house that carried in ${Math.round(made)}` : '', war ? `her house felling ${war} in war` : ''].filter(Boolean);
  if (!parts.length) return 'kept a house';
  return parts.length === 1 && !kids && war ? `kept a house that felled ${war} in war` : parts.join(', ');
}

/** How famous a known person is, 1 to 3: a woman by her home's standing, a soldier by the foes they felled. */
export function fame(n: Pick<Notable, 'kind' | 'kids' | 'war' | 'made' | 'kills'>): number {
  const raw = n.kind === 'veteran' ? Math.floor((n.kills ?? 0) / 3) : 1 + Math.floor((standingWith(n.kids, n.war, n.made) - 3) / 3);
  return Math.max(1, Math.min(3, raw));
}
/** How strongly a loss is still felt, 1 when fresh and 0 after GRIEF_SEASONS. */
const fading = (lostAt: number, turn: number): number => Math.max(0, 1 - Math.max(0, turn - lostAt) / GRIEF_SEASONS);

/** The share of a town's morale lost to grief for its notable people lately lost, 0 to GRIEF_MAX. */
export function townGrief(notables: readonly Notable[], turn: number): number {
  let sum = 0;
  for (const n of notables) if (n.lost) sum += fame(n) * GRIEF_PER_FAME * fading(n.lost.turn, turn);
  return Math.min(GRIEF_MAX, Math.round(sum * 1000) / 1000);
}
/** How far a nation's standing dips for the known people it has lately lost, across all its towns, 0 to NATION_MAX. */
export function nationLoss(towns: readonly (readonly Notable[])[], turn: number): number {
  let sum = 0;
  for (const list of towns) for (const n of list) if (n.lost) sum += fame(n) ** 2 * NATION_PER_FAME * fading(n.lost.turn, turn);
  return Math.min(NATION_MAX, Math.round(sum * 1000) / 1000);
}
/** Those a town mourns now, the freshest first. */
export const mourned = (notables: readonly Notable[], turn: number): Notable[] =>
  notables.filter((n) => n.lost && fading(n.lost.turn, turn) > 0).sort((a, b) => b.lost!.turn - a.lost!.turn);

/** A soldier who made a name, as handed in: `town` is the land they came from, if their army knows it. */
export interface VeteranIn { name: string; kills: number; unit?: string; female?: boolean; town?: number }
/**
 * Which town a veteran is a notable person of: their own town, if it is known and still their nation's; else the
 * nation's chief town; else any of its towns; else `fallback` (the land just fought over).
 */
export function veteranTown(lands: readonly { id: number; owner: number; capital: number }[], nation: number, town: number | undefined, fallback: number): number {
  const own = town === undefined ? undefined : lands.find((t) => t.id === town && t.owner === nation);
  return (own ?? lands.find((t) => t.capital === nation && t.owner === nation) ?? lands.find((t) => t.owner === nation))?.id ?? fallback;
}
/** A town's veterans still living, as plain records. */
export const townVeterans = (notables: readonly Notable[]): Notable[] => notables.filter((n) => n.kind === 'veteran' && !n.lost);

// ---- In a battle or a visit ----

/** The house a person is the man or woman of, standing. */
const homeOf = (g: Game, u: Unit) => {
  const h = u.homeId ? g.entities.get(u.homeId) : undefined;
  return h && h.kind === 'building' && h.type === 'house' && !h.dead && (h.residents.m === u.id || h.residents.f === u.id) ? h : null;
};
/** A person has carried a load in to the stores: it is counted to their house, if they have one. */
export function carriedIn(g: Game, u: Unit, amount: number, fromField: boolean): void {
  const h = homeOf(g, u);
  if (h) addMade(h, amount, fromField);
}
/** What a town's record should keep of the output of the house this woman is the woman of. */
export function homeMade(g: Game, woman: Unit): { made?: number } {
  const h = homeOf(g, woman);
  return h && h.residents.f === woman.id && (h.made ?? 0) > 0 ? { made: Math.round(h.made!) } : {};
}
/** A town turns out: each known woman's house has carried in what the record says it has (after household.ts has housed her). */
export function restoreMade(g: Game, owner: number, named: readonly { name: string; gender: string; made?: number }[]): void {
  for (const n of named) {
    if (n.gender !== 'f' || !(n.made! > 0)) continue;
    const her = g.units.find((u) => u.owner === owner && u.type === 'villager' && u.gender === 'f' && u.name === n.name && !u.dead);
    const h = her ? homeOf(g, her) : null;
    if (h && h.residents.f === her!.id) h.made = Math.max(h.made ?? 0, Math.round(Number(n.made) || 0));
  }
}
