// Midwifery (docs/DESIGN.md, "Buildings and research that answer the systems": "Midwifery makes births safer"). A
// study of the nation's (studies.ts), taught at the Infirmary.
//
// No child dies in this game: where families are weak, some of the births that are due do not come (creed.ts's
// `childLoss`). A people that knows Midwifery loses MIDWIFERY.loss of those, on the map (seasonfolk.ts asks
// `midwifeLoss`) and in a town (game.ts asks `midwifeLossIn`). The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { hasStudy } from './studies';

export const MIDWIFERY = {
  /** The share of the births that would not come that still do not. */
  loss: 0.75,
};
/** On the map: the share of a people's lost births still lost (seasonfolk.ts). */
export const midwifeLoss = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'midwifery') ? MIDWIFERY.loss : 1);
/** In a town: the same for its people (game.ts). */
export const midwifeLossIn = (g: Game, owner: number): number => (g.players[owner]?.techs.has('midwifery') ? MIDWIFERY.loss : 1);
