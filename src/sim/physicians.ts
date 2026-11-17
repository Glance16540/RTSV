// Physicians (docs/DESIGN.md, "Buildings and research that answer the systems": "Physicians improves on Herbalism").
// A study of the nation's (studies.ts), taught at the Infirmary once Herbalism is known in the town.
//
// On the map plague takes PHYSICIANS.sick of those it would in a nation that has physicians (acts.ts asks
// `physicianCare`). In a town its healers heal half again as fast, on top of Herbalism (data.ts's entry, the
// game's own healing). The numbers are first guesses.
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const PHYSICIANS = {
  /** The share of plague's toll a people with physicians still pays. */
  sick: 0.8,
  /** In a town: how much faster its healers heal, added to what Herbalism gives. */
  heal: 0.5,
};
/** On the map: the share of plague's toll this people still pays (acts.ts). */
export const physicianCare = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'physicians') ? PHYSICIANS.sick : 1);
