// Threats of men on the map (docs/DESIGN.md, step 4): bands that belong to no nation, choose a town and strike it.
//
// WHO. Four kinds of band, each with a place on the map, a strength and people it may be holding:
//   raiders     camp in the wilds (a land of the local tribes next to a held one, or the hills of a held land
//               that has no army). They burn and loot, and carry off women.
//   slavers     camp the same way. They come for people, men and women both, and sell them on.
//   pirates     keep a cove on a coast and reach every held coast. They loot heavily and carry off women.
//   highwaymen  sit on the road between two held lands and rob what passes: stores, never people.
//
// HOW MANY. Threats of men never stop: there is meant to be one about for every six held lands and never fewer
// than one, and one more while any living people is Worldly or Decadent. When there are fewer, a new band appears
// in a season as often as not. A band grows a little with time and with every raid that pays.
//
// THE MARK. Each season a band may strike one held land in its reach. It picks the softest: the town with the
// least defence for what draws it, and a decadent people draws it more (by the same measure as acts of God).
//
// THE TOWN DEFENDS ITSELF with what it has, not with a number set for the land: its grown men, its fortress and
// the works that raise soldiers, the towers and walls standing on its battlefield (by how whole they are), any
// army of its holder there, a capital's guard, and its people's creed, which stiffens or slackens all of it.
// A land with plague in it defends worse. That is weighed against the band and comes out one of three ways:
//   held off    the band is beaten back and weakened; a weak band is broken altogether.
//   raided      men die at the walls, the town's stores are looted, and raiders or pirates may burn a farm.
//   taken       all of that, worse, and people are carried off.
// Children are never killed and never taken: they are records on their houses (docs/DESIGN.md).
//
// THE REPORT. Every strike leaves a report (`Raid`): who struck, where, what the town had to defend with, who
// was killed, who was taken, what was lost, and which way the town's morals swayed. A town that stands together
// is the better for it; one that is sacked loses heart, a decadent one most.
//
// CAPTIVITY. Those taken are held at the band's place, with their ages, since the season they were seized. They
// can be got back for HOLD seasons by breaking the band; after that they are sold on or dead, and lost. Held, they
// age faster: a man about twenty years over the whole time and a woman thirty (as captivity.ts has it in a town).
//
// BREAKING A BAND. An army that stands in the land where a band has its place when the season turns fights it,
// whoever's army it is. This is settled on the map by strength, which is a stopgap: see scripts/systems.mjs.
// A band broken gives up everyone it holds and something of what it stole.
//
// Decided by a run of chances of its own, so the rest of a campaign's luck is left as it was.
import { inAll, strengthOf, whole } from './strengthwords';
import { faithAt, swayTown } from './townfaith';
import type { Army, Campaign, EventKind, Territory } from './campaign';
import { armySize, armyStrength } from './campaignbase';
import { whoseOf } from './naming';
import { creedOf } from './creed';
import { OLD_SEASON, SEASONS_A_YEAR, agesOf, countFrom } from './ageing';
import { STORE_KINDS, TOWN_SCALE, folkOf, living } from './township';
import { THREATS } from './threatsbase';
import { watchDefence } from './townwatch';
import { fortShelter, hasFortress } from './fortress';
import { stoodTo } from './heralds';
import { grudgeWatch } from './oldpeople';
import { wrathAt, wrathOf } from './acts';
import { SUPPLY_UNITS, stock } from './stores';
import { watchOf } from './drift';
import { needOf } from './larder';
import { bandStand } from './ownstudies';

