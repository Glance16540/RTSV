// One season of the threats of men over the whole map: the one call the campaign makes for all of it.
// The parts are modules of their own: who the bands are and how a town struck defends itself (threats.ts), an
// army's fight with a band (bandfight.ts), bands moving (bandroam.ts), and the marauders who hold a land
// (bandhorde.ts). What came of the season is read back as plain data from raidnews.ts.
import { heraldSeason } from './raidnews';
import { governInns } from './inn';
import { carriedSeason } from './carriedoff';
import { bornSeason } from './bandborn';
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
  bornSeason(c); // a woman held may bear a child there: a record, nothing more (bandborn.ts)
  governInns(c); // a town with highwaymen on its road begins an Inn (inn.ts)
  carriedSeason(c); // those a nation led away become its people, unless they were got back (carriedoff.ts)
  huntBands(c, out); // the computer's peoples go after the bands in their lands
  roamSeason(c, out); // bands flee, roam, settle and break up
  const raids = [...strikeSeason(c, out), ...hordeSeason(c, out)];
  appearSeason(c, out);
  ambushSeason(c, out); // a band may fall on an army that is weak, or seeing a convoy along the road
  heraldSeason(c, out); // a people who keep heralds hear of the bands that mean to strike them, a season before (heralds.ts)
  c.log.push(...out);
  return raids;
}
