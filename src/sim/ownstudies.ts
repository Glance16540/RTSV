/**
 * Each people its own (docs/DESIGN.md, "Buildings and research that answer the systems"; the owner's word,
 * 16 November 2026). Every nation has a study that only it can learn and that fits what it is: the Franks their
 * families, the Babylonians their law, the Malians their trade, the Kushites their bows, the Romans their walls.
 * Each has a job in a system that already runs, and is a rule about the people more than a sharper sword.
 *
 * On the map a nation learns its study once, for supplies paid in gold, when it has reached the study's age (`learn`); it is
 * kept on the nation (`Faction.studies`) and from then on the system it answers asks here what it is worth
 * (`birthPace`, `unrestEase`, `defenceAdd`, ...). Each of those is one call in that system and answers 1, or 0,
 * for a people that has not learned it. In a town the same study is in the research list of the Town Center for
 * that nation alone (`TECHS` in data.ts has an entry of the same id, marked with its nation), and a nation that
 * has learned it on the map begins a battle or a visit with it (`knownIn`).
 *
 * Every figure here is a first guess: the costs, the ages and how much each study does.
 */
import type { Campaign } from './campaign';
import { ageOf } from './campaignbase';
import { canPayFor, payFor } from './prices';
import { folkOf } from './township';

declare module './campaign' {
  interface Faction { /** The studies of its own this people has learned (ownstudies.ts). */ studies?: string[] }
}

/** A study of one people's own: who may learn it, what it costs in supplies on the map, the age it needs, and what it does there, in words. */
export interface OwnStudy { id: string; civ: string; name: string; icon: string; cost: number; age: number; map: string }
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
  /** A rival learns its study when it has this many supplies over the price. */
  reserve: 14,
};
export const OWN_STUDIES: OwnStudy[] = [
  { id: 'own_kinship', civ: 'hearth', name: 'Kinship', icon: '👪', cost: 6, age: 1, map: 'Their couples raise children a fifth sooner.' },
  { id: 'own_code', civ: 'babylon', name: "The King's Code", icon: '📜', cost: 7, age: 1, map: 'A town they have taken settles sooner under written law, and unrest is a fifth less likely in all their towns.' },
  { id: 'own_caravans', civ: 'mali', name: 'Caravans', icon: '🐪', cost: 7, age: 1, map: 'Every town of theirs brings in 12 gold a season from the trade roads.' },
  { id: 'own_bow', civ: 'kush', name: 'The Land of the Bow', icon: '🏹', cost: 6, age: 1, map: 'Every town of theirs with men in it is harder to take: its people shoot from the walls.' },
  { id: 'own_walls', civ: 'stonekin', name: 'Great Walls', icon: '🧱', cost: 8, age: 1, map: 'A Fortress of theirs is worth 2 more defence.' },
  { id: 'own_remounts', civ: 'steppe', name: 'Remounts', icon: '🐎', cost: 6, age: 1, map: 'An army of theirs that has stormed a town rests two seasons fewer before it marches again.' },
  { id: 'own_examinations', civ: 'forge', name: 'Examinations', icon: '🖌️', cost: 7, age: 2, map: 'Their governors are chosen for merit: what is building in a town left to itself is finished half as fast again.' },
  { id: 'own_flood', civ: 'egypt', name: 'The Flood Calendar', icon: '🌾', cost: 6, age: 1, map: 'Every town of theirs with Farmland brings in 20 more food a season.' },
  { id: 'own_satrapies', civ: 'persia', name: 'Satrapies', icon: '🦁', cost: 7, age: 1, map: 'A town they take keeps its own ways under a governor: it resents them less from the first, and settles sooner.' },
  { id: 'own_assembly', civ: 'greece', name: 'The Assembly', icon: '🏛️', cost: 6, age: 1, map: 'Their towns speak for themselves: unrest is two fifths less likely.' },
  { id: 'own_yeomen', civ: 'england', name: 'Yeomanry', icon: '🎯', cost: 6, age: 1, map: 'Every man practises at the butts: a town of theirs stands a quarter better against raiders, slavers and pirates.' },
  { id: 'own_caravanserai', civ: 'arabs', name: 'Caravanserais', icon: '🕌', cost: 6, age: 1, map: 'Their convoys rest behind walls on the road: highwaymen meet them far less often.' },
  { id: 'own_bond', civ: 'japan', name: 'The Bond of Service', icon: '⛩️', cost: 7, age: 2, map: 'Their nobles are bound to their lord: an angry noble comes round half as fast again.' },
  { id: 'own_schools', civ: 'dawn', name: 'Schools of the Prophets', icon: '🕯️', cost: 6, age: 1, map: 'A town of theirs with a church grows more pious each season.' },
  { id: 'own_winter', civ: 'wild', name: 'Winter Stores', icon: '❄️', cost: 5, age: 0, map: 'They know how to live in thin country: snow and desert cost their towns nothing.' },
];
/** What a study is paid in on the map: gold, as a dealing is (prices.ts). Not bread: a people does not go hungry to learn. */
const PAID_AS = 'dealing';
const BY_ID = new Map(OWN_STUDIES.map((s) => [s.id, s]));

