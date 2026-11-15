// One season of the threats of men over the whole map: the one call the campaign makes for all of it.
// The parts are modules of their own: who the bands are and how a town struck defends itself (threats.ts), an
// army's fight with a band (bandfight.ts), bands moving (bandroam.ts), and the marauders who hold a land
// (bandhorde.ts). What came of the season is read back as plain data from raidnews.ts.
import type { Campaign } from './campaign';
import { Raid, appearSeason, captivesSeason, strikeSeason } from './threats';
import { ambushSeason, huntBands } from './bandfight';
import { roamSeason } from './bandroam';
import { hordeSeason } from './bandhorde';

/** Called once a turn. Returns the season's reports of strikes; the same are kept on the campaign and written in the log. */
export function threatsOfMen(c: Campaign): Raid[] {
  const out: string[] = [];
  c.bands ??= [];
  captivesSeason(c, out); // those held too long are lost
  huntBands(c, out); // the computer's peoples go after the bands in their lands
  roamSeason(c, out); // bands flee, roam, settle and break up
  const raids = [...strikeSeason(c, out), ...hordeSeason(c, out)];
  appearSeason(c, out);
  ambushSeason(c, out); // a band may fall on an army that is weak, or seeing a convoy along the road
  c.log.push(...out);
  return raids;
}
