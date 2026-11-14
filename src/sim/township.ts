/**
 * Towns that keep their people and their stores (docs/DESIGN.md, step 2).
 * Every land has a real town. Its people are kept as counts by kind (men, women, elders, and the children on the
 * houses' records), its notable people by name, and its stores of food, wood, gold and stone. A battle fought in
 * person over the land is fought by those people out of those stores, and what is left of both when it ends is
 * what the town has from then on: who lived, who died, who was taken, what was gathered and spent.
 * A town is founded the first time it is asked for, so a campaign saved before this still loads.
 */
import type { Campaign } from './campaign';

export interface Stores { food: number; wood: number; gold: number; stone: number }
export const STORE_KINDS = ['food', 'wood', 'gold', 'stone'] as const;
/**
 * Someone the nation remembers by name: a soldier who rose through veterancy, or a woman whose home produced most.
 * `lost`: they are gone, and when and how; the record of them is kept.
 */
export interface Notable {
  name: string; family?: string; gender: 'm' | 'f'; kind: 'veteran' | 'mother';
  /** What they are remembered for, in words. */
  deed: string;
  /** The turn they earned the name. */
  turn: number;
  kills?: number; kids?: number; unit?: string;
  lost?: { turn: number; how: string };
}
/** A town's people and stores between seasons. `men` and `women` are of working age; `children` are records only. */
export interface Folk { men: number; women: number; elders: number; children: number; stores: Stores; notables: Notable[] }
/** A villager a battle knows by name: who they are and how many children they have raised. */
export interface Named { name: string; family?: string; gender: 'm' | 'f'; kids?: number }
/** What a town sends into a battle (`PlayerSetup.bonus.people`): its people, the notable among them by name. */
export interface PeopleIn { men: number; women: number; elders: number; children: number; named?: Named[] }
/** What a battle hands back for the side that held the town (`Game.census`). `taken`: its people held captive as it ended. */
export interface Census { men: number; women: number; elders: number; children: number; stores: Stores; taken?: number; named?: Named[] }

/** The most people of one kind a town is kept at, and the most of any one store. */
export const MAX_KIND = 60;
export const MAX_STORE = 20000;
/** Children a woman must have raised for the nation to remember her, and kills for a soldier (as champion.ts). */
export const MOTHER_KIDS = 3;
/** The share of its men a town loses to a battle it was not seen to fight, held or taken; and of its stores when taken. */
export const TOLL = { held: 0.15, taken: 0.3, looted: 0.5 };
/** Notable people a town keeps the record of. */
export const MAX_NOTABLES = 24;

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const whole = (v: unknown, max: number): number => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const text = (v: unknown, n = 40): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');

/** A town as it is first found: a few households, more in a capital, and what a town starts a season with in store. */
export function foundFolk(c: Campaign, tid: number): Folk {
  const t = c.territories[tid], r = (k: number): number => hash(c.seed * 31 + tid, k);
  const chief = t.capital >= 0 ? 2 : 0;
  return {
    men: 2 + Math.floor(r(1) * 3) + chief, women: 2 + Math.floor(r(2) * 3) + chief, elders: Math.floor(r(3) * 3), children: 1 + Math.floor(r(4) * 4) + chief,
    stores: { food: 200 + (t.buildings.includes('farm') ? 150 : 0), wood: 200, gold: 100, stone: 100 },
    notables: [],
  };
}
/** The town on a land, founded if this is the first anyone has asked after it. */
export function folkOf(c: Campaign, tid: number): Folk {
  const t = c.territories[tid];
  return (t.folk ??= foundFolk(c, tid));
}
/** Grown people in a town, and everyone in it. */
export const grown = (f: Folk): number => f.men + f.women + f.elders;
export const headcount = (f: Folk): number => grown(f) + f.children;
/** The notable people of a town who are still with it. */
export const living = (f: Folk): Notable[] => f.notables.filter((n) => !n.lost);

