/**
 * Rivals live by the same rules (docs/DESIGN.md): what a computer-led nation needs so that its towns go through
 * everything a player's do, and so that it rules them with an eye to how they are.
 *  - Its towns have buildings on record, laid down coarsely from what the map knows, so they are held to the room
 *    of their houses and their governors can build. (The player's unvisited towns are laid down the same way, so
 *    neither side is spared.)
 *  - It sends an army home that has stood idle deep in its own land, and its men go back to their towns.
 *  - Named soldiers, notable homes and orders arise for it from what happens on the map, since nobody fights its
 *    battles in person or visits its towns.
 *  - It weighs how its towns are: it garrisons one that is resentful or has a band upon it, keeps that garrison
 *    where it is, and does not raise the last men out of a town that is strained.
 * (Its income is still scaled by difficulty, by the owner's word. Feeding a hungry town is convoys.ts's `relieve`,
 * and its decrees are decrees.ts's `sensibleDecrees`.)
 */
import type { Army, Campaign, Territory } from './campaign';
import { SITE_BUILDING, armyAt, moveArmy } from './campaign';
import { NAMES_F, NAMES_M, FAMILY_NAMES } from './data';
import { STORE_KINDS, Stores, folkOf, headcount, living, loseVeteran, rememberVeteran, MOTHER_KIDS } from './township';
import { HALL_ROOM, HOUSE_ROOM } from './seasonfolk';
import { canSendHome, homeOf, sendHome } from './armytown';
import { revoltChance } from './conquered';
import { bandsAt } from './threats';

export const RIVAL = {
  /** Seasons an army must have stood in the same land of its own, with no foreign land beside it, before it is sent home. */
  idle: 4,
  /** Battles an army must have won before one of its soldiers has a name, and the kills each is counted as. */
  wins: 2, killsAWin: 3,
  /** The chance of a rising above which a town is garrisoned. */
  risk: 0.03,
  /** A strained town down to this many men of working age is not asked for another company; and the strain that counts. */
  lastMen: 2, strain: 0.5,
};
const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const rival = (c: Campaign, f: number): boolean => f > 0 && !!c.factions[f]?.isAI && c.factions[f].alive;
const towns = (c: Campaign, f: number): Territory[] => c.territories.filter((t) => t.owner === f && !t.horde);

/**
 * Lay a town's buildings down on record, coarsely, where it has none: a hall, the works the map knows it has, and
 * roofs enough for the people it holds now and one to spare. The record is marked `coarse`: it is for counting
 * (room, roofs, what a governor adds), and is not where things stand on a battlefield.
 */
export function layTown(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || t.town?.b?.length || t.horde) return false;
  const f = folkOf(c, tid), pairs = Math.min(f.men, f.women);
  const roofs = Math.max(pairs, Math.ceil(Math.max(0, headcount(f) - HALL_ROOM) / HOUSE_ROOM)) + 1;
  const b: [string, number, number][] = [['towncenter', 30, 30]];
  for (const site of t.buildings) if (SITE_BUILDING[site] && site !== 'fortress') b.push([SITE_BUILDING[site], 30 + 6 * b.length, 24]);
  for (let i = 0; i < roofs; i++) b.push(['house', 18 + 4 * (i % 8), 38 + 4 * Math.floor(i / 8)]);
  t.town = { at: 2, b, coarse: true };
  return true;
}

/**
 * Every nation's towns are on record, the player's as a rival's: a town of a living people with no buildings on
 * record is given a coarse one, so both sides are held to the room of their houses and both governors can build.
 * A town the player fights over or visits in person has its real record from then on, in place of the coarse one.
 * A coarse record does not outlast its people's hold: a town gone back to a tribe or to marauders is unrecorded again.
 */
export function layTowns(c: Campaign): number {
  let laid = 0;
  for (const t of c.territories) {
    const held = t.owner >= 0 && !t.horde && !!c.factions[t.owner]?.alive;
    if (!held) { if (t.town?.coarse) delete t.town; continue; }
    if (layTown(c, t.id)) laid++;
  }
  return laid;
}

