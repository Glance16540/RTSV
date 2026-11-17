// Crop Rotation (docs/DESIGN.md, "Buildings and research that answer the systems": "Crop Rotation means fewer failed
// harvests"). A study of the nation's (studies.ts), taught at the Mill.
//
// On the map a nation that knows it has a failed harvest ROTATION.fail as often on its lands (acts.ts asks
// `rotationFail` where it reckons a famine's chance). In a town its fields fail ROTATION.fail as often (famine.ts
// asks `rotationFailIn` for a lean year). The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { hasStudy } from './studies';

export const ROTATION = {
  /** How often a harvest fails for a people that rotates its crops, as a share. */
  fail: 0.6,
};
/** On the map: how often this people's harvests fail, as a share (acts.ts). */
export const rotationFail = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'croprotation') ? ROTATION.fail : 1);
/** In a town: how often this people's fields fail, as a share (famine.ts). */
export const rotationFailIn = (g: Game, owner: number): number => (g.players[owner]?.techs.has('croprotation') ? ROTATION.fail : 1);
