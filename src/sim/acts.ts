// Acts of God on the map: a season of famine, plague and fire in every land that is held (docs/DESIGN.md).
//
// Inside a battle these are rules about people and buildings (famine.ts, contagion.ts, calamity.ts). Out on the
// map a town the player is not in lives the same season run coarsely, and this is that: once a season, each held
// land may be struck by one of the three. They come at random and spare nobody, but they go by the holder's creed,
// by the same measure as in a battle (the creed's figure in creed.ts, as wrath.ts reads it): it scales both how
// often a thing comes and how bad it is, so that a Righteous people has them a third as often and a third as
// hard, and is very rarely struck hard at all.
//
// They fall on the real town on the land: its stores and its people as township.ts keeps them (stores.ts).
//
//   Famine. The harvest fails: the town eats from its own granary ACTS.hunger seasons of its own eating (larder.ts),
//     by that measure, in food. Struck hard, a town whose granary cannot cover it sees the army standing there
//     lose a company: men walk away unfed. Never where rain is over the land; twice as often under dust.
//   Plague. Sickness is in the land for a season or more. Each season it lasts it kills a share of the town's
//     grown people from the record, the old first, an army of the holder's standing there loses a company, and it
//     may pass to a held land next door, by that land's holder's creed. Children are never harmed.
//   Fire. The town burns: a share of its food and wood goes up (gold and stone do not burn), the holder pays to
//     rebuild out of the town's own stores, and the town on that land's battlefield, if there is one, is found damaged by
//     whoever next fights there. Struck hard, one of the land's works (a farm, a barracks...) burns down. Never
//     where rain is over the land; twice as often under dust.
//
// Decided by a run of chances of its own, so the rest of a campaign's luck is left as it was. Faith is still a
// people's and not yet a town's, so every land of a people stands the same; and the dead of plague are counted,
// not named.
import type { Army, Campaign, EventKind, Territory } from './campaign';
import { weatherAt } from './campaignbase';
import { armySize } from './campaignbase';
import { whoseOf } from './naming';
import { creedOf } from './creed';
import { faithAt } from './townfaith';
import { STORE_KINDS, folkOf, headcount } from './township';
import type { Stores } from './township';
import { SUPPLY_UNITS } from './stores';
import { needOf } from './larder';
import { tally } from './ledger';
import { tendedPlague } from './decrees';
import { famineShare } from './granary';
import { wellEase } from './well';
import { infirmaryCare } from './infirmary';
import { rotationFail } from './croprotation'; // food and health studies
import { quarantinePass } from './quarantine';
import { physicianCare } from './physicians';

export const ACTS = {
  /** The season from which they may come. */
  from: 3,
  /** The chance, each season, that a land of an ordinary people is struck by each. */
  famine: 0.02, plague: 0.015, fire: 0.02,
  /** Famine: seasons of the town's own eating a failed harvest takes from its granary, for an ordinary people. */
  hunger: 1.5,
  /** Fire and famine: this many times as likely where dust is over the land. Neither comes where it rains. */
  dry: 2,
  /** A strike is a hard one with this chance, times the measure squared: one in forty for the Righteous. */
  hard: 0.25,
  /** Plague: seasons it lasts for an ordinary people, the share of the town's grown people it kills a season (one at least), and the chance each season of its passing next door. */
  seasons: 2, sick: 0.1, spread: 0.25,
  /** Crowding breeds plague: a town of this many people or more is struck, passed to and killed in full; a smaller one in proportion. */
  crowd: 20,
  /** Fire: supplies it costs an ordinary people to rebuild, the share of their strength the town's buildings lose, and the share of its food and wood that burns. */
  rebuild: 3, burnt: 0.35, stores: 0.3,
  /** Works a fire cannot burn down. */
  stone: ['fortress'] as string[],
};

export type Act = 'famine' | 'plague' | 'blaze';
/**
 * What fell where. `cost`: supplies paid (famine: the food eaten, in supplies; fire: the rebuilding). `food`: food
 * a famine ate. `dead`: grown people plague killed. `burnt`: stores fire burnt.
 */
export interface Struck { kind: Act; at: number; owner: number; hard: boolean; cost: number; company: boolean; lost?: string; seasons?: number; from?: number; food?: number; dead?: number; burnt?: Stores }

/** How hard acts of God fall on this people: the same measure as in a battle (wrath.ts). 1 for the local tribes. */
export const wrathOf = (c: Campaign, f: number): number => (f < 0 || !c.factions[f] ? 1 : creedOf(c.factions[f].virtue ?? 0).plague);
/** How hard acts of God fall on this town: by its own standing (townfaith.ts), as faith is a town's. 1 for the local tribes. */
export const wrathAt = (c: Campaign, tid: number): number => (c.territories[tid]?.owner < 0 ? 1 : creedOf(faithAt(c, tid)).plague);