export type BandKind = 'raiders' | 'slavers' | 'pirates' | 'highwaymen' | 'marauders';
/** People a band is holding: where they were taken from, whose they are, their ages when seized, and since when. */
export interface Held {
  from: number; owner: number; men: number[]; women: number[]; since: number; names?: string[];
  /** Children born to the women while held (bandborn.ts): how many of the women have borne one, and the seasons those still with their mothers were born. Records only. */
  bore?: number; kids?: number[];
}
export interface Band {
  id: number; kind: BandKind; name: string;
  /** The land where it has its place; for highwaymen, one end of their road, and `to` is the other. */
  at: number; to?: number;
  strength: number; since: number;
  held: Held[];
  /** The season it last moved its place (bandroam.ts). */
  moved?: number;
  /** The land it has set out for, a few lands off, and is making its way to a land at a time (bandroam.ts). */
  bound?: number;
  /** It was born in the far wilds and is still on its march in (bandwilds.ts). */
  afar?: boolean;
}
export type Outcome = 'held' | 'raided' | 'taken';
/** Something a band did or had done to it that is not a strike: it came, moved, fled, settled, broke up, was fought, lost its captives. */
export interface BandNote { turn: number; kind: 'came' | 'moved' | 'fled' | 'settled' | 'gone' | 'broken' | 'beaten' | 'freed' | 'lost' | 'warned' | 'overran' | 'ambush' | 'seen'; at: number; band: number; text: string; /** The peoples it concerns: whose captives, whose army, whose land. */ owners: number[] }
/** What a town had to defend with, part by part, in the measure of companies. */
export interface Defence { men: number; works: number; walls: number; army: number; guard: number; spirit: number; total: number }
/** The report of one strike. */
export interface Raid {
  turn: number; band: number; kind: BandKind; name: string; at: number; owner: number;
  outcome: Outcome; force: number; defence: Defence;
  killed: number; taken: { men: number; women: number }; names: string[];
  stores: { food: number; wood: number; gold: number; stone: number }; burnt?: string;
  /** Which way the people's standing moved, and by how much (piety up, decadence down). */
  sway: number;
  /** The band was broken in the attempt. */
  broken?: boolean;
}

declare module './campaign' {
  interface Campaign {
    /** Bands that belong to no nation, living on the map (threats.ts). */
    bands?: Band[];
    /** The reports of their strikes, the latest last. */
    raids?: Raid[];
    bandSeq?: number;
    /** What the bands did besides striking, season by season, for the season's news (raidnews.ts). */
    bandNews?: BandNote[];
  }
}

export { THREATS }; // the numbers themselves are in threatsbase.ts, where a system below this one can read them

export const BANDS: Record<BandKind, { name: string; icon: string; place: string; desc: string }> = {
  raiders: { name: 'Raiders', icon: '🔥', place: 'camp', desc: 'They burn and loot, and carry off women.' },
  slavers: { name: 'Slavers', icon: '⛓️', place: 'camp', desc: 'They come for people, men and women both, and sell them on.' },
  pirates: { name: 'Pirates', icon: '🏴‍☠️', place: 'cove', desc: 'They reach every coast, loot heavily, and carry off women.' },
  highwaymen: { name: 'Highwaymen', icon: '🗡️', place: 'road', desc: 'They rob what passes on the road: stores, never people.' },
  marauders: { name: 'Marauders', icon: '🏴', place: 'land', desc: 'They hold the land they sit on, grow every season, carry off women, and overrun the land next door when they are strong (bandhorde.ts).' },
};
const NAMES: Record<BandKind, string[]> = {
  raiders: ['the Ash Riders', 'the Red Hand', 'the Wolf\'s Sons', 'the Burnt Men', 'the Crows'],
  slavers: ['the Chain', 'the Long Coffle', 'the Buyers of Men', 'the Iron Market', 'the Tally-keepers'],
  pirates: ['the Black Sail', 'the Salt Wolves', 'the Drowned Men', 'the Gull\'s Brood', 'the Reavers of the Sound'],
  marauders: ['the Marauders', 'the Black Banner', 'the Landless', 'the Wolves of the Waste', 'the Unbowed'],
  highwaymen: ['the Toll-takers', 'the Hedge Knights', 'the Night Road', 'the Purse-cutters', 'the Men of the Pass'],
};

