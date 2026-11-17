// Salting and Smoking (docs/DESIGN.md, "Buildings and research that answer the systems": "Salting and Smoking keep
// food longer"). A study of the nation's (studies.ts), taught at the Granary.
//
// On the map what a town of a nation that knows it lays by spoils SALTING.rot as fast (larder.ts asks `saltRot`).
// In a town, with meat and fish put by, a bare store takes SALTING.grace times as long to turn to hunger and famine
// (famine.ts asks `saltGrace`; it is on top of a Granary's). The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { hasStudy } from './studies';

export const SALTING = {
  /** How fast food beyond what a town keeps spoils, as a share. */
  rot: 0.5,
  /** In a town: how many times as long a bare store lasts. */
  grace: 1.5,
};
/** On the map: how fast a town of this people's laid-by food spoils, as a share (larder.ts). */
export const saltRot = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'salting') ? SALTING.rot : 1);
/** In a town: how many times as long this people's bare store lasts (famine.ts). */
export const saltGrace = (g: Game, owner: number): number => (g.players[owner]?.techs.has('salting') ? SALTING.grace : 1);
