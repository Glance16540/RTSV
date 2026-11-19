// Winter is felt, not only seen (docs/DESIGN.md, the owner's word). The map's season is the turn's (seasonsky.ts
// seasonOfTurn: one turn a season, so one winter a year); until now winter was a look in battle and nothing more. Now,
// wherever a land has a winter (every land but the desert, which keeps its summer, as its look does):
//   - armies march more slowly: an army that marches in winter is snowbound the season after and cannot march again
//     until it is past, so a winter march costs two seasons; and no people covers two lands in a winter season (the
//     Mongols' second march through friendly land is not to be had in the snow);
//   - fields yield less: a land's harvest in winter is WINTER.yield of a summer's (harvest.ts);
//   - rivers freeze hard enough to cross on foot: two lands a river parts border one another while winter lasts, for
//     every system that asks who borders whom (campaignbase.ts reach), and the ice is gone in spring. A bridge already
//     built makes no difference; the mountains do not freeze.
// The season comes from the turn alone, so the same campaign is the same winter every time.
import type { Army, Campaign } from './campaign';
import { seasonOfTurn } from './seasonsky';

declare module './campaign' {
  interface Army {
    /** The turn it marched in winter: it is snowbound the season after (winter.ts). */
    snowed?: number;
  }
}

export const WINTER = {
  /** What a land yields in winter, against any other season. */
  yield: 0.6,
};

/** Is it winter on the map? */
export const isWinter = (c: Campaign): boolean => seasonOfTurn(c.turn) === 'winter';
/** Is it winter in this land: winter on the map, and not a desert. `biome` is the land's (campaignbase.ts biomeOf). */
export const wintersIn = (c: Campaign, biome: string): boolean => isWinter(c) && biome !== 'desert';

/** What a land yields this season, as a share: WINTER.yield in its winter, else 1. */
export const winterYield = (c: Campaign, biome: string): number => (wintersIn(c, biome) ? WINTER.yield : 1);

/**
 * The lands across a frozen river from this one: those a river parts it from, where both have a winter. `biomeOf` is
 * campaignbase.ts's, handed in so that this imports nothing of it (reach() there asks this).
 */
export function iceBridges(c: Campaign, tid: number, biomeOf: (c: Campaign, tid: number) => string): number[] {
  if (!isWinter(c) || biomeOf(c, tid) === 'desert') return [];
  const out: number[] = [];
  for (const w of c.barriers ?? []) {
    if (w.kind !== 'river' || (w.a !== tid && w.b !== tid)) continue;
    const other = w.a === tid ? w.b : w.a;
    if (biomeOf(c, other) !== 'desert' && !out.includes(other)) out.push(other);
  }
  return out;
}

/** Is this army snowbound: it marched last season, in winter, and cannot march again yet? */
export const snowbound = (c: Campaign, a: Army): boolean => a.snowed !== undefined && c.turn === a.snowed + 1;
/**
 * An army has marched: in its winter it is snowbound the season after, and its march ends the season's (no second march).
 * `biome` is the land it marched from. Returns whether winter slowed it.
 */
export function marchedIn(c: Campaign, a: Army, biome: string): boolean {
  if (!wintersIn(c, biome)) return false;
  a.snowed = c.turn;
  a.moved = true;
  return true;
}
