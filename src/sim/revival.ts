// A nation brought back to life (docs/CLOSING.md, "Sooner settled where they are ruled well": a nation given back its last
// town by a rising was not brought back to life). A town taken from a people that rises and throws off its taker goes
// back to that people if they still stand (conquered.ts); a people already counted out had no town to go back to, so it
// went to its tribe. Now a computer-led people counted out takes it back, and lives again: the town is its seat, its
// lords and its leader are as the rules for a people with no leader make them (it looks to its house, its captains, or
// hires one, campaign.ts), and the season's news tells of it. The player's people are never brought back: their fall
// ends the campaign. Nothing comes back with it but the town.
import type { Campaign } from './campaign';

/** May this people, counted out, take back a town that rises for it? A computer-led people, while the campaign goes on. */
export const mayReturn = (c: Campaign, f: number): boolean => f > 0 && !!c.factions[f] && !c.factions[f].alive && c.phase !== 'over';

/** The people come back to life in the town that rose for them: it is their seat. */
export function bringBack(c: Campaign, f: number, tid: number): void {
  const fac = c.factions[f], t = c.territories[tid];
  if (!fac || !t || fac.alive) return;
  fac.alive = true;
  fac.supplies = Math.max(0, fac.supplies ?? 0);
  if (!c.territories.some((x) => x.capital === f && x.owner === f)) t.capital = f;
  delete fac.court;
  c.log.push(`${t.name} has risen for the ${fac.name}, who were counted gone: they live again, and ${t.name} is their seat.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `The ${fac.name}, driven from their last land, came back when ${t.name} rose for them.` });
}