/** A chance in [0, 1) from the campaign's seed, the season and two numbers of its own. */
export function chance(c: Campaign, a: number, salt: number): number {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 3, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(a * 193 + salt + 5, 0xc2b2ae35) ^ 0x51ed270b;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const held = (c: Campaign, t: Territory): boolean => t.owner >= 0 && !!c.factions[t.owner]?.alive;
const whose = (c: Campaign, f: number): string => whoseOf(c, f); // "your", "the Arameans'" (naming.ts)
export const mark = (c: Campaign, kind: EventKind, at: number): void => { (c.events ??= []).push({ kind, at, turn: c.turn, until: c.turn }); };
const sick = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);
const coastal = (t: Territory): boolean => t.trait === 'coast';
const count = (h: Held[]): number => h.reduce((n, x) => n + x.men.length + x.women.length, 0);
export const people = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The people of this town whom some band holds: each group with the band that has them. The one record of who has been taken. */
export const heldFrom = (c: Campaign, tid: number): { band: Band; held: Held }[] => (c.bands ?? []).flatMap((b) => b.held.filter((h) => h.from === tid).map((held) => ({ band: b, held })));
export const bandsAt = (c: Campaign, tid: number): Band[] => (c.bands ?? []).filter((b) => b.at === tid || b.to === tid);
export const heldCount = (b: Band): number => count(b.held);
/** Seasons left in which these captives can still be got back. */
export const seasonsLeft = (c: Campaign, h: Held): number => Math.max(0, THREATS.holdFor - (c.turn - h.since));

/** How many bands are meant to be about just now. */
export function wanted(c: Campaign): number {
  const lands = c.territories.filter((t) => held(c, t)).length;
  if (!lands) return 0;
  const fallen = c.factions.some((f) => f.alive && creedOf(f.virtue ?? 0).plague > 1);
  return Math.min(THREATS.most, Math.max(1, Math.floor(lands / THREATS.lands)) + (fallen ? 1 : 0));
}

/** What a town has to defend itself with. */
export function defenceOf(c: Campaign, tid: number): Defence {
  const t = c.territories[tid], f = folkOf(c, tid);
  // Men gone to the mines are not at the walls (drift.ts): the walls are left thin.
  const watch = watchOf(c, tid);
  const men = (f.men / TOWN_SCALE) * THREATS.man * watch * grudgeWatch(c, tid); // a town's men count as the same share of it however large towns are (township.ts TOWN_SCALE); the old people of a taken town watch grudgingly (oldpeople.ts)
  const works = (hasFortress(c, tid) ? THREATS.fortress : 0) + t.buildings.filter((b) => b === 'barracks' || b === 'range' || b === 'stable').length * THREATS.raising + watchDefence(c, tid) + stoodTo(c, tid); // and its town watch (townwatch.ts), and its standing to on a herald's word (heralds.ts)
  let towers = 0, wall = 0;
  for (const b of t.town?.b ?? []) {
    if (b[4] !== undefined) continue; // never finished
    const whole = b[3] ?? 1;
    if (b[0] === 'tower') towers += whole * THREATS.tower;
    else if (b[0] === 'palisade' || b[0] === 'wall' || b[0] === 'gate') wall += whole * THREATS.wall;
  }
  const walls = (Math.min(THREATS.towers, towers) + Math.min(THREATS.walls, wall)) * (0.5 + 0.5 * watch);
  const a = c.armies.find((x) => x.at === tid && x.owner === t.owner);
  const army = a ? armyStrength(a) : 0;
  const guard = t.capital >= 0 ? THREATS.capital : 0;
  const spirit = (t.owner >= 0 ? creedOf(faithAt(c, tid)).morale : 1) * (sick(c, tid) ? THREATS.sick : 1); // the town's own standing (townfaith.ts)
  return { men: round1(men), works: round1(works), walls: round1(walls), army: round1(army), guard, spirit: round1(spirit), total: round1((men + works + walls + army + guard) * spirit * bandStand(c, tid)) }; // a people's own study may stiffen it (ownstudies.ts)
}