/** A chance in [0, 1) from the campaign's seed, the season, a land and a number of its own. */
export function chance(c: Campaign, land: number, salt: number): number {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(land * 131 + salt + 1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const whose = (c: Campaign, f: number): string => whoseOf(c, f); // "your", "the Arameans'" (naming.ts)
const who = (c: Campaign, f: number): string => (f === 0 ? 'you' : c.factions[f].name);
const mark = (c: Campaign, kind: EventKind, at: number, turns = 0): void => { (c.events ??= []).push({ kind, at, turn: c.turn, until: c.turn + turns }); };
const sickAt = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);
const ownArmy = (c: Campaign, t: Territory): Army | undefined => c.armies.find((a) => a.at === t.id && a.owner === t.owner);
/** An army loses a company, though never its last. Returns whether it did. */
function thin(a: Army | undefined): boolean {
  if (!a || armySize(a) <= 1) return false;
  const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x] || (x < y ? -1 : 1))[0];
  if (--a.units[type] <= 0) delete a.units[type];
  return true;
}

/**
 * How crowded a town is, for plague: its people (the men away with its armies not among them) over ACTS.crowd, at
 * most 1. A hamlet of a few people is seldom struck, seldom passed to, and loses fewer; a town of ACTS.crowd or
 * more is as it ever was. The holder's creed is measured apart (wrathAt) and is not changed by it.
 */
export const crowding = (c: Campaign, tid: number): number => Math.min(1, headcount(folkOf(c, tid)) / ACTS.crowd) * wellEase(c, tid); // a Well eases it (well.ts)
/** A season of plague in a town: a share of its grown people die, the old first, then men and women in turn. Never a child. */
export function sicken(c: Campaign, t: Territory): number {
  const k = folkOf(c, t.id), grownNow = k.men + k.women + k.elders;
  // The share it kills, less in a small town; what is less than one whole person is a chance of one.
  // The church tending the sick spares some (decrees.ts), and so does an Infirmary (infirmary.ts).
  const due = grownNow * ACTS.sick * crowding(c, t.id) * (1 - tendedPlague(c, t.id)) * infirmaryCare(c, t.id) * physicianCare(c, t.owner), whole = Math.floor(due) + (chance(c, t.id, 59) < due - Math.floor(due) ? 1 : 0);
  let n = Math.min(grownNow, crowding(c, t.id) >= 1 ? Math.max(1, Math.round(due)) : whole), dead = 0, man = chance(c, t.id, 53) < 0.5;
  while (n-- > 0) {
    if (k.elders > 0) k.elders--;
    else if ((man && k.men > 0) || k.women <= 0) { if (k.men <= 0) break; k.men--; man = false; }
    else { k.women--; man = true; }
    dead++;
  }
  tally(c, t.id, 'sick', dead); // for the season's report (ledger.ts)
  return dead; // the ages on the record follow the counts the next time they are read (ageing.ts)
}

function famine(c: Campaign, t: Territory, w: number, hard: boolean): Struck {
  const f = t.owner;
  // The town eats from its own granary for as long as the harvest failed: ACTS.hunger seasons of its own eating, by the measure.
  const due = Math.max(1, Math.round(ACTS.hunger * needOf(c, t.id) * w * famineShare(c, t.id))); // less from a Granary's store (granary.ts)
  const store = folkOf(c, t.id).stores, food = Math.min(store.food, due);
  store.food -= food;
  const short = food < due, paid = Math.round(food / SUPPLY_UNITS);
  const company = hard && short && thin(ownArmy(c, t));
  mark(c, 'famine', t.id);
  c.log.push(`The harvest has failed in ${t.name}: the town eats ${food} of its stored food${short ? ', and it is not enough: the granary is empty' : ''}.${company ? ` Unfed, a company of ${whose(c, f)} army there has walked away.` : ''}`);
  return { kind: 'famine', at: t.id, owner: f, hard, cost: paid, company, food };
}

function plague(c: Campaign, t: Territory, w: number, hard: boolean, from?: number): Struck {
  const seasons = Math.max(1, Math.round(ACTS.seasons * w)) + (hard ? 1 : 0);
  mark(c, 'plague', t.id, seasons - 1);
  c.log.push(from === undefined
    ? `Plague has broken out in ${t.name}. While it lasts it will take ${whose(c, t.owner)} people there a season at a time, and an army kept there will sicken.`
    : `The plague in ${c.territories[from].name} has passed to ${t.name}.`);
  return { kind: 'plague', at: t.id, owner: t.owner, hard, cost: 0, company: false, seasons, ...(from === undefined ? {} : { from }) };
}

