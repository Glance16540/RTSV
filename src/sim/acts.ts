// Acts of God on the map: a season of famine, plague and fire in every land that is held (docs/DESIGN.md).
//
// Inside a battle these are rules about people and buildings (famine.ts, contagion.ts, calamity.ts). Out on the
// map a town the player is not in lives the same season run coarsely, and this is that: once a season, each held
// land may be struck by one of the three. They come at random and spare nobody, but they go by the holder's creed,
// by the same measure as in a battle (the creed's figure in creed.ts, as wrath.ts reads it): it scales both how
// often a thing comes and how bad it is, so that a Righteous people has them a third as often and a third as
// hard, and is very rarely struck hard at all.
//
//   Famine. The harvest fails: the holder loses what the land would have yielded this season, by that measure.
//     Struck hard, a people that cannot make up the loss from its stores sees the army standing there lose a
//     company: men walk away unfed. Never where rain is over the land; twice as often under dust.
//   Plague. Sickness is in the land for a season or more. While it lasts the land costs its holder a supply a
//     season, an army of the holder's standing there loses a company a season, and each season it may pass to a
//     held land next door, by that land's holder's creed.
//   Fire. The town burns: the holder pays to rebuild, and the town on that land's battlefield, if there is one,
//     is found damaged by whoever next fights there. Struck hard, one of the land's works (a farm, a barracks...)
//     burns down. Never where rain is over the land; twice as often under dust.
//
// Decided by a run of chances of its own, so the rest of a campaign's luck is left as it was. Faith is still a
// people's and not yet a town's, so every land of a people stands the same; and a land's own people and stores
// are not yet kept, so what is lost is counted in supplies and companies, not in names.
import type { Army, Campaign, EventKind, Territory } from './campaign';
import { armySize, territoryIncome, weatherAt } from './campaign';
import { creedOf } from './creed';

export const ACTS = {
  /** The season from which they may come. */
  from: 3,
  /** The chance, each season, that a land of an ordinary people is struck by each. */
  famine: 0.02, plague: 0.015, fire: 0.02,
  /** Fire and famine: this many times as likely where dust is over the land. Neither comes where it rains. */
  dry: 2,
  /** A strike is a hard one with this chance, times the measure squared: one in forty for the Righteous. */
  hard: 0.25,
  /** Plague: seasons it lasts for an ordinary people, what the land costs a season, and the chance each season of its passing next door. */
  seasons: 2, sick: 1, spread: 0.25,
  /** Fire: supplies it costs an ordinary people, and the share of their strength the town's buildings lose. */
  rebuild: 3, burnt: 0.35,
  /** Works a fire cannot burn down. */
  stone: ['fortress'] as string[],
};

export type Act = 'famine' | 'plague' | 'blaze';
export interface Struck { kind: Act; at: number; owner: number; hard: boolean; cost: number; company: boolean; lost?: string; seasons?: number; from?: number }

/** How hard acts of God fall on this people: the same measure as in a battle (wrath.ts). 1 for the local tribes. */
export const wrathOf = (c: Campaign, f: number): number => (f < 0 || !c.factions[f] ? 1 : creedOf(c.factions[f].virtue ?? 0).plague);

/** A chance in [0, 1) from the campaign's seed, the season, a land and a number of its own. */
export function chance(c: Campaign, land: number, salt: number): number {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(land * 131 + salt + 1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const whose = (c: Campaign, f: number): string => (f === 0 ? 'your' : `${c.factions[f].name}'s`);
const who = (c: Campaign, f: number): string => (f === 0 ? 'you' : c.factions[f].name);
const mark = (c: Campaign, kind: EventKind, at: number, turns = 0): void => { (c.events ??= []).push({ kind, at, turn: c.turn, until: c.turn + turns }); };
const sickAt = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);
const pay = (c: Campaign, f: number, n: number): number => { const x = c.factions[f], paid = Math.min(x.supplies, n); x.supplies -= paid; return paid; };
const ownArmy = (c: Campaign, t: Territory): Army | undefined => c.armies.find((a) => a.at === t.id && a.owner === t.owner);
/** An army loses a company, though never its last. Returns whether it did. */
function thin(a: Army | undefined): boolean {
  if (!a || armySize(a) <= 1) return false;
  const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x] || (x < y ? -1 : 1))[0];
  if (--a.units[type] <= 0) delete a.units[type];
  return true;
}

