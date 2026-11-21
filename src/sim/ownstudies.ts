/**
 * Each people its own (docs/DESIGN.md, "Buildings and research that answer the systems"; the owner's word,
 * 16 November 2026). Every nation has a study that only it can learn and that fits what it is: the Franks their
 * families, the Babylonians their law, the Malians their trade, the Kushites their bows, the Romans their walls.
 * Each has a job in a system that already runs, and is a rule about the people more than a sharper sword.
 *
 * A nation's own study is a study like any other (studies.ts): an entry in TECHS with `answers`, taught at the
 * Town Center, learned on the map in a town where one stands, known in a visit or a battle and brought home, and
 * chosen by a computer-led people by what presses on it. All of that is studies.ts's. What is here is the two
 * things that make it a nation's own: who may learn it (its entry's `civ`: `mayLearn`, which studies.ts's
 * `studyBar` and the game's research both ask), and what it does on the map. Each system it answers asks here in
 * one call (`birthPace`, `unrestEase`, `defenceAdd`, ...) and is told 1, or 0, for a people that has not learned it.
 *
 * Every figure here is a first guess, as are the costs and ages in data.ts.
 */
import type { Campaign } from './campaign';
import { TECHS } from './data';
import type { TechDef } from './data';
import { hasStudy } from './studies';
import { folkOf } from './township';

export const OWN = {
  /** Franks, Kinship: their couples raise children this much sooner. */
  kinship: 1.2,
  /** Babylonians, the King's Code: a taken town's resentment eases this much more a season, and unrest is this likely. */
  code: 2, codeUnrest: 0.8,
  /** Persians, Satrapies: a town they take resents it this much less to begin with, and eases this much more a season. */
  satrapStart: 15, satrapEase: 1,
  /** Greeks, the Assembly: unrest is this likely in their towns. */
  assembly: 0.6,
  /** Malians, Caravans: gold each of their towns brings in a season. Egyptians, the Flood Calendar: food each of their farmed towns does. */
  caravans: 12, flood: 20,
  /** Kushites, the Land of the Bow: defence added to every town of theirs with men in it. Romans, Great Walls: added to a Fortress. */
  bow: 1.5, walls: 2,
  /** English, Yeomanry: how much better a town of theirs stands against a band. */
  yeomen: 1.25,
  /** Mongols, Remounts: seasons fewer an army of theirs rests after it storms a town. */
  remounts: 2,
  /** Chinese, Examinations: how much faster their governors finish what is building. */
  examinations: 1.5,
  /** Abbasids, Caravanserais: how likely highwaymen are to meet a convoy of theirs, against anyone else's. */
  caravanserai: 0.4,
  /** Japanese, the Bond of Service: how much faster their nobles' moods ease. */
  bond: 1.5,
  /** Arameans, Schools of the Prophets: piety a town of theirs with a church gains each season besides. */
  schools: 1,
};

/** Every study that is one nation's own. */
export const ownStudies = (): TechDef[] => Object.values(TECHS).filter((t) => !!t.civ);
/** The studies that are this people's own. */
export const studiesOf = (civ: string): TechDef[] => ownStudies().filter((t) => t.civ === civ);
/** Whose a study is: its nation's id, or nothing if it is anyone's to learn. */
export const nationOf = (id: string): string | undefined => TECHS[id]?.civ;
/** May a people of this nation learn this study at all? Anyone may learn a study that is no nation's own. */
export const mayLearn = (civ: string, id: string): boolean => { const own = nationOf(id); return !own || own === civ; };
/** Has this people learned this study of its own? (studies.ts keeps what a nation has learned.) */
export const knows = (c: Campaign, f: number, id: string): boolean => f >= 0 && !!c.factions[f] && nationOf(id) === c.factions[f].civ && hasStudy(c, f, id);
const at = (c: Campaign, tid: number, id: string): boolean => { const t = c.territories[tid]; return !!t && t.owner >= 0 && !t.horde && knows(c, t.owner, id); };

