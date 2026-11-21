// A claimant to the throne, and the lord behind them, as figures on the field (docs/CLOSING.md, "Claimants to the
// throne": "the lord, the band and the grown claimant are names and a line on the land's panel, not figures").
//
// claimantcaptain.ts already puts the leader of a rising on the field by name in a battle for a risen town: a grown
// claimant by their own name, or whoever proclaimed a child. Here, beside that:
//   - in a battle for a town risen for a grown claimant born in a lord's house, the lord who raised them stands at the
//     town's hall by his title, beside the claimant who leads;
//   - in a visit to a town of the player's where a grown claimant lives who has not risen (the lord's own town, where they
//     were born and grew up), the claimant and the lord stand at the hall, by name.
// Only the grown: a claimant not yet of age is never a figure, never named, never shown (claimants.ts); a band's chief is
// the captain's and no lord stands for a band. They are figures for the eye (hallguests.ts draws them before the hall's
// door, with faces on the hall's panel): no units, not counted with the town, taking no orders. It reads the claims and
// writes nothing on the map.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { claimantAt } from './claimantrising';

/** One who stands at the hall for a claim: the claimant, or the lord who raised them. */
export interface ClaimFigure { role: 'claimant' | 'lord'; name: string; female: boolean; /** The claim, for a figure that is the same for as long as it stands there. */ id: number }

declare module './game' {
  interface Player { /** The claimant and the lord behind them, standing at this side's hall (claimantfigures.ts). */ claimFigures?: ClaimFigure[] }
}

const text = (v: unknown, n = 60): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');
const lady = (by: string): boolean => /^(lady|the lady)\b/i.test(by);

/** Who stands at the hall in a battle for this risen town, beside the captain who leads it: the lord behind a grown claimant. */
export function risingFigures(c: Campaign, tid: number): ClaimFigure[] {
  const cl = claimantAt(c, tid);
  if (!cl || cl.ended || !cl.towns?.includes(tid) || !cl.name || cl.grown === undefined || cl.parent !== 'noble' || !cl.by) return [];
  return [{ role: 'lord', name: cl.by, female: lady(cl.by), id: cl.id }];
}

/** Who stands at the hall in a visit to this town of the player's: a grown claimant to their throne who lives here and has not risen, and the lord who raised them. */
export function visitFigures(c: Campaign, tid: number): ClaimFigure[] {
  if (c.territories[tid]?.owner !== 0) return [];
  const cl = (c.claims ?? []).find((x) => x.owner === 0 && x.town === tid && !x.ended && x.name && x.grown !== undefined && !x.towns?.length);
  if (!cl) return [];
  return [{ role: 'claimant', name: cl.name!, female: !!cl.female, id: cl.id }, ...(cl.parent === 'noble' && cl.by ? [{ role: 'lord' as const, name: cl.by, female: lady(cl.by), id: cl.id }] : [])];
}

/** The figures a side takes onto the field, as its set-up has them: cleaned, two at the most. */
export function setClaimFigures(g: Game, owner: number, raw: unknown): ClaimFigure[] {
  const p = g.players[owner];
  if (!p || !Array.isArray(raw)) return [];
  const out = raw.slice(0, 2).map((x: Partial<ClaimFigure>) => ({ role: x?.role === 'claimant' ? 'claimant' as const : 'lord' as const, name: text(x?.name), female: !!x?.female, id: Number.isInteger(x?.id) ? x!.id! : 0 })).filter((x) => x.name);
  if (out.length) p.claimFigures = out; else delete p.claimFigures;
  return out;
}