/** How long each army has stood where it is: kept on the campaign, by army. */
function stood(c: Campaign, a: Army): number {
  const all = (c.idle ??= {}), was = all[a.id];
  const deep = c.territories[a.at].owner === a.owner && !c.territories[a.at].adj.some((n) => c.territories[n].owner !== a.owner);
  all[a.id] = deep && was && was.at === a.at ? { at: a.at, n: was.n + 1 } : { at: a.at, n: deep ? 1 : 0 };
  return all[a.id].n;
}
/** A rival's armies that have stood idle deep in its own land are sent home (armytown.ts), all but one. Returns how many. */
export function homeIdle(c: Campaign, f: number): number {
  let sent = 0;
  const mine = c.armies.filter((a) => a.owner === f);
  for (const a of mine) {
    const n = stood(c, a);
    if (n < RIVAL.idle || !canSendHome(c, a.id) || c.armies.filter((x) => x.owner === f).length <= 1) continue;
    if (sendHome(c, a.id) >= 0) { sent++; delete c.idle![a.id]; }
  }
  for (const id of Object.keys(c.idle ?? {})) if (!c.armies.some((a) => String(a.id) === id)) delete c.idle![id];
  return sent;
}

/**
 * Soldiers make a name on the map as well as in a battle fought in person: an army that has won twice, and has
 * nobody known by name, has one from then on, remembered in the town its men came from (or its nation's chief
 * town). An army that is no more takes him with it. For every nation's armies, the player's included.
 */
export function nameVeterans(c: Campaign): { named: number; lost: number } {
  let named = 0, lost = 0;
  const known = (c.captains ??= {});
  for (const a of c.armies) {
    if (a.owner < 0 || !c.factions[a.owner]?.alive) continue;
    if (!a.champion && a.vet >= RIVAL.wins) {
      const female = hash(c.seed + a.id, 41) < 0.1, names = female ? NAMES_F : NAMES_M;
      const unit = Object.keys(a.units).sort((p, q) => a.units[q] - a.units[p])[0] ?? 'infantry';
      a.champion = { name: `${names[Math.floor(hash(c.seed + a.id, 43) * names.length)]} ${FAMILY_NAMES[Math.floor(hash(c.seed + a.id, 47) * FAMILY_NAMES.length)]}`, kills: a.vet * RIVAL.killsAWin, unit: unit === 'cavalry' ? 'Rider' : unit === 'archers' ? 'Archer' : 'Soldier', ...(female ? { female: true } : {}) };
      named++;
    }
    if (a.champion && !known[a.id]) {
      const from = homeOf(c, a), chief = c.territories.find((t) => t.capital === a.owner && t.owner === a.owner) ?? c.territories.find((t) => t.owner === a.owner);
      const at = from !== undefined && c.territories[from]?.owner === a.owner ? from : chief?.id;
      if (at !== undefined) { rememberVeteran(c, at, a.champion); known[a.id] = { name: a.champion.name, f: a.owner }; }
    }
  }
  for (const [id, who] of Object.entries(known)) {
    if (c.armies.some((a) => String(a.id) === id)) continue;
    // Sent home he lives on in his town (armytown.ts keeps him); destroyed, he is lost. A player's own are already told of.
    if (who.f !== 0 && !c.homecoming?.includes(Number(id))) { loseVeteran(c, who.f, who.name); lost++; }
    delete known[id];
  }
  c.homecoming = [];
  return { named, lost };
}

/**
 * A notable home arises where nobody visits: in a rival's town with children enough on its record and no woman
 * known by name, the mother of the largest household is known from then on.
 */
export function notableHome(c: Campaign, tid: number): boolean {
  const t = c.territories[tid], f = folkOf(c, tid);
  if (!rival(c, t.owner) || f.women < 1 || f.children < MOTHER_KIDS || living(f).some((n) => n.kind === 'mother')) return false;
  const family = FAMILY_NAMES[Math.floor(hash(c.seed * 13 + tid, 53) * FAMILY_NAMES.length)];
  f.notables.push({ name: NAMES_F[Math.floor(hash(c.seed * 13 + tid, 59 + f.notables.length) * NAMES_F.length)], family, gender: 'f', kind: 'mother', kids: MOTHER_KIDS, deed: `raised ${MOTHER_KIDS} children`, turn: c.turn });
  return true;
}

