// A nation's studies on the map (docs/DESIGN.md, "Buildings and research that answer the systems").
//
// Research has lived inside a battle (`Player.techs`). A study that answers a system (hunger, plague, unrest, plots,
// nobles, faith...) is the nation's, and kept on the map: `Faction.studies`, a list of ids from TECHS. What makes a
// tech such a study is its own entry: `answers` names what it answers, and the building that teaches it is the one
// whose `techs` list has it (or `taughtAt`). Each session that adds studies adds only its own TECHS entries; nothing
// here lists them.
//
//   Learning on the map. A study can be learned in a town of the nation where the building that teaches it stands
//   finished on the town's record, once the nation has reached its age and anything it requires; it is paid in
//   goods, from that town's stores first and then from the nation's other towns, the one with most of each kind first.
//   Learning in a town. In a visit or a battle the nation's studies are known from the start (Game setup
//   `bonus.studies`: `withStudies`), and any study researched there comes home (`learnedIn`, `studiedHome`).
//   The computer. Each season a rival nation learns at most one study, the one answering what presses most on its
//   towns, if it can pay for it and keep a working stock (KEEP) in its towns. The player's are the player's own
//   choice: the governor learns none for them.
import type { Campaign } from './campaign';
import { BUILDINGS, TECHS } from './data';
import type { TechDef } from './data';
import { STORE_KINDS, folkOf } from './township';
import { ageOf } from './campaignbase';
import { nationCanSpare } from './plenty';

declare module './campaign' {
  interface Faction {
    /** The studies the nation has learned (studies.ts). */
    studies?: string[];
  }
}

/** Gold under which a town is short of it, for a study that answers trade. */
export const TRADE_SHORT = 100;
/** Goods a nation keeps in each of its towns, beyond which a rival will pay for a study. */
export const STUDY_KEEP = 600;

/** Is this tech a study of the nation's, kept on the map? */
export const isStudy = (id: string): boolean => !!TECHS[id]?.answers;
/** Every study there is. */
export const allStudies = (): TechDef[] => Object.values(TECHS).filter((t) => !!t.answers);
/** The building that teaches a study. */
export function teacherOf(id: string): string | undefined {
  const t = TECHS[id];
  if (!t) return undefined;
  return t.taughtAt ?? Object.values(BUILDINGS).find((b) => b.techs.includes(id))?.id;
}
/** The studies a nation has learned. */
export const studiesOf = (c: Campaign, f: number): string[] => (Array.isArray(c.factions[f]?.studies) ? c.factions[f].studies!.filter(isStudy) : []);
/** Has the nation learned this study? */
export const hasStudy = (c: Campaign, f: number, id: string): boolean => studiesOf(c, f).includes(id);

/** Is a building of this type standing finished on the town's record? */
export const standsAt = (c: Campaign, tid: number, type: string): boolean => !!c.territories[tid]?.town?.b?.some((x) => x[0] === type && x[4] === undefined);
const towns = (c: Campaign, f: number): number[] => c.territories.filter((t) => t.owner === f && !t.horde).map((t) => t.id);

/** What the nation's towns hold, all told, of each kind. */
function held(c: Campaign, f: number): Record<string, number> {
  const out: Record<string, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const tid of towns(c, f)) for (const k of STORE_KINDS) out[k] += Math.max(0, folkOf(c, tid).stores[k]);
  return out;
}

/** Why the nation cannot learn this study in this town now, or '' if it can. */
export function studyBar(c: Campaign, f: number, id: string, at: number): string {
  const t = TECHS[id], land = c.territories[at];
  if (!t || !isStudy(id)) return 'There is no such study.';
  if (!land || land.owner !== f || land.horde) return 'Only in a town of your own.';
  if (t.civ && t.civ !== c.factions[f]?.civ) return 'A study of another people alone.'; // each people its own (ownstudies.ts)
  if (hasStudy(c, f, id)) return 'Already learned.';
  if (ageOf(c, f) < t.age) return `It needs the nation in a later age.`;
  if (t.requires && !hasStudy(c, f, t.requires) && isStudy(t.requires)) return `It needs ${TECHS[t.requires].name} first.`;
  const teacher = teacherOf(id);
  if (!teacher || !standsAt(c, at, teacher)) return `It is taught at a ${BUILDINGS[teacher ?? '']?.name ?? 'building'} standing in the town.`;
  const have = held(c, f);
  for (const k of STORE_KINDS) if ((t.cost[k] ?? 0) > have[k]) return `It costs ${STORE_KINDS.filter((x) => t.cost[x]).map((x) => `${t.cost[x]} ${x}`).join(', ')}.`;
  return '';
}

