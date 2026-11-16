// Quarantine (docs/DESIGN.md, "Buildings and research that answer the systems": "Quarantine keeps plague from
// crossing between towns"). A study of the nation's (studies.ts), taught at the Infirmary.
//
// On the map plague passes from a plagued town to a neighbour QUARANTINE.pass as often where either town's people
// know it (acts.ts asks `quarantinePass`): the sick town keeps its gates, or the well one shuts them. In a town a
// people that knows it catches plague from strangers QUARANTINE.pass as readily (contagion.ts asks
// `quarantineGuard`). The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { hasStudy } from './studies';

export const QUARANTINE = {
  /** How readily plague crosses where it is kept, as a share. */
  pass: 0.5,
};
const knows = (c: Campaign, f: number): boolean => f >= 0 && hasStudy(c, f, 'quarantine');
/** On the map: how often plague passes from a town of `from`'s to a town of `to`'s, as a share (acts.ts). */
export const quarantinePass = (c: Campaign, from: number, to: number): number => (knows(c, from) || knows(c, to) ? QUARANTINE.pass : 1);
/** In a town: how readily this people catches plague from strangers, as a share (contagion.ts). */
export const quarantineGuard = (g: Game, owner: number): number => (g.players[owner]?.techs.has('quarantine') ? QUARANTINE.pass : 1);
