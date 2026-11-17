// A town is not written off by a field it was never on (the threats session's finding after PLAYTEST 4.1).
//
// When a battle or a visit is over, the side that held the town hands back its count (battlefolk.ts censusOf), and
// township.ts settleFolk writes that over the town's record: those not on the field are dead. A side whose people
// were never set on the field (its setup had no `bonus.people`: a tribe's town defended as a war band was one such,
// before 4.1 was fixed) hands back a count of nobody, and its whole town was written off. Whatever the next such
// side turns out to be, its count is now marked (`unfielded`), and the record is kept as it was: none of its own was
// on the field to fall there (a town's men take up arms only from among its people on the field, tribes.ts armMen,
// and soldiers' losses are their armies' rolls'). The log says so.
import type { Campaign } from './campaign';
import type { Game } from './game';
import type { Census, Folk } from './township';

declare module './township' {
  interface Census { /** This side's people were never set on the field: its count is not the town's (writeguard.ts). */ unfielded?: boolean }
}

/** Were this side's people never set on the field? (A side with no town's people in its setup.) */
export const unfieldedSide = (g: Game, owner: number): boolean => !g.setups[owner]?.bonus?.people;

/** The mark, as a census is made safe (township.ts cleanCensus): only `true` is kept. */
export const unfieldedOf = (x: { unfielded?: unknown } | null | undefined): { unfielded?: true } => (x?.unfielded === true ? { unfielded: true } : {});

/**
 * Should this count be written over the town's record? Not when its people were never on the field and the record
 * has anyone in it: then the record is kept as it was (only the note of those held back from the field is dropped,
 * nobody having been taken off it), the log says so, and this returns true.
 */
export function keptAsWas(c: Campaign, tid: number, f: Folk, census: Census, people: number): boolean {
  if (!census.unfielded || people <= 0) return false;
  delete f.fieldHome;
  const t = c.territories[tid];
  c.log.push(`The people of ${t?.name ?? 'the town'} were not on the field: their record is kept as it was.`);
  return true;
}
