// What the next age opens (docs/PLAYTEST.md, finding 14: "Nothing on the panel says save for the age to open these").
//
// Most of the town's later works and every study ask for a later age, and a player who spends each season on companies
// never sees them. The land panel names, beside the age button, the works raised on the town's record and the studies of
// the nation that the next age opens, so that saving for it is a choice the player can see.
//
// Reads only the tables (data.ts) and the nation's age: plain data in, a line of text out.
import type { Campaign } from './campaign';
import { AGES, BUILDINGS, TECHS } from './data';
import { ageOf } from './campaignbase';

/** The next age's name, the works of the map it opens, and the studies this nation may learn in it; null in the last age. */
export function nextAgeOpens(c: Campaign, f: number): { age: string; works: string[]; studies: string[] } | null {
  const next = ageOf(c, f) + 1, civ = c.factions[f]?.civ;
  if (next >= AGES.length) return null;
  const works = Object.values(BUILDINGS).filter((b) => b.onMap && b.age === next).map((b) => b.name);
  const studies = Object.values(TECHS).filter((t) => !!t.answers && t.age === next && (!t.civ || t.civ === civ)).map((t) => t.name);
  return { age: AGES[next].name, works, studies };
}

/** Names in a list: "a", "a and b", "a, b and c". */
const list = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** A line for the panel: what the next age opens and what it costs, or '' when it opens nothing or there is none. */
export function nextAgeText(c: Campaign, f: number, cost: number): string {
  const o = nextAgeOpens(c, f);
  if (!o || (!o.works.length && !o.studies.length)) return '';
  const parts = [o.works.length ? `the ${list(o.works)}` : '', o.studies.length ? `${o.studies.length} ${o.studies.length === 1 ? 'study' : 'studies'} (${list(o.studies)})` : ''].filter(Boolean);
  return `The ${o.age} opens ${parts.join(', and ')}. Save ${cost} supplies for it.`;
}
