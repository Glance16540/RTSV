// Rulers who weigh their nobles (the owner's "rival rulers weigh their own").
//
// A computer-led ruler reckons with its nobles in war, in its decrees and in its dealings:
//   - War: for each angry lord of its nation it wants WEIGH.margin more strength over a land's defence before it dares
//     march on it (campaign.ts, `dares`), up to WEIGH.most: its lords will not follow it gladly. A player's truce finds
//     it readier, WEIGH.treat for each angry lord, up to WEIGH.most of them (campaign.ts, `offerTruce`).
//   - Decrees: its sensible decrees (decrees.ts) leave out one that would anger a lord who is not angry yet, unless it
//     answers a hungry town. Grain is not left out.
//   - Dealings: each season it deals with its angriest lord, at most one dealing (nobledeal.ts): summons them to court
//     if it may, else sends a gift when the nation can spare the goods (plenty.ts, `nationCanSpare` at PLENTY.studies,
//     the town's own tests aside: a dealing is not bread).
// The player weighs their own: the land's panel says whom a decree pleases and angers, and their dealings are theirs.
import type { Campaign } from './campaign';
import type { DecreeKind } from './decrees';
import { NOBLES, isAngry, moodsFor, noblesOf } from './nobles';
import { dealBar, dealWith } from './nobledeal';
import { PLENTY, nationCanSpare } from './plenty';
import { SUPPLY_UNITS } from './stores';

export const WEIGH = {
  /** Strength over a land's defence a ruler wants for each angry lord before it marches, and readiness for a truce for each. */
  margin: 0.5, treat: 0.1,
  /** The most angry lords counted. */
  most: 3,
};

/** The angry lords of a nation. */
export const angryLords = (c: Campaign, f: number): number => (f >= 0 ? noblesOf(c, f).filter((n) => n.rank === 'lord' && isAngry(n)).length : 0);
const counted = (c: Campaign, f: number): number => Math.min(WEIGH.most, angryLords(c, f));
/** The strength a computer-led ruler wants over a land's defence for its angry lords, before it dares march. */
export const marchMargin = (c: Campaign, f: number): number => (c.factions[f]?.isAI ? WEIGH.margin * counted(c, f) : 0);
/** How much readier a computer-led ruler is to take a truce for its angry lords. */
export const treatLean = (c: Campaign, f: number): number => (c.factions[f]?.isAI ? WEIGH.treat * counted(c, f) : 0);

/** Would this decree anger a lord of the nation who is not angry yet? A computer-led ruler leaves it out (decrees.ts). */
export function angersLord(c: Campaign, f: number, tid: number, kind: DecreeKind, strength = 1): boolean {
  if (!c.factions[f]?.isAI || kind === 'alms') return false;
  return moodsFor(c, f, tid, kind, strength).some(({ noble, by }) => noble.rank === 'lord' && !isAngry(noble) && noble.mood + by <= NOBLES.angry);
}

/** A season of a computer-led ruler dealing with its angriest lord. Returns the dealing done, or ''. */
export function weighSeason(c: Campaign, f: number): string {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return '';
  const lord = noblesOf(c, f).filter((n) => n.rank === 'lord' && isAngry(n)).sort((a, b) => a.mood - b.mood || a.key.localeCompare(b.key))[0];
  if (!lord) return '';
  if (dealBar(c, f, lord.key, 'summon') === '' && dealWith(c, f, lord.key, 'summon') === '') return 'summon';
  const gift = { gold: 2 * SUPPLY_UNITS };
  if (dealBar(c, f, lord.key, 'gift') === '' && nationCanSpare(c, f, lord.town, gift, PLENTY.studies, { town: false }) && dealWith(c, f, lord.key, 'gift') === '') return 'gift';
  return '';
}
/** A season of every computer-led ruler dealing with its nobles. */
export function weighSeasons(c: Campaign): void {
  for (const x of c.factions) weighSeason(c, x.id);
}