/** The lands a band can reach to strike. */
export function reachOf(c: Campaign, b: Band): number[] {
  const ok = (id: number): boolean => held(c, c.territories[id]);
  if (b.kind === 'pirates') return c.territories.filter((t) => coastal(t) && held(c, t)).map((t) => t.id);
  if (b.kind === 'highwaymen') return [b.at, b.to!].filter(ok);
  return [b.at, ...c.territories[b.at].adj].filter(ok);
}

/** Where a new band of this kind could make its place: [at, to?], or null if nowhere will do. */
function placeFor(c: Campaign, kind: BandKind, salt: number): [number, number?] | null {
  const taken = new Set((c.bands ?? []).flatMap((b) => [b.at]));
  const pick = <T>(list: T[], k: number): T | undefined => list[Math.floor(chance(c, salt, k) * list.length)];
  if (kind === 'pirates') {
    const coasts = c.territories.filter((t) => coastal(t) && !taken.has(t.id));
    if (!coasts.some((t) => held(c, t)) && !c.territories.some((t) => coastal(t) && held(c, t))) return null;
    const wild = coasts.filter((t) => t.owner < 0), bare = coasts.filter((t) => !c.armies.some((a) => a.at === t.id));
    const t = pick(wild.length ? wild : bare, 11);
    return t ? [t.id] : null;
  }
  if (kind === 'highwaymen') {
    const roads: [number, number][] = [];
    for (const t of c.territories) for (const n of t.adj) if (n > t.id && held(c, t) && c.territories[n].owner === t.owner && !taken.has(t.id)) roads.push([t.id, n]);
    const r = pick(roads, 13);
    return r ?? null;
  }
  const wild = c.territories.filter((t) => t.owner < 0 && !t.horde && !taken.has(t.id) && t.adj.some((n) => held(c, c.territories[n])));
  const bare = c.territories.filter((t) => held(c, t) && t.capital < 0 && !taken.has(t.id) && !c.armies.some((a) => a.at === t.id));
  const t = pick(wild.length ? wild : bare, 17);
  return t ? [t.id] : null;
}

/** A new band comes. `born`, if given, may say where a band of a kind is born instead of the common places (bandwilds.ts: the far wilds). */
export function appear(c: Campaign, out: string[], born?: (kind: BandKind) => [number, number?] | null): Band | null {
  const kinds = (['raiders', 'slavers', 'pirates', 'highwaymen'] as BandKind[]).map((k, i) => [chance(c, 301 + i, 7), k] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (const kind of kinds) {
    if ((c.bands ?? []).filter((b) => b.kind === kind).length >= 2) continue;
    const place = born?.(kind) ?? placeFor(c, kind, 401 + (c.bandSeq ?? 0));
    if (!place) continue;
    const id = (c.bandSeq = (c.bandSeq ?? 0) + 1);
    const names = NAMES[kind].filter((n) => !(c.bands ?? []).some((b) => b.name === n));
    const [lo, hi] = THREATS.start;
    const band: Band = {
      id, kind, name: (names.length ? names : NAMES[kind])[Math.floor(chance(c, id, 19) * (names.length || NAMES[kind].length))],
      at: place[0], ...(place[1] === undefined ? {} : { to: place[1] }), strength: lo + Math.floor(chance(c, id, 23) * (hi - lo + 1)), since: c.turn, held: [],
    };
    (c.bands ??= []).push(band);
    const where = kind === 'highwaymen' ? `on the road between ${c.territories[band.at].name} and ${c.territories[band.to!].name}` : kind === 'pirates' ? `in a cove at ${c.territories[band.at].name}` : `in the wilds at ${c.territories[band.at].name}`;
    out.push(`${BANDS[kind].icon} ${BANDS[kind].name} who call themselves ${band.name} have made their ${BANDS[kind].place} ${where}. ${BANDS[kind].desc}`);
    return band;
  }
  return null;
}

/** Take so many grown people of working age out of a town, the youngest first. Returns their ages. */
function takeOut(c: Campaign, tid: number, sex: 'm' | 'f', n: number): number[] {
  if (n <= 0) return [];
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  const list = ages[sex], young = list.map((s, i) => [s, i] as const).filter(([s]) => s < OLD_SEASON).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, n);
  const gone = new Set(young.map(([, i]) => i));
  ages[sex] = list.filter((_, i) => !gone.has(i));
  countFrom(f, ages);
  return young.map(([s]) => s);
}