/** A nation's stores are the sum of its towns'. (The map still spends supplies: see scripts/systems.mjs.) */
export function nationStores(c: Campaign, f: number): Stores {
  const sum: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const t of c.territories) if (t.owner === f) for (const k of STORE_KINDS) sum[k] += folkOf(c, t.id).stores[k];
  return sum;
}
/** A nation's people, town by town added up. */
export function nationPeople(c: Campaign, f: number): { men: number; women: number; elders: number; children: number; all: number } {
  const sum = { men: 0, women: 0, elders: 0, children: 0, all: 0 };
  for (const t of c.territories) if (t.owner === f) { const k = folkOf(c, t.id); sum.men += k.men; sum.women += k.women; sum.elders += k.elders; sum.children += k.children; sum.all += headcount(k); }
  return sum;
}
/** Every notable person of a nation still living, with the town they belong to. */
export const nationNotables = (c: Campaign, f: number): { at: number; who: Notable }[] =>
  c.territories.filter((t) => t.owner === f).flatMap((t) => living(folkOf(c, t.id)).map((who) => ({ at: t.id, who })));

/** What a town sends into a battle fought over it: all its people and all its stores. */
export function musterFolk(c: Campaign, tid: number): { people: PeopleIn; stores: Stores } {
  const f = folkOf(c, tid);
  const named = living(f).filter((n) => n.kind === 'mother').map((n): Named => ({ name: n.name, gender: n.gender, ...(n.family ? { family: n.family } : {}), ...(n.kids ? { kids: n.kids } : {}) }));
  return { people: { men: f.men, women: f.women, elders: f.elders, children: f.children, ...(named.length ? { named } : {}) }, stores: { ...f.stores } };
}

/** Make safe a count of a town handed back from a battle. Nothing if it is not one. */
export function cleanCensus(x: Partial<Census> | null | undefined): Census | undefined {
  if (!x || typeof x !== 'object' || !x.stores || typeof x.stores !== 'object') return undefined;
  const named = (Array.isArray(x.named) ? x.named : []).filter((n) => n && typeof n === 'object' && text(n.name)).slice(0, 40)
    .map((n): Named => ({ name: text(n.name), gender: n.gender === 'm' ? 'm' : 'f', ...(text(n.family) ? { family: text(n.family) } : {}), kids: whole(n.kids, 99) }));
  return {
    men: whole(x.men, MAX_KIND), women: whole(x.women, MAX_KIND), elders: whole(x.elders, MAX_KIND), children: whole(x.children, MAX_KIND), taken: whole(x.taken, MAX_KIND * 3),
    stores: { food: whole(x.stores.food, MAX_STORE), wood: whole(x.stores.wood, MAX_STORE), gold: whole(x.stores.gold, MAX_STORE), stone: whole(x.stores.stone, MAX_STORE) },
    named,
  };
}

const remember = (f: Folk, n: Notable): void => { f.notables.push(n); if (f.notables.length > MAX_NOTABLES) f.notables.splice(f.notables.findIndex((x) => x.lost) >= 0 ? f.notables.findIndex((x) => x.lost) : 0, 1); };
const chronicle = (c: Campaign, line: string): void => { (c.chronicle ??= []).push({ turn: c.turn, text: line }); };

export interface Reckoning { before: number; after: number; taken: number; lost: Notable[]; made: Notable[] }
/**
 * A battle was fought in person over a town: write back what is left of it. `census` is the count of the side that
 * held the town as the battle ended. Those who are neither there nor held captive are dead. A notable woman who is
 * not among those counted is lost; a woman who has raised enough children is remembered from now on.
 */