function blaze(c: Campaign, t: Territory, w: number, hard: boolean): Struck {
  const f = t.owner;
  // Food and timber go up; gold and stone do not burn. Then the town is rebuilt out of what is left.
  const store = folkOf(c, t.id).stores, share = Math.min(0.9, ACTS.stores * w), burnt: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const k of ['food', 'wood'] as const) { burnt[k] = Math.floor(store[k] * share); store[k] -= burnt[k]; }
  // The town is rebuilt out of its own stores, wood and stone first: never out of the nation's other towns.
  const owed = Math.max(1, Math.round(ACTS.rebuild * w)) * SUPPLY_UNITS;
  let left = owed;
  for (const k of ['wood', 'stone', 'gold', 'food'] as const) { const n = Math.min(store[k], left); store[k] -= n; left -= n; }
  const paid = Math.floor((owed - left) / SUPPLY_UNITS);
  if (t.town) for (const b of t.town.b) b[3] = Math.max(0.1, Math.round((b[3] ?? 1) * (1 - Math.min(0.9, ACTS.burnt * w)) * 100) / 100);
  let lost: string | undefined;
  if (hard) {
    const burns = t.buildings.filter((b) => !ACTS.stone.includes(b));
    if (burns.length) { lost = burns[Math.floor(chance(c, t.id, 47) * burns.length)]; t.buildings.splice(t.buildings.indexOf(lost), 1); }
  }
  mark(c, 'blaze', t.id);
  const went = STORE_KINDS.filter((k) => burnt[k]).map((k) => `${burnt[k]} ${k}`).join(' and ');
  c.log.push(`Fire has gone through the town at ${t.name}${went ? `: ${went} burnt in store, and` : ':'} it costs ${who(c, f)} ${paid} ${paid === 1 ? 'supply' : 'supplies'} to rebuild${lost ? `, and the ${lost} there is burnt to the ground` : ''}.`);
  return { kind: 'blaze', at: t.id, owner: f, hard, cost: paid, company: false, burnt, ...(lost ? { lost } : {}) };
}

/**
 * One season of acts of God over the whole map. Called once a turn, after the weather has moved. Returns what
 * fell where, for whoever wants to tell of it; the same is written in the campaign's log and marked on the map.
 */
export function actsOfGod(c: Campaign): Struck[] {
  const out: Struck[] = [];
  // Plague that is already in a land: it takes its toll, and may pass next door.
  for (const t of c.territories) {
    if (t.owner < 0 || !c.factions[t.owner]?.alive || !sickAt(c, t.id)) continue;
    const dead = sicken(c, t);
    const company = thin(ownArmy(c, t));
    if (dead) c.log.push(`Plague in ${t.name} has killed ${dead} of ${whose(c, t.owner)} people there this season.`);
    if (company) c.log.push(`Plague in ${t.name} costs ${whose(c, t.owner)} army there a company.`);
    out.push({ kind: 'plague', at: t.id, owner: t.owner, hard: false, cost: 0, company, dead });
    const next = t.adj.map((id) => c.territories[id]).filter((n) => n.owner >= 0 && c.factions[n.owner]?.alive && !sickAt(c, n.id));
    if (!next.length) continue;
    const n = next[Math.floor(chance(c, t.id, 31) * next.length)];
    const w = wrathAt(c, n.id);
    if (chance(c, t.id, 37) < ACTS.spread * w * crowding(c, n.id) * quarantinePass(c, t.owner, n.owner)) out.push(plague(c, n, w, false, t.id)); // it passes to a crowded town sooner than a hamlet
  }
  if (c.turn < ACTS.from) return out;
  const fresh = new Set(out.filter((s) => s.from !== undefined).map((s) => s.at));
  for (const t of c.territories) {
    if (t.owner < 0 || !c.factions[t.owner]?.alive || fresh.has(t.id)) continue;
    const w = wrathAt(c, t.id), sky = weatherAt(c, t.id);
    const dry = sky === 'rain' ? 0 : sky === 'dust' ? ACTS.dry : 1;
    // One roll decides which, if any: a land is struck by one thing in a season at most.
    const r = chance(c, t.id, 3), hard = chance(c, t.id, 5) < ACTS.hard * w * w;
    const pFamine = ACTS.famine * w * dry * rotationFail(c, t.owner), pPlague = sickAt(c, t.id) ? 0 : ACTS.plague * w * crowding(c, t.id), pFire = ACTS.fire * w * dry;
    if (r < pFamine) out.push(famine(c, t, w, hard));
    else if (r < pFamine + pPlague) out.push(plague(c, t, w, hard));
    else if (r < pFamine + pPlague + pFire) out.push(blaze(c, t, w, hard));
  }
  return out;
}