/** Captives come home, older by what being held has cost them. Returns how many. */
export function bringHome(c: Campaign, h: Held): number {
  const t = c.territories[h.from];
  // If the land has changed hands they go to their own people's nearest town; failing that, to where they were taken from.
  const home = t.owner === h.owner ? t : c.territories.find((x) => x.owner === h.owner) ?? t;
  const f = folkOf(c, home.id), ages = agesOf(c, home.id, f);
  const share = Math.min(1, (c.turn - h.since) / THREATS.holdFor);
  for (const s of h.men) ages.m.push(s + Math.round(THREATS.yearsMan * SEASONS_A_YEAR * share));
  for (const s of h.women) ages.f.push(s + Math.round(THREATS.yearsWoman * SEASONS_A_YEAR * share));
  // Children born to them while held are theirs, and come home with them at their own ages (bandborn.ts).
  if (h.women.length) for (const born of h.kids ?? []) ages.k.push(Math.max(0, c.turn - born));
  countFrom(f, ages);
  for (const name of h.names ?? []) for (const x of c.territories) { const n = x.folk?.notables.find((k) => k.name === name && k.lost?.how.startsWith('carried off')); if (n) delete n.lost; }
  return h.men.length + h.women.length;
}

export function breakBand(c: Campaign, b: Band, out: string[], by?: Army): void {
  let freed = 0;
  const kids = b.held.reduce((n, h) => n + (h.women.length ? h.kids?.length ?? 0 : 0), 0);
  for (const h of b.held) freed += bringHome(c, h);
  if (freed) { mark(c, 'rescued', b.at); note(c, out, 'freed', b, b.at, `${people(freed, 'person', 'people')} held by ${b.name} ${freed === 1 ? 'is' : 'are'} free and going home, the older for it${kids ? `, and with ${people(kids, 'child', 'children')} born while they were held` : ''}.`, b.held.map((h) => h.owner)); }
  c.bands = (c.bands ?? []).filter((x) => x !== b);
  // What is taken back goes into the town where the army stands, if it is theirs; else to the nation as a whole.
  if (by && c.factions[by.owner]) { if (c.territories[by.at]?.owner === by.owner) stock(c, by.at, THREATS.prize * SUPPLY_UNITS); else c.factions[by.owner].supplies += THREATS.prize; }
}

