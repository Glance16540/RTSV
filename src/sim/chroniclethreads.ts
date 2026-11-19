// The chronicle read as one story (docs/systems-board, "Story and events": battles between rivals stayed out of it,
// and a story's later lines did not say what they came of).
//
//   - News heard: a great battle between two rival peoples is written in the chronicle where the player would hear
//     of it: fought in a land beside his own, or by his ally. A great battle is one with the ally in it, or with
//     companies enough on the field (GREAT); a capital or a named place taken is told already (campaign.ts).
//   - Threads: a later line of a story says when it began. A tale that came of an earlier answer names the answer
//     and its year; a claimant's later lines (proclaimed, come of age, the rising and its end) name the year the child
//     was born.
//   - When: the chronicle's lines are dated by year and season, as the battles on the map are.
// Words only: nothing here changes a rule.
import type { Campaign, Pending } from './campaign';
import type { BattleNote } from './battlehooks';
import { SEASONS_A_YEAR } from './ageing';

/** Companies on the field, both sides together, for a battle between rivals to be told when it is heard. */
export const GREAT = 6;

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
/** The year a season falls in, counting the first as year 1. */
export const yearOf = (turn: number): number => Math.floor(turn / SEASONS_A_YEAR) + 1;
/** A season, as the chronicle dates its lines: "Year 3, autumn". */
export const whenOf = (turn: number): string => `Year ${yearOf(turn)}, ${SEASONS[((turn % SEASONS_A_YEAR) + SEASONS_A_YEAR) % SEASONS_A_YEAR]}`;

/** The words a later line of a story ends with, naming the year it began: '' if it began this season. */
export function toldIn(c: Campaign, turn: number | undefined): string {
  return turn === undefined || turn >= c.turn ? '' : ` As was told in year ${yearOf(turn)}.`;
}

/** A tale that came of an earlier answer, told with that answer: " It came of the exile you sheltered, as was told in year 2." */
export function cameOf(c: Campaign, after: { id: string; choice: 'a' | 'b' } | undefined, title: (id: string) => string | undefined): string {
  if (!after) return '';
  const was = [...(c.answers ?? [])].reverse().find((a) => a.id === after.id && a.choice === after.choice && a.turn < c.turn);
  if (!was) return '';
  const name = title(after.id);
  return ` It came of ${name ? `"${name}"` : 'an earlier matter'}, as was told in year ${yearOf(was.turn)}.`;
}

/** Would the player hear of a battle between these two at this land? Beside his own lands, or his ally's fight. */
export function heardOf(c: Campaign, p: Pending): boolean {
  const t = c.territories[p.to];
  if (!t || p.attacker <= 0 || p.defender <= 0) return false;
  return p.attacker === c.ally || p.defender === c.ally || t.adj.some((n) => c.territories[n]?.owner === 0);
}

const count = (u: Record<string, number> | undefined): number => Object.values(u ?? {}).reduce((n, v) => n + Math.max(0, v), 0);

/**
 * A battle between rivals, written as news heard if it was great and within hearing. Called once it is settled.
 * Returns the line written, or ''.
 */
export function rivalBattleHeard(c: Campaign, p: Pending, b: BattleNote): string {
  if (!heardOf(c, p)) return '';
  const t = c.territories[p.to], A = c.factions[p.attacker], D = c.factions[p.defender];
  if (!A || !D) return '';
  const began = count(b.fought?.a.began) + count(b.fought?.d.began);
  if (began < GREAT && p.attacker !== c.ally && p.defender !== c.ally) return '';
  // A capital or a named place that changed hands is told already, in its own words.
  if ((c.chronicle ?? []).some((l) => l.turn === c.turn && l.text.includes(t.name))) return '';
  const lostA = count(b.fought?.a.lost), lostD = count(b.fought?.d.lost);
  const toll = b.fought ? ` The ${A.name} lost ${lostA} ${lostA === 1 ? 'company' : 'companies'} there, the ${D.name} ${lostD}.` : '';
  const text = b.attackerWon
    ? `Word came from ${t.name}: the ${A.name} beat the ${D.name} there and took it.${toll}`
    : `Word came from ${t.name}: the ${A.name} came against the ${D.name} there and were thrown back.${toll}`;
  (c.chronicle ??= []).push({ turn: c.turn, text });
  return text;
}
