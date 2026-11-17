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
import { hireOff } from './places';
import { HUB, reach } from './campaignbase';
import { COMPANIES, MAX_ARMY, SITE_BUILDING, armyAt, armySize, armyStrength, atTruce, companyCost } from './campaignbase';
import { NAMES_F, NAMES_M, FAMILY_NAMES } from './data';
import { STORE_KINDS, Stores, folkOf, headcount, living, loseVeteran, rememberVeteran, MOTHER_KIDS } from './township';
import { HALL_ROOM, HOUSE_ROOM } from './seasonfolk';
import { MEN_A_COMPANY, awayFrom, canSendHome, homeOf, menMustered, menOf, sendCompaniesHome, sendHome, sendMenHome, sparedMen } from './armytown';
import { SUPPLY_UNITS } from './stores';
import { revoltChance } from './conquered';
import { bandsAt } from './threats';
import { manOfRoll, rememberOf } from './veteranhome';
import { nobodyThere } from './founding'; // a land with nobody on it is settled, not marched on

export const RIVAL = {
  /** Seasons an army must have stood in the same land of its own, with no foreign land beside it, before it is sent home. */
  idle: 4,
  /** Battles an army must have won before one of its soldiers has a name, and the kills each is counted as. */
  wins: 2, killsAWin: 3,
  /** The chance of a rising above which a town is garrisoned. */
  risk: 0.03,
  /** Seasons since a nation last won or lost land after which it is at peace; the share of its men it keeps under arms then;
   *  seasons of peace after which it musters for a campaign; and how many seasons it musters for before standing down again. */
  lull: 4, standing: 0.05, restless: 10, campaign: 8,
  /** A strained town down to this many men of working age is not asked for another company; and the strain that counts. */
  lastMen: 2, strain: 0.5,
  /** Seasons a people lives in an age before it takes the next, however rich it is: five years. */
  settle: 20,
  /** A people with men and no supplies to spare raises a company out of a town's own stores, down to this share of them. */
  stock: 0.5,
};
declare module './campaign' {
  interface Campaign { /** The age each rival was last seen in, and the turn it came to it (rivalrule.ts). */ aged?: Record<string, { age: number; at: number }> }
}
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
      const man = manOfRoll(c, a.owner, a.id, 43); // a man of its roll, of his own house (veteranhome.ts), where it has one
      a.champion = { name: man?.name ?? `${names[Math.floor(hash(c.seed + a.id, 43) * names.length)]} ${FAMILY_NAMES[Math.floor(hash(c.seed + a.id, 47) * FAMILY_NAMES.length)]}`, kills: a.vet * RIVAL.killsAWin, unit: unit === 'cavalry' ? 'Rider' : unit === 'archers' ? 'Archer' : 'Soldier', ...(female && !man ? { female: true } : {}), ...(man ? { town: man.town } : {}) };
      named++;
    }
    if (a.champion && !known[a.id]) {
      const from = homeOf(c, a), chief = c.territories.find((t) => t.capital === a.owner && t.owner === a.owner) ?? c.territories.find((t) => t.owner === a.owner);
      const at = from !== undefined && c.territories[from]?.owner === a.owner ? from : chief?.id;
      if (rememberOf(c, a.owner, a.id, a.champion, at)) known[a.id] = { name: a.champion.name, f: a.owner }; // of his own town and house, off the roll
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

/** A nation's men, at home and with its armies, and the share of them under arms. */
export function underArms(c: Campaign, f: number): { away: number; home: number; share: number } {
  const away = c.armies.filter((a) => a.owner === f).reduce((n, a) => n + menOf(c, a).town, 0);
  const home = towns(c, f).reduce((n, t) => n + folkOf(c, t.id).men, 0);
  return { away, home, share: away + home > 0 ? away / (away + home) : 0 };
}
/**
 * War and peace, as a nation's armies know it. A nation is at war for `lull` seasons after it wins or loses land.
 * At peace it keeps a standing force and no more; after `restless` seasons of peace it musters for a campaign,
 * for `campaign` seasons, and if nothing comes of it stands down again. Kept on the campaign, by nation.
 */
export function warFooting(c: Campaign, f: number): 'war' | 'muster' | 'peace' {
  const w = (c.wars ??= {})[f] ??= { land: towns(c, f).length, changed: c.turn };
  const land = towns(c, f).length;
  if (land !== w.land) { w.land = land; w.changed = c.turn; delete w.muster; }
  if (c.turn - w.changed <= RIVAL.lull) return 'war';
  if (w.muster !== undefined && c.turn <= w.muster) return 'muster';
  if (w.muster !== undefined && c.turn > w.muster) { w.changed = c.turn - RIVAL.lull - 1; delete w.muster; return 'peace'; } // nothing came of it: stand down, and the wait begins again
  if (c.turn - w.changed > RIVAL.lull + RIVAL.restless) { w.muster = c.turn + RIVAL.campaign; return 'muster'; }
  return 'peace';
}
/** May a nation raise more men just now? At war or mustering, yes; at peace only while one more company keeps it within its standing force. */
export const mayMuster = (c: Campaign, f: number): boolean => {
  if (warFooting(c, f) !== 'peace') return true;
  const u = underArms(c, f); // one more company must still leave it within its standing force
  return u.away + u.home > 0 && (u.away + MEN_A_COMPANY) / (u.away + u.home) <= RIVAL.standing;
};
/**
 * At peace a nation sends home what it holds over its standing force: armies standing in its own land, without
 * the leader, the smallest first, but not the garrison of a town that is threatened. What cannot go whole gives
 * up its townsmen, a company with every two of them. Returns how many armies went home or gave men up.
 */
export function standDown(c: Campaign, f: number): number {
  if (warFooting(c, f) !== 'peace') return 0;
  let sent = 0;
  const size = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);
  for (const a of c.armies.filter((x) => x.owner === f).sort((p, q) => size(p) - size(q) || p.id - q.id)) {
    if (underArms(c, f).share <= RIVAL.standing) break;
    if (wantsGarrison(c, a.at)) continue; // the garrison of a town that wants one stays: it would rise without it, or a band has come upon it
    if (canSendHome(c, a.id) && sendHome(c, a.id) >= 0) sent++; // its last too: a small people at peace keeps no army but its leader's
  }
  // What cannot go home whole (the leader's army, the last one) sends its men home instead, down to the standing force:
  // the men of its towns, and a company with every two of them. (By companies alone, an army mostly of men of no town gave nobody back.)
  for (const a of c.armies.filter((x) => x.owner === f).sort((p, q) => size(q) - size(p) || p.id - q.id)) {
    const u = underArms(c, f);
    if (u.share <= RIVAL.standing) break;
    if (sendMenHome(c, a.id, Math.ceil(u.away - RIVAL.standing * (u.away + u.home))) > 0) sent++;
  }
  return sent;
}