/** One strike on one town. */
export function strike(c: Campaign, b: Band, tid: number, out: string[]): Raid {
  const t = c.territories[tid], owner = t.owner, f = folkOf(c, tid);
  const road = b.kind === 'highwaymen';
  const defence = defenceOf(c, tid);
  // On the road it is the escort that counts: an army at either end.
  const guard = road ? Math.max(...[b.at, b.to!].map((id) => { const a = c.armies.find((x) => x.at === id && x.owner === owner); return a ? armyStrength(a) : 0; })) + THREATS.wayfarers : defence.total;
  const force = round1(b.strength * (0.8 + 0.4 * chance(c, b.id, 29)));
  const r = guard / Math.max(0.1, force);
  // A town that already has people in some band's hands has no more to give: it is raided, not taken again.
  const bled = (c.bands ?? []).some((k) => k.held.some((h) => h.from === tid));
  let outcome: Outcome = r >= THREATS.hold ? 'held' : r < THREATS.fall && !road && !bled ? 'taken' : 'raided';
  const raid: Raid = {
    turn: c.turn, band: b.id, kind: b.kind, name: b.name, at: tid, owner, outcome, force, defence: road ? { ...defence, total: round1(guard) } : defence,
    killed: 0, taken: { men: 0, women: 0 }, names: [], stores: { food: 0, wood: 0, gold: 0, stone: 0 }, sway: 0,
  };
  if (outcome === 'held') {
    b.strength -= r >= 2 ? 2 : 1;
    if (r < 1.6 && !road && f.men > TOWN_SCALE) raid.killed = takeOut(c, tid, 'm', TOWN_SCALE).length; // a man of a town as towns were: as many as that is now
    if (b.strength <= 0) raid.broken = true;
  } else {
    if (!road) raid.killed = takeOut(c, tid, 'm', Math.min(Math.max(0, f.men - TOWN_SCALE), Math.round(f.men * THREATS.dead[outcome] * fortShelter(c, tid)))).length; // in a Fortress they have somewhere to go (fortress.ts)
    const share = road ? THREATS.road : THREATS.loot[outcome] + (b.kind === 'pirates' ? THREATS.pirateLoot : 0);
    // What they would take, and then no more of it than they can carry.
    // Of the food, only what the town holds beyond a couple of seasons of its own eating: a town robbed is poorer, not starved.
    const spare = Math.max(0, f.stores.food - THREATS.larder * needOf(c, tid));
    const want = STORE_KINDS.map((k) => Math.floor((k === 'food' ? Math.min(f.stores.food, spare / Math.max(share, 0.01)) : f.stores[k]) * (k === 'food' || k === 'gold' || !road ? share : 0)));
    const all = want.reduce((n, v) => n + v, 0), load = Math.min(1, (force * (THREATS.carry[b.kind] ?? 30)) / Math.max(1, all));
    STORE_KINDS.forEach((k, i) => { const n = Math.floor(want[i] * load); f.stores[k] -= n; raid.stores[k] = n; });
    if ((b.kind === 'raiders' || b.kind === 'pirates') && t.buildings.includes('farm') && chance(c, b.id, 31) < THREATS.burn) { t.buildings.splice(t.buildings.indexOf('farm'), 1); raid.burnt = 'farm'; }
    if (outcome === 'taken') {
      // Never a town's last two women, nor its last two men.
      const most = (n: number): number => Math.max(0, Math.min(n - THREATS.last * TOWN_SCALE, Math.floor(n * (1 - THREATS.left)), Math.ceil(n * THREATS.carried * fortShelter(c, tid))));
      const women = takeOut(c, tid, 'f', most(f.women));
      const men = b.kind === 'slavers' ? takeOut(c, tid, 'm', most(f.men)) : [];
      if (women.length + men.length) {
        // A woman the nation knows by name may be among them.
        const names: string[] = [];
        for (const n of living(f)) if (n.kind === 'mother' && women.length && chance(c, b.id * 7 + names.length, 37) < women.length / (women.length + f.women)) { n.lost = { turn: c.turn, how: `carried off by ${b.name}` }; names.push(n.name); }
        b.held.push({ from: tid, owner, men, women, since: c.turn, ...(names.length ? { names } : {}) });
        raid.taken = { men: men.length, women: women.length }; raid.names = names;
      } else { outcome = raid.outcome = 'raided'; }
    }
    b.strength = Math.min(THREATS.max, b.strength + 1);
  }
  // Which way their morals sway: a people that held together is the better for it; one that was sacked loses heart.
  const down = THREATS.sway[outcome] < 0;
  raid.sway = round1(THREATS.sway[outcome] * (down ? wrathOf(c, owner) : 1)); // by the nation's standing still: by the town's own (wrathAt) more campaigns ended in ruin at 192, taking that row out of its band
  swayTown(c, tid, raid.sway); // it is the town struck whose morals sway, and its nation's with it (townfaith.ts)
  mark(c, outcome === 'held' ? 'heldoff' : outcome === 'taken' ? 'carried' : 'raid', tid);
  (c.raids ??= []).push(raid);
  if (c.raids.length > THREATS.kept) c.raids.splice(0, c.raids.length - THREATS.kept);
  out.push(reportLine(c, raid));
  return raid;
}