// ---- What each study is worth to the system it answers: 1 (or 0) for a people that has not learned it. ----

/** seasonfolk.ts: how much sooner a town's couples raise a child. */
export const birthPace = (c: Campaign, tid: number): number => (at(c, tid, 'own_kinship') ? OWN.kinship : 1);
/** conquered.ts: what a season of this people's rule takes off a taken town's resentment besides. */
export const yokeEase = (c: Campaign, tid: number): number => (at(c, tid, 'own_code') ? OWN.code : 0) + (at(c, tid, 'own_satrapies') ? OWN.satrapEase : 0);
/** conquered.ts: how much less a town resents being taken by this people, from the first. */
export const yokeSpared = (c: Campaign, taker: number): number => (knows(c, taker, 'own_satrapies') ? OWN.satrapStart : 0);
/** unrest.ts: how likely unrest is in a town, against a people without the study. */
export const unrestEase = (c: Campaign, tid: number): number => (at(c, tid, 'own_assembly') ? OWN.assembly : 1) * (at(c, tid, 'own_code') ? OWN.codeUnrest : 1);
/** campaign.ts, a land's defence: what the study adds. */
export function defenceAdd(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  return (at(c, tid, 'own_bow') && folkOf(c, tid).men > 0 ? OWN.bow : 0) + (at(c, tid, 'own_walls') && t.buildings.includes('fortress') ? OWN.walls : 0);
}
/** threats.ts: how much better a town stands against a band. */
export const bandStand = (c: Campaign, tid: number): number => (at(c, tid, 'own_yeomen') ? OWN.yeomen : 1);
/** campaign.ts: seasons fewer an army of this people rests after storming a town. */
export const restSpared = (c: Campaign, f: number): number => (knows(c, f, 'own_remounts') ? OWN.remounts : 0);
/** governor.ts: how much faster what is building in a town is finished. */
export const buildPace = (c: Campaign, tid: number): number => (at(c, tid, 'own_examinations') ? OWN.examinations : 1);
/** convoys.ts: how likely highwaymen are to meet this people's convoy, against anyone else's. */
export const roadRisk = (c: Campaign, f: number): number => (knows(c, f, 'own_caravanserai') ? OWN.caravanserai : 1);
/** nobles.ts: how much faster this people's nobles' moods ease. */
export const moodEase = (c: Campaign, f: number): number => (knows(c, f, 'own_bond') ? OWN.bond : 1);
/** floods.ts: does this town's people keep the Flood Calendar, and read the river? */
export const floodWise = (c: Campaign, tid: number): boolean => at(c, tid, 'own_flood');
/** townfaith.ts: piety a town gains each season besides. */
export const faithPull = (c: Campaign, tid: number): number => (at(c, tid, 'own_schools') && c.territories[tid].buildings.includes('church') ? OWN.schools : 0);
/** country.ts: does thin country cost this town nothing? */
export const thinCountrySpared = (c: Campaign, tid: number): boolean => at(c, tid, 'own_winter');

/**
 * A season of what the studies bring in by themselves: the Malians' caravans, gold to every town; the
 * Egyptians' flood, food to every farmed town. Returns the goods brought in, all told.
 */
export function ownStudiesSeason(c: Campaign): number {
  let n = 0;
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive) continue;
    if (at(c, t.id, 'own_caravans')) { folkOf(c, t.id).stores.gold += OWN.caravans; n += OWN.caravans; }
    if (at(c, t.id, 'own_flood') && t.buildings.includes('farm')) { folkOf(c, t.id).stores.food += OWN.flood; n += OWN.flood; }
  }
  return n;
}
/** The building in a town where a people's own study is researched. */
export const STUDY_HALL = 'towncenter';
/** What can be researched at a building by a people of this nation: what the building lists, and at the Town Center the nation's own. */
export function researchAt(building: string, civ: string, listed: readonly string[]): string[] {
  return building === STUDY_HALL ? [...listed, ...studiesOf(civ).map((t) => t.id).filter((id) => !listed.includes(id))] : [...listed];
}
