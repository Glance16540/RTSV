// A town's feast day, as the hall's and the church's panels tell it (src/sim/feastfield.ts). Kept small: the rules are in the sim.
import type { Building, Game } from '../sim/game';
import { feastWords } from '../sim/feastfield';

/** The line on a hall's or a church's panel while the town keeps its feast day, or ''. */
export function feastLine(g: Game, b: Building): string {
  if (b.type !== 'towncenter' && b.type !== 'temple') return '';
  const words = feastWords(g, b.owner);
  return words ? `<div class="feast-line">🕯️ ${words}</div>` : '';
}