/**
 * A nation whose towns have no man of working age left, while its armies still hold men of theirs, sends them
 * home: whole armies, and all but one company of the leader's. A people does not sit under arms while its towns
 * die behind it. Returns how many armies gave men up.
 */
export function lastMenHome(c: Campaign, f: number): number {
  const u = underArms(c, f);
  if (u.home > 0 || u.away <= 0) return 0;
  let sent = 0;
  for (const a of c.armies.filter((x) => x.owner === f)) {
    if (canSendHome(c, a.id)) { if (sendHome(c, a.id) >= 0) sent++; }
    else if (sendCompaniesHome(c, a.id, 99) > 0) sent++;
  }
  return sent;
}
/**
 * Armies that cannot win alone come together. When a nation is at war or mustering and not one of its armies is
 * strong enough to take any land it can reach, the others march a step through their own land toward the
 * strongest and join it, so that in time it can break out, to whoever stands between it and its last foe.
 * Returns how many marched.
 */
export function massArmies(c: Campaign, f: number): number {
  if (warFooting(c, f) === 'peace') return 0;
  const mine = c.armies.filter((a) => a.owner === f && c.territories[a.at].owner === f);
  if (mine.length < 2) return 0;
  const can = (a: Army): boolean => reach(c, a.at).some((id) => c.territories[id].owner !== f && !atTruce(c, f, c.territories[id].owner) && !nobodyThere(c, id) && armyStrength(a, c) >= HUB.defence(c, id, a.units, c.factions[f].civ));
  if (mine.some(can)) return 0;
  const strong = [...mine].sort((p, q) => armyStrength(q, c) - armyStrength(p, c) || p.id - q.id)[0];
  let marched = 0;
  for (const a of mine) {
    if (a === strong || a.moved || a.at === strong.at) continue;
    // The first step of the shortest way to it through their own land.
    const prev = new Map<number, number>([[a.at, -1]]), queue = [a.at];
    let found = false;
    while (queue.length && !found) {
      const cur = queue.shift()!;
      for (const n of c.territories[cur].adj) {
        if (prev.has(n) || c.territories[n].owner !== f) continue;
        prev.set(n, cur);
        if (n === strong.at) { found = true; break; }
        queue.push(n);
      }
    }
    if (!found) continue;
    let step = strong.at;
    while (prev.get(step) !== a.at) step = prev.get(step)!;
    if (HUB.moveArmy(c, a.id, step) === 'moved') { marched++; const still = c.armies.find((x) => x.id === a.id); if (still) still.moved = true; }
  }
  return marched;
}