/** The studies that are this people's own. */
export const studiesOf = (civ: string): OwnStudy[] => OWN_STUDIES.filter((s) => s.civ === civ);
/** Whose a study is: its nation's id, or nothing if it is anyone's to learn. */
export const nationOf = (id: string): string | undefined => BY_ID.get(id)?.civ;
/** May a people of this nation learn this study at all? Anyone may learn a study that is no nation's own. */
export const mayLearn = (civ: string, id: string): boolean => { const own = nationOf(id); return !own || own === civ; };
/** Has this people learned this study? */
export const knows = (c: Campaign, f: number, id: string): boolean => f >= 0 && !!c.factions[f]?.studies?.includes(id) && nationOf(id) === c.factions[f].civ;
const at = (c: Campaign, tid: number, id: string): boolean => { const t = c.territories[tid]; return !!t && t.owner >= 0 && !t.horde && knows(c, t.owner, id); };
/** What a people has learned, made safe: only studies that are its own, each once. */
export function learnedBy(c: Campaign, f: number): string[] {
  const fac = c.factions[f];
  if (!fac || !Array.isArray(fac.studies)) return [];
  return [...new Set(fac.studies.filter((id) => typeof id === 'string' && nationOf(id) === fac.civ))];
}
/** The studies a people begins a battle or a visit with: what it has learned on the map. */
export const knownIn = (c: Campaign, f: number): string[] => (f >= 0 ? learnedBy(c, f) : []);

/** Can this people learn this study on the map now? It must be its own, not yet learned, of its age, and paid for. */
export function canLearn(c: Campaign, f: number, id: string): boolean {
  const s = BY_ID.get(id), fac = c.factions[f];
  return !!s && !!fac && fac.alive && s.civ === fac.civ && !knows(c, f, id) && ageOf(c, f) >= s.age && canPayFor(c, f, PAID_AS, s.cost);
}
/** Why it cannot, in words; nothing if it can. */
export function cannotLearn(c: Campaign, f: number, id: string): string {
  const s = BY_ID.get(id), fac = c.factions[f];
  if (!s || !fac || s.civ !== fac.civ) return 'Not a study of this people.';
  if (knows(c, f, id)) return 'Already learned.';
  if (ageOf(c, f) < s.age) return 'Needs a later age.';
  return canPayFor(c, f, PAID_AS, s.cost) ? '' : `Needs ${s.cost} supplies.`;
}
/** Learn a study on the map: paid for in gold out of the nation's towns, and kept for good. */
export function learn(c: Campaign, f: number, id: string): boolean {
  if (!canLearn(c, f, id)) return false;
  const s = BY_ID.get(id)!, fac = c.factions[f];
  payFor(c, f, PAID_AS, s.cost);
  fac.studies = [...learnedBy(c, f), id];
  c.log.push(`${f === 0 ? 'Your people have' : `${fac.name} have`} learned ${s.name}. ${s.map}`);
  return true;
}
/** A study learned inside a battle or a visit is the nation's from then on: nothing more is paid. Returns those newly kept. */
export function keepLearned(c: Campaign, f: number, ids: unknown): string[] {
  const fac = c.factions[f], out: string[] = [];
  if (!fac || !Array.isArray(ids)) return out;
  for (const id of ids) if (typeof id === 'string' && nationOf(id) === fac.civ && !knows(c, f, id)) { fac.studies = [...learnedBy(c, f), id]; out.push(id); }
  return out;
}
/** A computer-led people learns what is its own when it can well afford it. Returns what it learned. */
export function rivalLearns(c: Campaign, f: number): string[] {
  const fac = c.factions[f], out: string[] = [];
  if (!fac || !fac.alive) return out;
  for (const s of studiesOf(fac.civ)) if ((fac.supplies ?? 0) >= s.cost + OWN.reserve && learn(c, f, s.id)) out.push(s.id);
  return out;
}

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
/** The studies of a people as its nation panel lists them: each with whether it is learned, can be, and why not. */
export function studyList(c: Campaign, f: number): { study: OwnStudy; learned: boolean; can: boolean; why: string }[] {
  const fac = c.factions[f];
  return fac ? studiesOf(fac.civ).map((study) => ({ study, learned: knows(c, f, study.id), can: canLearn(c, f, study.id), why: cannotLearn(c, f, study.id) })) : [];
}

/** The building in a town where a people's own study is researched. */
export const STUDY_HALL = 'towncenter';
/** What can be researched at a building by a people of this nation: what the building lists, and at the Town Center the nation's own. */
export function researchAt(building: string, civ: string, listed: readonly string[]): string[] {
  return building === STUDY_HALL ? [...listed, ...studiesOf(civ).map((s) => s.id).filter((id) => !listed.includes(id))] : [...listed];
}
/** Of what a side has researched in a town, the studies that are its own nation's: what goes home to the map with it. */
export const ownAmong = (techs: Iterable<string>, civ: string): string[] => [...techs].filter((id) => nationOf(id) === civ);