function famine(c: Campaign, t: Territory, w: number, hard: boolean): Struck {
  const f = t.owner;
  const due = Math.max(1, Math.round(territoryIncome(t, c.factions[f].civ) * w));
  const paid = pay(c, f, due);
  const company = hard && paid < due && thin(ownArmy(c, t));
  mark(c, 'famine', t.id);
  c.log.push(`The harvest has failed in ${t.name}: ${paid} of ${whose(c, f)} supplies go to feed it${paid < due ? ', and it is not enough' : ''}.${company ? ` Unfed, a company of ${whose(c, f)} army there has walked away.` : ''}`);
  return { kind: 'famine', at: t.id, owner: f, hard, cost: paid, company };
}

function plague(c: Campaign, t: Territory, w: number, hard: boolean, from?: number): Struck {
  const seasons = Math.max(1, Math.round(ACTS.seasons * w)) + (hard ? 1 : 0);
  mark(c, 'plague', t.id, seasons - 1);
  c.log.push(from === undefined
    ? `Plague has broken out in ${t.name}. While it lasts the land costs ${who(c, t.owner)} a supply a season, and an army kept there will sicken.`
    : `The plague in ${c.territories[from].name} has passed to ${t.name}.`);
  return { kind: 'plague', at: t.id, owner: t.owner, hard, cost: 0, company: false, seasons, ...(from === undefined ? {} : { from }) };
}

function blaze(c: Campaign, t: Territory, w: number, hard: boolean): Struck {
  const f = t.owner;
  const paid = pay(c, f, Math.max(1, Math.round(ACTS.rebuild * w)));
  if (t.town) for (const b of t.town.b) b[3] = Math.max(0.1, Math.round((b[3] ?? 1) * (1 - Math.min(0.9, ACTS.burnt * w)) * 100) / 100);
  let lost: string | undefined;
  if (hard) {
    const burns = t.buildings.filter((b) => !ACTS.stone.includes(b));
    if (burns.length) { lost = burns[Math.floor(chance(c, t.id, 47) * burns.length)]; t.buildings.splice(t.buildings.indexOf(lost), 1); }
  }
  mark(c, 'blaze', t.id);
  c.log.push(`Fire has gone through the town at ${t.name}: it costs ${who(c, f)} ${paid} ${paid === 1 ? 'supply' : 'supplies'} to rebuild${lost ? `, and the ${lost} there is burnt to the ground` : ''}.`);
  return { kind: 'blaze', at: t.id, owner: f, hard, cost: paid, company: false, ...(lost ? { lost } : {}) };
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
    const paid = pay(c, t.owner, ACTS.sick);
    const company = thin(ownArmy(c, t));
    if (company) c.log.push(`Plague in ${t.name} costs ${whose(c, t.owner)} army there a company.`);
    out.push({ kind: 'plague', at: t.id, owner: t.owner, hard: false, cost: paid, company });
    const next = t.adj.map((id) => c.territories[id]).filter((n) => n.owner >= 0 && c.factions[n.owner]?.alive && !sickAt(c, n.id));
    if (!next.length) continue;
    const n = next[Math.floor(chance(c, t.id, 31) * next.length)];
    const w = wrathOf(c, n.owner);
    if (chance(c, t.id, 37) < ACTS.spread * w) out.push(plague(c, n, w, false, t.id));
  }
  if (c.turn < ACTS.from) return out;
  const fresh = new Set(out.filter((s) => s.from !== undefined).map((s) => s.at));
  for (const t of c.territories) {
    if (t.owner < 0 || !c.factions[t.owner]?.alive || fresh.has(t.id)) continue;
    const w = wrathOf(c, t.owner), sky = weatherAt(c, t.id);
    const dry = sky === 'rain' ? 0 : sky === 'dust' ? ACTS.dry : 1;
    // One roll decides which, if any: a land is struck by one thing in a season at most.
    const r = chance(c, t.id, 3), hard = chance(c, t.id, 5) < ACTS.hard * w * w;
    const pFamine = ACTS.famine * w * dry, pPlague = sickAt(c, t.id) ? 0 : ACTS.plague * w, pFire = ACTS.fire * w * dry;
    if (r < pFamine) out.push(famine(c, t, w, hard));
    else if (r < pFamine + pPlague) out.push(plague(c, t, w, hard));
    else if (r < pFamine + pPlague + pFire) out.push(blaze(c, t, w, hard));
  }
  return out;
}