export function settleFolk(c: Campaign, tid: number, census: Census, opts: { taken?: boolean } = {}): Reckoning {
  const t = c.territories[tid], f = folkOf(c, tid), before = headcount(f);
  f.men = census.men; f.women = census.women; f.elders = census.elders; f.children = census.children;
  f.stores = { ...census.stores };
  const here = new Map((census.named ?? []).map((n) => [n.name, n]));
  const lost: Notable[] = [], made: Notable[] = [];
  for (const n of living(f)) {
    if (n.kind !== 'mother') continue;
    const now = here.get(n.name);
    if (now) { n.kids = Math.max(n.kids ?? 0, now.kids ?? 0); n.deed = `raised ${n.kids} children`; continue; }
    n.lost = { turn: c.turn, how: census.taken ? 'killed or carried off' : 'killed' };
    lost.push(n);
  }
  for (const n of census.named ?? []) {
    if (n.gender !== 'f' || (n.kids ?? 0) < MOTHER_KIDS || living(f).some((x) => x.name === n.name)) continue;
    const who: Notable = { name: n.name, gender: 'f', kind: 'mother', kids: n.kids, deed: `raised ${n.kids} children`, turn: c.turn, ...(n.family ? { family: n.family } : {}) };
    remember(f, who); made.push(who);
  }
  const after = headcount(f), taken = census.taken ?? 0, mine = t.owner === 0;
  const whose = mine ? 'your people' : 'the people';
  if (before !== after || taken) {
    const dead = Math.max(0, before - after - taken);
    const parts = [dead ? `${dead} died` : '', taken ? `${taken} ${taken === 1 ? 'was' : 'were'} carried off` : '', after > before ? `${after - before} more were born or came of age` : ''].filter(Boolean);
    if (parts.length) c.log.push(`Of ${whose} at ${t.name}, ${parts.join(' and ')}: ${after} remain${after === 1 ? 's' : ''}.`);
  }
  for (const n of lost) { c.log.push(`${n.name} of ${t.name}, who ${n.deed}, is lost.`); chronicle(c, `${n.name} of ${t.name}, who ${n.deed}, was ${n.lost!.how} when the town was fought over.`); }
  for (const n of made) { c.log.push(`${n.name} of ${t.name} has ${n.deed}, and her name is known.`); chronicle(c, `${n.name} of ${t.name} ${n.deed}, and was known for it through the land.`); }
  // An empty town does not stay empty: those who followed the army that took it make their homes there.
  if (opts.taken && f.men + f.women === 0) { f.men = 2; f.women = 2; c.log.push(`Nobody was left alive in ${t.name}. Four who followed the army have settled there.`); }
  return { before, after, taken, lost, made };
}

/** A soldier who made a name in a battle is remembered in the town named: once, with the most they ever did. */
export function rememberVeteran(c: Campaign, tid: number, who: { name: string; kills: number; unit?: string; female?: boolean }): Notable | undefined {
  if (!text(who.name)) return undefined;
  const f = folkOf(c, tid), had = f.notables.find((n) => n.kind === 'veteran' && n.name === who.name && !n.lost);
  const deed = `felled ${who.kills} in battle as ${/^[aeiou]/i.test(who.unit ?? '') ? 'an' : 'a'} ${(who.unit ?? 'soldier').toLowerCase()}`;
  if (had) { if (who.kills > (had.kills ?? 0)) { had.kills = who.kills; had.deed = deed; } return had; }
  const n: Notable = { name: text(who.name), gender: who.female ? 'f' : 'm', kind: 'veteran', kills: who.kills, deed, turn: c.turn, ...(who.unit ? { unit: text(who.unit, 30) } : {}) };
  remember(f, n);
  chronicle(c, `${n.name} of ${c.territories[tid].name} ${deed}, and was known for it through the land.`);
  return n;
}
/** A veteran of this nation who is no longer with the army is lost to the town that remembered them. */
export function loseVeteran(c: Campaign, f: number, name: string, how = 'fell in battle'): void {
  for (const t of c.territories) {
    if (t.owner !== f || !t.folk) continue;
    const n = t.folk.notables.find((x) => x.kind === 'veteran' && x.name === name && !x.lost);
    if (!n) continue;
    n.lost = { turn: c.turn, how };
    c.log.push(`${n.name} of ${t.name}, who ${n.deed}, ${how}.`);
    chronicle(c, `${n.name} of ${t.name}, who ${n.deed}, ${how}.`);
    return;
  }
}

/**
 * A battle nobody watched: the town pays for it by rule. Its men fall, more of them if it is taken, and a town
 * taken is looted of half its stores. (Step 4 of the design replaces this with the town defending itself.)
 */
export function tollFolk(c: Campaign, tid: number, taken: boolean): number {
  const f = folkOf(c, tid), dead = Math.min(f.men, Math.ceil(f.men * (taken ? TOLL.taken : TOLL.held)));
  f.men -= dead;
  if (taken) for (const k of STORE_KINDS) f.stores[k] = Math.floor(f.stores[k] * (1 - TOLL.looted));
  return dead;
}