/** Take a cost out of the nation's towns: this town first, then the town with most of each kind. */
function pay(c: Campaign, f: number, cost: Partial<Record<string, number>>, first: number): void {
  for (const k of STORE_KINDS) {
    let want = cost[k] ?? 0;
    const order = [first, ...towns(c, f).filter((x) => x !== first).sort((a, b) => folkOf(c, b).stores[k] - folkOf(c, a).stores[k] || a - b)];
    for (const tid of order) { if (want <= 0) break; const s = folkOf(c, tid).stores, take = Math.min(Math.max(0, s[k]), want); s[k] -= take; want -= take; }
  }
}

/** Learn a study in this town, paying for it. Returns '' when learned, or why not. */
export function learn(c: Campaign, f: number, id: string, at: number): string {
  const bar = studyBar(c, f, id, at);
  if (bar) return bar;
  pay(c, f, TECHS[id].cost, at);
  (c.factions[f].studies ??= []).push(id);
  if (f === 0) c.log.push(`${TECHS[id].name} is learned in ${c.territories[at].name}: ${TECHS[id].desc}`);
  return '';
}

/**
 * A battle's side begins with what its nation has learned, as a visit's does: the setup's `bonus` with the nation's
 * studies on it (`Game` reads `bonus.studies`). A side that is no nation's (a tribe, a band) has none.
 */
export const withStudies = <B extends object>(c: Campaign, f: number, bonus: B): B & { studies: string[] } => ({ ...bonus, studies: f >= 0 ? studiesOf(c, f) : [] });
/** The studies among the techs a side ended a battle or visit with. */
export const learnedIn = (techs: Iterable<string>): string[] => [...techs].filter(isStudy);
/** Studies learned in a town come home to the nation. Whatever a saved game or the page sends, only studies count. */
export function studiedHome(c: Campaign, f: number, ids: unknown): string[] {
  if (!Array.isArray(ids) || !c.factions[f]) return [];
  const added: string[] = [];
  for (const id of ids) if (typeof id === 'string' && isStudy(id) && !hasStudy(c, f, id)) { (c.factions[f].studies ??= []).push(id); added.push(id); }
  if (f === 0 && added.length) c.log.push(`Learned in the town and known now to the whole nation: ${added.map((id) => TECHS[id].name).join(', ')}.`);
  return added;
}

/** How much what a study answers presses on a nation's towns now, 0 to 1. */
export function pressing(c: Campaign, f: number, answers: string): number {
  const mine = towns(c, f);
  if (!mine.length) return 0;
  const share = (p: (tid: number) => boolean): number => mine.filter(p).length / mine.length;
  const event = (tid: number, kinds: string[]): boolean => (c.events ?? []).some((e) => e.at === tid && kinds.includes(e.kind) && e.until >= c.turn - 1);
  switch (answers) {
    case 'hunger': return share((tid) => !!folkOf(c, tid).hungry || event(tid, ['famine']));
    case 'plague': return share((tid) => event(tid, ['plague']));
    case 'unrest': return share((tid) => event(tid, ['unrest', 'revolt']) || (c.territories[tid].yoke?.resent ?? 0) > 0);
    case 'raids': case 'crime': return share((tid) => event(tid, ['raid', 'carried']));
    case 'faith': return Math.max(0, Math.min(1, -(c.factions[f].virtue ?? 0) / 50));
    case 'nobles': case 'plots': case 'rule': return share((tid) => (folkOf(c, tid).drift?.strain ?? 0) > 0.25);
    case 'births': return share((tid) => { const k = folkOf(c, tid); return (Math.min(k.men, k.women) > 0 && k.children < Math.min(k.men, k.women)) || (k.missed ?? 0) > 0; }); // towns with fewer children than couples, or births that did not come (seasonfolk.ts: Midwifery)
    case 'trade': return share((tid) => folkOf(c, tid).stores.gold < TRADE_SHORT); // towns short of gold
    case 'roads': return share((tid) => (c.bands ?? []).some((b) => b.kind === 'highwaymen' && (b.at === tid || b.to === tid))); // towns at an end of a road highwaymen hold (threats.ts: Paved Roads)
    default: return 0;
  }
}

/** A season for one rival nation's studies: it learns the one answering what presses most, if it can pay and keep a working stock. */
export function studySeason(c: Campaign, f: number): string | null {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI || !allStudies().length) return null;
  let best: { id: string; at: number; need: number } | null = null;
  for (const t of allStudies()) {
    if (hasStudy(c, f, t.id)) continue;
    const need = pressing(c, f, t.answers!);
    if (need <= 0 || (best && need <= best.need)) continue;
    const at = towns(c, f).find((tid) => studyBar(c, f, t.id, tid) === '');
    if (at === undefined) continue;
    if (!nationCanSpare(c, f, at, t.cost)) continue; // plenty.ts, one rule for every purchase
    best = { id: t.id, at, need };
  }
  if (!best) return null;
  return learn(c, f, best.id, best.at) === '' ? best.id : null;
}
/** A season for every rival nation's studies. */
export function studiesSeason(c: Campaign): void {
  for (const x of c.factions) studySeason(c, x.id);
}