/** The report in one line, for the log. */
export function reportLine(c: Campaign, r: Raid): string {
  const t = c.territories[r.at], icon = BANDS[r.kind].icon, who = r.name[0].toUpperCase() + r.name.slice(1);
  const road = r.kind === 'highwaymen';
  if (r.outcome === 'held') return `${icon} ${who} ${road ? `were driven off the road at ${t.name}` : `came against ${t.name} and were beaten back`}${r.killed ? ` at the cost of ${people(r.killed, 'man', 'men')}` : ''}${r.broken ? ': the band is broken' : ''}.`;
  const lost = [r.killed ? `${people(r.killed, 'man', 'men')} killed` : '', r.taken.women ? `${people(r.taken.women, 'woman', 'women')} carried off` : '', r.taken.men ? `${people(r.taken.men, 'man', 'men')} taken in chains` : '', r.burnt ? 'the farmland burnt' : ''].filter(Boolean);
  return `${icon} ${who} ${road ? `robbed the road at ${t.name}` : r.outcome === 'taken' ? `sacked ${t.name}` : `raided ${t.name}`}${lost.length ? `: ${lost.join(', ')}` : ''}.`;
}

/** The whole report, line by line, as the player is to read it. */
export function reportText(c: Campaign, r: Raid): string[] {
  const t = c.territories[r.at], d = r.defence, road = r.kind === 'highwaymen';
  const had = [d.men ? `its men (${whole(d.men)})` : '', d.works ? `its fortress and barracks (${whole(d.works)})` : '', d.walls ? `its towers and walls (${whole(d.walls)})` : '', d.army ? `the army there (${whole(d.army)})` : '', d.guard ? `the capital's guard (${whole(d.guard)})` : ''].filter(Boolean);
  const lines = [
    `${BANDS[r.kind].name}, ${r.name}, ${road ? 'lay in wait on the road at' : 'came against'} ${t.name} with ${strengthOf(r.force)}.`,
    road ? `The road was ${d.total > 1 ? `escorted (${whole(d.total)})` : 'unguarded'}.`
      : `The town defended itself with ${had.length ? had.join(', ') : 'nothing'}${d.spirit !== 1 ? `, ${d.spirit > 1 ? 'stiffened' : 'slackened'} by the spirit of its people (×${Math.round(d.spirit * 100) / 100})` : ''}: ${inAll([d.men, d.works, d.walls, d.army, d.guard].map((x) => x ?? 0), d.total)}.`,
    r.outcome === 'held' ? `They were ${road ? 'driven off' : 'held off'}${r.broken ? ', and the band is broken' : ''}.` : r.outcome === 'taken' ? 'The town fell to them.' : road ? 'They took what was on the road.' : 'They broke in, took what they could carry and were gone.',
  ];
  if (r.killed) lines.push(`Killed: ${people(r.killed, 'man', 'men')} of the town.`);
  if (r.taken.men + r.taken.women) lines.push(`Taken: ${[r.taken.women ? people(r.taken.women, 'woman', 'women') : '', r.taken.men ? people(r.taken.men, 'man', 'men') : ''].filter(Boolean).join(' and ')}${r.names.length ? `, ${r.names.join(' and ')} among them` : ''}. No child was touched. They can be got back for ${THREATS.holdFor} seasons by breaking the band.`);
  const goods = STORE_KINDS.filter((k) => r.stores[k]).map((k) => `${r.stores[k]} ${k}`);
  if (goods.length || r.burnt) lines.push(`Lost: ${[...goods, r.burnt ? `the ${r.burnt}land, burnt` : ''].filter(Boolean).join(', ')}.`);
  lines.push(r.sway > 0 ? `The people stood together and are the better for it (standing +${r.sway}).` : r.sway < 0 ? `The people have lost heart, and some turn to worse comforts (standing ${r.sway}).` : 'The people\'s standing is as it was.');
  return lines;
}
/** The reports of this season's strikes on a land, the latest first. */
export const raidsAt = (c: Campaign, tid: number, turn = c.turn): Raid[] => (c.raids ?? []).filter((r) => r.at === tid && r.turn === turn).reverse();