/** May another company be raised out of this town? Not the last men of a town that is strained, and not at peace beyond the standing force. */
export function maySpare(c: Campaign, tid: number): boolean {
  const f = folkOf(c, tid);
  if (!mayMuster(c, c.territories[tid].owner)) return false;
  return !(f.men <= RIVAL.lastMen && (f.drift?.strain ?? 0) >= RIVAL.strain);
}
/** Would this town want an army in it if it had none? It is resentful enough to rise left bare, or a band has come upon it. */
export const wantsGarrison = (c: Campaign, tid: number): boolean => revoltChance(c, tid, { bare: true }) > RIVAL.risk || bandsAt(c, tid).length > 0;
/** Does this town want an army in it? It is resentful enough to rise as things stand, or a band has come upon it. */
export const threatened = (c: Campaign, tid: number): boolean => revoltChance(c, tid) > RIVAL.risk || bandsAt(c, tid).length > 0;

/**
 * Before a rival spends and marches: an army beside a town of its own that wants one, and has none, goes there;
 * and an army garrisoning such a town stays where it is this season, unless it is at the front; and one army is
 * always left free to march. Returns how many moved.
 */
export function rivalMoves(c: Campaign, f: number): number {
  standDown(c, f); // at peace, what is over the standing force goes home (whoever the computer is playing for)
  lastMenHome(c, f); // and a people whose towns have no men left calls its men home
  massArmies(c, f); // armies too weak to win alone come together
  if (!rival(c, f)) return 0;
  let moved = 0;
  // The garrison of a town that wants one holds. (Without an army in it the count is of a town left open.)
  const held = new Set<number>();
  // An army with foreign land beside it is at the front and goes on with the war; one behind the lines stays to hold.
  const front = (a: Army): boolean => c.territories[a.at].adj.some((n) => c.territories[n].owner !== f);
  const mine = c.armies.filter((a) => a.owner === f);
  for (const a of mine) {
    // Never its last free army: a nation with every army pinned at home has stopped fighting its war.
    if (held.size >= mine.length - 1) break;
    if (c.territories[a.at].owner === f && !front(a) && threatened(c, a.at)) { a.moved = true; held.add(a.id); }
  }
  for (const t of towns(c, f)) {
    if (armyAt(c, t.id) || !threatened(c, t.id)) continue;
    const near = c.armies.filter((a) => a.owner === f && !a.moved && !held.has(a.id) && !a.hero && c.territories[a.at].owner === f && c.territories[a.at].adj.includes(t.id) && !threatened(c, a.at))
      .sort((p, q) => Object.values(p.units).reduce((n, v) => n + v, 0) - Object.values(q.units).reduce((n, v) => n + v, 0) || p.id - q.id)[0];
    if (near && HUB.moveArmy(c, near.id, t.id) === 'moved') { near.moved = true; moved++; }
  }
  return moved;
}

/** A season of a rival's rule, for every computer-led nation; and the naming of soldiers, for all. */
/**
 * A poor people still musters. A rival at war or mustering that cannot pay for a company out of what its towns
 * can spare (its supplies: stores.ts counts only what is over each town's keep) raises one all the same, out of
 * the working stock of one town, so long as the price is no more than `RIVAL.stock` of what that town holds: its
 * bread last. It is raised at a town with a yard, or failing any at its chief town, as plain infantry; its men
 * are the people's own, within what a town keeps (armytown.ts). One company a season, and none at peace.
 * Without this a people ruined by war, with men in its last town and nothing over its keep, sat a thousand
 * seasons unable to raise a spear. Returns the land it was raised in, or -1.
 */
