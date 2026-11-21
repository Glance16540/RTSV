// A rival king at war by a feud sends a raiding party against the leader's seat (docs/CLOSING.md, the inner circle:
// "a rival king's threats lead neither to war nor to a raid on the court").
//
// A defied rival king may declare war (feudwar.ts). While that war runs he may, once, send a raiding party against the
// town where the player's court sits (court.ts; failing a court, the capital). It is a band's strike in every way but
// who sent it:
//   - the party is a band of raiders for the season (threats.ts `Band`, marked `party` with the people that sent it),
//     as strong as half his strongest army, never under FEUDRAID.least nor over a band's most;
//   - it strikes the seat by the strike's own rule (threats.ts `strike`, raidclash.ts): the town turns out, the army
//     there and its Fortress count, stores may be taken and men killed, and the people's standing sways;
//   - in the campaign's own turn it waits on the player like any strike on a town of theirs, to be fought in person or
//     left to the town (raidfought.ts);
//   - it has come to burn and rob the court, not to lead people away: it carries nobody off (threats.ts `strike` reads a
//     town broken by a party as raided, never taken), and when it has struck it goes home: no band is left on the map.
// It comes in a season of the war after the first, by a chance of its own each season (FEUDRAID.chance), and once a feud.
//
// Only the player's feuds are weighed, as in feudwar.ts. bandseason.ts calls it after the season's strikes.
import type { Campaign } from './campaign';
import type { Mark } from './aftermath';
import { armyStrength } from './campaignbase';
import { courtOf } from './court';
import { chance } from './intriguebase';
import { THREATS } from './threatsbase';
import { strike } from './threats';
import type { Band, Raid } from './threats';

declare module './aftermath' {
  interface Mark { /** The season the rival king's raiding party came against the leader's seat in this feud (feudraid.ts). */ raided?: number }
}

export const FEUDRAID = {
  /** The chance, each season of a feud's war after the first, that the king sends his raiding party (once a feud). */
  chance: 0.25,
  /** Of his strongest army's strength, the share that rides with the party; and the least a party is. */
  share: 0.5, least: 3,
};

/** The town a raid on the court falls on: where the player's court sits, if it is theirs; else their capital. None if they hold neither. */
export function seatOf(c: Campaign): number | undefined {
  const at = courtOf(c, 0)?.at;
  if (at !== undefined && c.territories[at]?.owner === 0) return at;
  return c.territories.find((t) => t.capital === 0 && t.owner === 0)?.id;
}

/** How strong a party this people sends: half its strongest army, between the least and a band's most; 0 if it has no army to send from. */
export function partyStrength(c: Campaign, rival: number): number {
  const best = Math.max(0, ...c.armies.filter((a) => a.owner === rival).map((a) => armyStrength(a, c)));
  return best > 0 ? Math.max(FEUDRAID.least, Math.min(THREATS.max, Math.round(best * FEUDRAID.share))) : 0;
}

/** The feuds whose king would send his party this season: at war, not yet raided, a season at least into the feud, his people alive and armed, and the day's chance. */
export function raidsDue(c: Campaign, sure = false): Mark[] {
  if (seatOf(c) === undefined || !c.factions[0]?.alive) return [];
  return (c.marks ?? []).filter((m) => m.kind === 'feud' && m.war && m.owner === 0 && m.rival !== undefined && m.raided === undefined && m.until >= c.turn && c.turn > m.since
    && !!c.factions[m.rival]?.alive && partyStrength(c, m.rival) > 0 && (sure || chance(c, m.id * 223 + 11) < FEUDRAID.chance));
}

/** The party on the map for the season it strikes. */
export function raiseParty(c: Campaign, m: Mark): Band {
  const r = c.factions[m.rival!], at = seatOf(c)!;
  const b: Band = { id: (c.bandSeq = (c.bandSeq ?? 0) + 1), kind: 'raiders', name: `the raiders of the ${r.name}`, at, strength: partyStrength(c, m.rival!), since: c.turn, held: [], party: m.rival! };
  (c.bands ??= []).push(b);
  m.raided = c.turn;
  const king = m.name ?? 'The rival king';
  c.log.push(`${king} of the ${r.name} has sent a raiding party against your court at ${c.territories[at].name}.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${king} of the ${r.name} sent raiders against the court at ${c.territories[at].name}.` });
  return b;
}

/** Is this band a king's raiding party? */
export const isParty = (b: Band): boolean => b.party !== undefined;

/**
 * The season's raids on the court. A party that has struck, or whose strike came to nothing, has gone home. Then each
 * king whose party is due sends it: `waits` (the campaign's own turn passes raidfought.ts `offerRaid`) may put its strike
 * to the player, and then the season stops there, the party standing until it is settled; else it strikes at once.
 * Returns the strikes that fell here.
 */
export function feudRaidSeason(c: Campaign, out: string[], opts: { waits?: (c: Campaign, b: Band, tid: number, out: string[]) => boolean; sure?: boolean } = {}): Raid[] {
  const home = (): void => { c.bands = (c.bands ?? []).filter((b) => !isParty(b) || c.pending?.raid === b.id); };
  home();
  const raids: Raid[] = [];
  if (c.pending) return raids;
  for (const m of raidsDue(c, opts.sure)) {
    const b = raiseParty(c, m), at = b.at;
    if (opts.waits?.(c, b, at, out)) break; // it waits on the player, and the season with it
    raids.push(strike(c, b, at, out));
    home();
  }
  return raids;
}
