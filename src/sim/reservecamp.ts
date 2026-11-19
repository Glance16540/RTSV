// A reserve's camp has no people from nowhere (docs/DESIGN.md, "A siege camp has no people from nowhere"; docs/CLOSING.md,
// "Nobody from nowhere": an attacking camp's villagers).
//
// The strongest army next door on each side joins a campaign siege as a reserve, with a camp of its own (campaign.ts
// battleConfig). That camp was laid like a town's: a hall and two men and two women, people from nowhere, who could even
// be born to there. A reserve is an army, as a besieger is: its men are the army's own, from the map's roll. So it is
// marked in its set-up (`PlayerSetup.reserve`), its camp is laid with no villagers (siegecamp.ts `campWithoutPeople`),
// and having no villagers it has not died out (dyingout.ts): its soldiers fight on until they fall, as a besieger's do.
// A skirmish, a mission and a field battle have no reserves and are not touched.
import type { Game } from './game';

declare module './game' {
  interface PlayerSetup {
    /** This side is an army come from next door to join a campaign siege, with a camp of its own (reservecamp.ts). */
    reserve?: boolean;
  }
}

/** Is this player a reserve army in a campaign siege? */
export const reserving = (g: Game, pid: number): boolean => !!g.setups[pid]?.reserve;