/** Set down something a band did, for the log and for the season's news. */
export function note(c: Campaign, out: string[], kind: BandNote['kind'], b: Band, at: number, text: string, owners: number[] = []): void {
  out.push(text);
  const list = (c.bandNews ??= []);
  list.push({ turn: c.turn, kind, at, band: b.id, text, owners: [...new Set(owners.filter((f) => f >= 0))] });
  if (list.length > THREATS.kept * 2) list.splice(0, list.length - THREATS.kept * 2);
}
const cap = (name: string): string => name[0].toUpperCase() + name.slice(1);

/** Captives held too long are lost; their people are warned a season before. */
export function captivesSeason(c: Campaign, out: string[]): void {
  for (const b of c.bands ?? []) {
    for (const h of [...b.held]) {
      const left = seasonsLeft(c, h), n = h.men.length + h.women.length, from = c.territories[h.from].name;
      if (left <= 0) {
        b.held.splice(b.held.indexOf(h), 1);
        note(c, out, 'lost', b, h.from, `${people(n, 'person', 'people')} taken from ${from} by ${b.name} ${n === 1 ? 'has' : 'have'} been ${b.kind === 'raiders' || b.kind === 'marauders' ? 'held too long: they are dead or gone for good' : 'sold on, and will not be seen again'}.`, [h.owner]);
        (c.chronicle ??= []).push({ turn: c.turn, text: `${people(n, 'person', 'people')} of ${from}, carried off by ${b.name}, ${n === 1 ? 'was' : 'were'} never got back.` });
      } else if (left === 1 && h.owner === 0) note(c, out, 'warned', b, b.at, `One season is left to get back the ${people(n, 'person', 'people')} ${b.name} took from ${from}: break the band at ${c.territories[b.at].name}.`, [0]);
    }
  }
}

/** The softest mark in a band's reach: least defence for what draws it, and the decadent draw it more. */
export function softest(c: Campaign, b: Band, reach = reachOf(c, b)): { id: number; lure: number } | null {
  const marks = reach.map((id) => ({ id, lure: wrathAt(c, id) / Math.max(0.5, defenceOf(c, id).total), tie: chance(c, b.id * 53 + id, 43) })).sort((x, y) => y.lure - x.lure || x.tie - y.tie);
  return marks[0] ?? null;
}

/** Every band but the marauders grows a little with time, and may strike the softest town in its reach. */
export function strikeSeason(c: Campaign, out: string[]): Raid[] {
  const raids: Raid[] = [];
  for (const b of [...(c.bands ?? [])]) {
    if (b.kind === 'marauders') continue; // they keep their own season (bandhorde.ts)
    mark(c, 'band', b.at);
    if (c.turn > b.since && (c.turn - b.since) % THREATS.grow === 0) b.strength = Math.min(THREATS.max, b.strength + 1);
    const m = softest(c, b);
    if (!m || chance(c, b.id, 41) >= THREATS.strike) continue;
    const raid = strike(c, b, m.id, out);
    raids.push(raid);
    if (raid.broken) { note(c, out, 'broken', b, b.at, `${cap(b.name)} are broken and scattered.`, [raid.owner]); breakBand(c, b, out); }
  }
  return raids;
}

/** A band that is missing appears, as often as not. Marauders are not counted: they come by their own rule. */
export function appearSeason(c: Campaign, out: string[], where?: (kind: BandKind) => [number, number?] | null): Band | null {
  const about = (c.bands ?? []).filter((b) => b.kind !== 'marauders').length;
  if (c.turn < THREATS.from || about >= wanted(c) || chance(c, 0, 47) >= THREATS.appear) return null;
  const before = out.length, b = appear(c, out, where);
  if (b) { const text = out.splice(before).join(' '); note(c, out, 'came', b, b.at, text, reachOf(c, b).map((id) => c.territories[id].owner)); }
  return b;
}
