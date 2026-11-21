// One season of the threats of men over the whole map: the one call the campaign makes for all of it.
// The parts are modules of their own: who the bands are and how a town struck defends itself (threats.ts), an
// army's fight with a band (bandfight.ts), bands moving (bandroam.ts), and the marauders who hold a land
// (bandhorde.ts). What came of the season is read back as plain data from raidnews.ts.
import { caravanSeason } from './bandcaravan';
import { heraldSeason } from './raidnews';
import { governInns } from './inn';
import { carriedSeason } from './carriedoff';
import { noCarrySeason } from './nocarry';
import { bornSeason } from './bandborn';
import type { Campaign } from './campaign';
import { Raid, appearSeason, captivesSeason, strikeSeason } from './threats';
import { ambushSeason, huntBands } from './bandfight';
import { roamSeason } from './bandroam';
import { hordeSeason } from './bandhorde';
import { farPlace, seenGathering, setOutFromAfar } from './bandwilds';
import { marched } from './bandmarch';
import { offerRaid } from './raidfought';

/** Called once a turn. Returns the season's reports of strikes; the same are kept on the campaign and written in the log. */
export function threatsOfMen(c: Campaign): Raid[] {
  const out: string[] = [];
  c.bands ??= [];
  captivesSeason(c, out); // those held too long are lost
  bornSeason(c); // a woman held may bear a child there: a record, nothing more (bandborn.ts)
  governInns(c); // a town with highwaymen on its road begins an Inn (inn.ts)
  carriedSeason(c); // those a nation led away become its people, unless they were got back (carriedoff.ts)
  noCarrySeason(c); // and where a leader has forbidden the taking, the lords take it as they are (nocarry.ts)
  huntBands(c, out); // the computer's peoples go after the bands in their lands
  roamSeason(c, out); // bands flee, roam, settle and break up
  const raids = [...strikeSeason(c, out, { waits: offerRaid }), ...hordeSeason(c, out)] // a strike on a town of the player's waits on the player (raidfought.ts);
  for (const r of raids) marched(c, r.band, 'struck');
  let far = false;
  const told = out.length, born = appearSeason(c, out, (kind) => { const at = farPlace(c, kind); far ||= !!at; return at; }); // some are born in the far wilds (bandwilds.ts)
  if (born && far && setOutFromAfar(c, born)) { out.splice(told); seenGathering(c, born, out); } // nobody is there to see them gather, but for the towns that look out on the rim of wilderness
  ambushSeason(c, out); // a band may fall on an army that is weak, or seeing a convoy along the road
  caravanSeason(c); // and raiders, slavers or marauders on a land a caravan's road crosses may fall on it (bandcaravan.ts, caravans.ts)
  heraldSeason(c, out); // a people who keep heralds hear of the bands that mean to strike them, a season before (heralds.ts)
  c.log.push(...out);
  return raids;
}
