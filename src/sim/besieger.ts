// A besieger assaults. An army that has marched on a town came to take it: when the computer plays the attacking
// side of a campaign siege it does not sit in its camp waiting for the hour a skirmish would allow a first attack,
// nor for its army to outweigh the defenders, their towers and their hall. It forms up for BESIEGE.form seconds
// and goes in with what it brought. A town left alone only grows: every minute the besieger waits it is weaker
// against it. After that first assault it plays as the computer always does.
//
// The attacking side of a siege is marked in its set-up (`PlayerSetup.besieger`, by campaign.ts `battleConfig`).
// A skirmish, a mission, a field battle and the defender of a siege are not, and nothing changes for them.
import type { Game } from './game';

declare module './game' {
  interface PlayerSetup {
    /** This side came to assault the other's town in a campaign siege (besieger.ts). */
    besieger?: boolean;
  }
}

export const BESIEGE = {
  /** Seconds a besieging army takes to form up before its assault. */
  form: 60,
  /** The fewest fighters it will go in with. */
  least: 3,
};

/** Is this player the attacking side of a campaign siege? */
export const besieging = (g: Game, pid: number): boolean => !!g.setups[pid]?.besieger;

/** Is it time for this besieger's assault: it has formed up, has anyone to send, and is not itself under attack? */
export function assaultDue(g: Game, pid: number, fighters: number, underAttack: boolean): boolean {
  return besieging(g, pid) && g.time >= BESIEGE.form && fighters >= BESIEGE.least && !underAttack;
}