export function poorMuster(c: Campaign, f: number): number {
  if (!rival(c, f) || warFooting(c, f) === 'peace') return -1;
  const own = towns(c, f);
  const kinds = Object.keys(COMPANIES);
  if (own.some((t) => kinds.some((k) => HUB.canRaise(c, f, t.id, k)))) return -1; // it can pay in the ordinary way
  if (!own.some((t) => sparedMen(c, t.id) > 0)) return -1; // nobody to send
  const stock = (t: Territory): number => STORE_KINDS.reduce((n, k) => n + Math.max(0, folkOf(c, t.id).stores[k]), 0);
  const free = (t: Territory): boolean => { const a = armyAt(c, t.id); return !a || (a.owner === f && armySize(a) < MAX_ARMY); };
  const yards = own.filter((t) => free(t) && kinds.some((k) => t.buildings.includes(COMPANIES[k].needs)));
  const chief = own.find((t) => t.capital === f) ?? [...own].sort((a, b) => headcount(folkOf(c, b.id)) - headcount(folkOf(c, a.id)) || a.id - b.id)[0];
  const places = yards.length ? yards : chief && free(chief) ? [chief] : [];
  for (const t of [...places].sort((a, b) => stock(b) - stock(a) || a.id - b.id)) {
    const kind = kinds.filter((k) => t.buildings.includes(COMPANIES[k].needs)).sort((a, b) => COMPANIES[a].cost - COMPANIES[b].cost)[0] ?? 'infantry';
    const price = companyCost(t, kind, c.factions[f].civ, hireOff(c, f, t.id)) * SUPPLY_UNITS;
    if (price > stock(t) * RIVAL.stock) continue;
    let a = armyAt(c, t.id);
    const fresh = !a;
    if (!a) { a = { id: c.nextArmy++, owner: f, at: t.id, units: {}, hero: false, vet: c.factions[f].civ === 'japan' ? 1 : 0, moved: true }; c.armies.push(a); }
    a.units[kind] = (a.units[kind] ?? 0) + 1;
    if (!menMustered(c, a, t.id)) { // nobody of an age to go after all: nothing is raised and nothing spent
      if (--a.units[kind] <= 0) delete a.units[kind];
      if (fresh) { c.armies.splice(c.armies.indexOf(a), 1); delete c.musters?.[a.id]; } else if (c.musters?.[a.id]) c.musters[a.id].size = armySize(a);
      continue;
    }
    const s = folkOf(c, t.id).stores;
    let left = price;
    for (const k of [...STORE_KINDS].filter((x) => x !== 'food').sort((x, y) => s[y] - s[x])) { const part = Math.min(Math.max(0, s[k]), left); s[k] -= part; left -= part; }
    if (left > 0) s.food = Math.max(0, s.food - left);
    return t.id;
  }
  return -1;
}
/** Note the age a rival is in, and when it came to it. */
function sawAge(c: Campaign, f: number): void {
  const age = Math.max(0, Math.round(Number(c.factions[f]?.age) || 0)), seen = (c.aged ??= {})[f];
  if (!seen || seen.age !== age) c.aged[f] = { age, at: seen ? c.turn : 0 };
}
/**
 * May this rival take its next age yet? A people lives in an age `RIVAL.settle` seasons before the next, however
 * full its stores: without this a rich rival took two ages within a few seasons of each other. Its first age waits
 * only on its stores. The player is not held to it.
 */
export function mayAdvance(c: Campaign, f: number): boolean {
  sawAge(c, f);
  const seen = c.aged![f];
  return seen.age === 0 || c.turn - seen.at >= RIVAL.settle;
}
export function rivalSeason(c: Campaign): { laid: number; home: number; named: number; homes: number } {
  const out = { laid: 0, home: 0, named: 0, homes: 0 };
  out.laid = layTowns(c);
  for (const x of c.factions) {
    if (!rival(c, x.id)) continue;
    for (const t of towns(c, x.id)) { if (notableHome(c, t.id)) out.homes++; rivalOrders(c, t.id); }
    out.home += homeIdle(c, x.id);
    sawAge(c, x.id);
  }
  out.named = nameVeterans(c).named;
  return out;
}