/**
 * A rival gives its towns their orders: its people are set to what the town is shortest of, measured against
 * what a town is founded with. (How much a hand brings in is governor.ts's affair.)
 */
export function rivalOrders(c: Campaign, tid: number): Stores | null {
  const t = c.territories[tid];
  if (!rival(c, t.owner)) return null;
  const f = folkOf(c, tid), hands = f.men + f.women, want: Stores = { food: 200, wood: 200, gold: 100, stone: 100 };
  if (hands < 1) return null;
  const lack = STORE_KINDS.map((k) => ({ k, short: Math.max(0.05, 1 - Math.min(1, f.stores[k] / (want[k] * 3))) })), all = lack.reduce((n, x) => n + x.short, 0);
  const work: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  let left = hands;
  for (const x of lack) { work[x.k] = Math.floor((hands * x.short) / all); left -= work[x.k]; }
  work.food += left; // whoever is over goes to the fields
  t.orders = { work, turn: c.turn };
  return work;
}

/** May another company be raised out of this town? Not the last men of a town that is strained. */
export function maySpare(c: Campaign, tid: number): boolean {
  const f = folkOf(c, tid);
  return !(f.men <= RIVAL.lastMen && (f.drift?.strain ?? 0) >= RIVAL.strain);
}
/** Does this town want an army in it? It is resentful enough to rise, or a band has come upon it. */
export const threatened = (c: Campaign, tid: number): boolean => revoltChance(c, tid) > RIVAL.risk || bandsAt(c, tid).length > 0;

/**
 * Before a rival spends and marches: an army beside a town of its own that wants one, and has none, goes there;
 * and an army garrisoning such a town stays where it is this season, unless it is at the front (a band upon the
 * town holds it even there). Returns how many moved.
 */
export function rivalMoves(c: Campaign, f: number): number {
  if (!rival(c, f)) return 0;
  let moved = 0;
  // The garrison of a town that wants one holds. (Without an army in it the count is of a town left open.)
  const held = new Set<number>();
  // An army with foreign land beside it is at the front and goes on with the war; one behind the lines stays to hold.
  const front = (a: Army): boolean => c.territories[a.at].adj.some((n) => c.territories[n].owner !== f);
  for (const a of c.armies) if (a.owner === f && c.territories[a.at].owner === f && (bandsAt(c, a.at).length > 0 || (!front(a) && threatened(c, a.at)))) { a.moved = true; held.add(a.id); }
  for (const t of towns(c, f)) {
    if (armyAt(c, t.id) || !threatened(c, t.id)) continue;
    const near = c.armies.filter((a) => a.owner === f && !a.moved && !held.has(a.id) && !a.hero && c.territories[a.at].owner === f && c.territories[a.at].adj.includes(t.id) && !threatened(c, a.at))
      .sort((p, q) => Object.values(p.units).reduce((n, v) => n + v, 0) - Object.values(q.units).reduce((n, v) => n + v, 0) || p.id - q.id)[0];
    if (near && moveArmy(c, near.id, t.id) === 'moved') { near.moved = true; moved++; }
  }
  return moved;
}

/** A season of a rival's rule, for every computer-led nation; and the naming of soldiers, for all. */
export function rivalSeason(c: Campaign): { laid: number; home: number; named: number; homes: number } {
  const out = { laid: 0, home: 0, named: 0, homes: 0 };
  out.laid = layTowns(c);
  for (const x of c.factions) {
    if (!rival(c, x.id)) continue;
    for (const t of towns(c, x.id)) { if (notableHome(c, t.id)) out.homes++; rivalOrders(c, t.id); }
    out.home += homeIdle(c, x.id);
  }
  out.named = nameVeterans(c).named;
  return out;
}
