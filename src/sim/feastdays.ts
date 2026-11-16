// Feast Days, a study of the nation's (studies.ts): once a year, every town of a nation that keeps them is lifted
// toward the holy way (townfaith.ts), on the first season of the year.
import type { Campaign } from './campaign';
import { hasStudy } from './studies';
import { swayTown } from './townfaith';
import { SEASONS_A_YEAR } from './ageing';

export const FEAST_DAYS = { lift: 4 };
/** The year's feast: on the first season of each year every town of a nation with Feast Days rises by FEAST_DAYS.lift. Returns the towns lifted. */
export function feastSeason(c: Campaign): number {
  if (c.turn % SEASONS_A_YEAR !== 0) return 0;
  let n = 0;
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive || !hasStudy(c, t.owner, 'feastdays')) continue;
    swayTown(c, t.id, FEAST_DAYS.lift);
    n++;
  }
  return n;
}
