/**
 * Armies belong to towns (docs/DESIGN.md). An army is the men of the town that raised it: when a company is
 * raised, men of working age leave the town's record and are carried on the army's roll (`Campaign.musters`),
 * town by town, each at his own age. The army's dead are those towns' dead: when companies are lost, men are
 * struck from the roll for good. When the army is sent home its men go back onto their towns' records, and a
 * soldier who made a name is one of the notable people of the town he came from.
 *
 * A company still marches if its town cannot man it in full: the shortfall are men of no town (see the board).
 */
import { downIn } from './soldiernames';
import type { Army, Campaign } from './campaign';
import { agesOf, countFrom, GROWN_SEASON, GROWN_YEARS, OLD_SEASON, LAST_SEASON } from './ageing';
import { awayFrom, cameHome, enlist, fell, levelArmies, settleHouses } from './warhouse';
import { folkOf, TOWN_SCALE } from './township';
import { rememberOf } from './veteranhome';
import { tally } from './ledger';

/**
 * Seasons an army rests in a town it has just taken before it marches again: it buries its dead, sets a watch
 * and brings the town to order. (It is what keeps a campaign from being a land a season.)
 */
export const ARMY_REST = 6;
/** Is this army still resting from its last assault as this turn begins? */
export const resting = (c: Campaign, a: Army): boolean => (a.rest ?? 0) >= c.turn;

/** Men a company takes, by the size of towns (MEN.company below is this). */
const MEN_PER = TOWN_SCALE > 1 ? 1 : 2;
/**
 * What a battle costs in men. Of the men of the companies an army loses, this share are dead when the army still
 * stands (`won`) and when it is broken (`lost`); the rest are wounded or routed, and make their way home to their
 * own towns. And what raising may take: a town keeps `floor` men at the least, and a man for every woman of
 * working age up to `couples` of them, so that it still has husbands.
 */
export const MEN = { /** Men a company takes: one in towns of the larger size (docs/DESIGN.md, a man of the town and his following), two in the old. */ company: MEN_PER, won: 0.3, lost: 0.4, floor: 2 * TOWN_SCALE, couples: TOWN_SCALE > 1 ? 0.34 : 0.5, /** A company its town cannot man in full is filled from its people's other towns. */ levy: true, /** The share of all its men a people will have with its armies at the most: past it, a company raised is hired men. A stop for towns of the old size; at the larger size it is not asked (1), since no company is hired. */ share: TOWN_SCALE > 1 ? 1 : 0.25, /** Men a company must find, in its town or its people's others, to be raised at all. None while towns are the old size (TOWN_SCALE 1): founded at four to six men they cannot carry the armies the map is fought with, and over half of 192 campaigns end in ruin. At the larger size it asks for every man of the company: none is hired. */ least: TOWN_SCALE > 1 ? MEN_PER : 0 };
/** Men in a company as towns are sized. The rules read `MEN.company`, which a test of the workings may set; this is for whoever only wants the figure. */
export const MEN_A_COMPANY = MEN_PER;
/** Men in a company. */
/** An army's roll: how many companies it had when last reckoned, and the men with it by the town they came from (their ages, in seasons). */
export interface Muster { size: number; men: Record<string, number[]>; /** Whose army it is, kept so its men can find their way home if it is broken. */ owner?: number }
/** Men of a town who fell with an army. */
export interface Fallen { town: number; army: number; dead: number; lost: boolean; /** Men of the lost companies who came home alive. */ home?: number; /** The dead by name, each with his house (warhouse.ts). */ names?: string[] }

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const sizeOf = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);
const rolls = (c: Campaign): Record<string, Muster> => (c.musters ??= {});
const total = (m: Muster): number => Object.values(m.men).reduce((n, l) => n + l.length, 0);

/** The roll of an army, if it has one. */
export const musterOf = (c: Campaign, armyId: number): Muster | undefined => c.musters?.[armyId];
/** How many of an army's men are of some town, and how many are of none. */
export function menOf(c: Campaign, a: Army): { town: number; none: number } {
  const town = musterOf(c, a.id) ? total(musterOf(c, a.id)!) : 0;
  return { town, none: Math.max(0, sizeOf(a) * MEN.company - town) };
}
export { awayFrom } from './warhouse'; // men of a town away with the armies: read off the rolls there, so that warhouse.ts need not import this module
/** The town most of an army's men came from: where its veterans are remembered. */
export function homeOf(c: Campaign, a: Army): number | undefined {
  const m = musterOf(c, a.id);
  if (!m) return undefined;
  const best = Object.entries(m.men).filter(([, l]) => l.length).sort((p, q) => q[1].length - p[1].length || Number(p[0]) - Number(q[0]))[0];
  return best ? Number(best[0]) : undefined;
}

/** Men a town can send without going below what it keeps: `MEN.floor`, and a man for every woman up to `MEN.couples`. */
export const sparedMen = (c: Campaign, tid: number): number => { const f = folkOf(c, tid); return Math.max(0, f.men - Math.max(MEN.floor, Math.ceil(f.women * MEN.couples))); };
/** Take up to `want` of a town's youngest grown men onto this roll, never below what the town keeps. Returns how many went. */
function take(c: Campaign, m: Muster, tid: number, want: number, army: number): number {
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  const young = ages.m.map((s, i) => [s, i] as [number, number]).filter(([s]) => s < OLD_SEASON).sort((p, q) => p[0] - q[0] || p[1] - q[1]).slice(0, Math.min(want, sparedMen(c, tid)));
  if (!young.length) return 0;
  const gone = new Set(young.map(([, i]) => i));
  (m.men[tid] ??= []).push(...young.map(([s]) => s));
  countFrom(f, { m: ages.m.filter((_, i) => !gone.has(i)), f: ages.f, k: ages.k });
  enlist(c, tid, young.length, army); // each is of a house of the town, and stays on its record as away with this army (warhouse.ts)
  return young.length;
}
/** A people's men at home and with its armies (on the rolls). */
export function menOfNation(c: Campaign, f: number): { away: number; home: number } {
  let away = 0, home = 0;
  for (const m of Object.values(c.musters ?? {})) if (m.owner === f) away += total(m);
  for (const t of c.territories) if (t.owner === f && !t.horde && t.folk) home += t.folk.men;
  return { away, home };
}
/** How many more of its men a people will send to its armies: up to `MEN.share` of them all, counting those already away. */
export function menLeftToSend(c: Campaign, f: number): number {
  const { away, home } = menOfNation(c, f);
  return Math.max(0, Math.floor(MEN.share * (away + home)) - away);
}
/**
 * A company has just been raised in this town and joined this army: its men are the town's. The youngest grown
 * men go, as many as a company takes or as the town can spare (`MEN.floor`, `MEN.couples`). Where the town cannot
 * man the company in full, the rest are called from the other towns of its people, the town with most men to
 * spare first, each within what it keeps (`MEN.levy`: no, and the rest are men of no town). Returns how many
 * men went, from all towns.
 */
export function menMustered(c: Campaign, a: Army, tid: number, o: { /** These men have gone already (trained in person in their town): the share a people sends is not asked. */ gone?: boolean } = {}): number {
  const m = (rolls(c)[a.id] ??= { size: 0, men: {} });
  m.size = sizeOf(a); m.owner = a.owner;
  const t = c.territories[tid];
  if (!t || t.owner !== a.owner) return 0;
  // A people sends so many of its men to its armies and no more (`MEN.share`): past that a company is filled with hired men of no town.
  const want = o.gone ? MEN.company : Math.min(MEN.company, menLeftToSend(c, a.owner));
  let went = want > 0 ? take(c, m, tid, want, a.id) : 0;
  if (went < want && MEN.levy) {
    const others = c.territories.filter((x) => x.owner === a.owner && !x.horde && x.id !== tid && x.folk).map((x) => ({ id: x.id, spare: sparedMen(c, x.id) })).filter((x) => x.spare > 0).sort((p, q) => q.spare - p.spare || p.id - q.id);
    for (const o of others) { if (went >= want) break; went += take(c, m, o.id, want - went, a.id); }
  }
  return went;
}
/**
 * One particular man of a town goes to an army: the man at this place in the town's record of its men's ages
 * (`agesOf(...).m`). He is taken off the town's count at that age, put on the army's roll, and is on a house's
 * record as away with it, by the name given (warhouse.ts). For a man already chosen and trained in his town
 * (queuedmen.ts): what a town keeps back and the share a people sends are not asked of him. The company he is
 * the man of must already be counted in the army's units. Returns whether he went.
 */
export function musterMan(c: Campaign, a: Army, tid: number, place: number, who?: { name: string; family?: string }): boolean {
  const m = (rolls(c)[a.id] ??= { size: 0, men: {} });
  m.size = sizeOf(a); m.owner = a.owner;
  const t = c.territories[tid];
  if (!t || t.owner !== a.owner) return false;
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  if (place < 0 || place >= ages.m.length) return false;
  (m.men[tid] ??= []).push(ages.m[place]);
  countFrom(f, { m: ages.m.filter((_, i) => i !== place), f: ages.f, k: ages.k });
  enlist(c, tid, 1, a.id, who ? [who] : undefined);
  return true;
}
/**
 * Men a company raised in this town could be given: what the town can spare, and (`MEN.levy`) what its people's
 * other towns can. With fewer than `MEN.least` it is not raised at all (campaign.ts, canRaise): a soldier costs a
 * person, and where there is nobody to send there is no company. (`MEN.least` is a company's whole count in towns of the larger size, and nothing in the old: see there.)
 */
export function menToRaise(c: Campaign, f: number, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner !== f) return 0;
  const young = (id: number): number => Math.min(sparedMen(c, id), agesOf(c, id, folkOf(c, id)).m.filter((s) => s < OLD_SEASON).length);
  let n = young(tid);
  if (MEN.levy) for (const x of c.territories) if (x.owner === f && !x.horde && x.id !== tid && x.folk) n += young(x.id);
  return n;
}
/**
 * What the panel says of the men a company raised here would have; nothing if the towns can man it in full.
 * Where `MEN.least` forbids it, why it cannot be raised; otherwise how many of its men are of no town.
 */
export function noMenText(c: Campaign, f: number, tid: number): string {
  const n = menToRaise(c, f, tid);
  if (n >= MEN.company) return '';
  const share = MEN.couples >= 0.45 ? 'half' : MEN.couples >= 0.3 ? 'a third' : 'a quarter';
  const keeps = `A town keeps ${MEN.floor} men at the least, and a husband for ${share} of its women.`;
  if (n < MEN.least) return `No men for it: ${n ? `your towns can spare only ${n}` : 'none of your towns can spare a man'}. ${keeps}`;
  return `${n ? `Your towns can spare only ${n} of the ${MEN.company} men a company takes` : 'None of your towns can spare a man'}: ${n ? 'the rest' : 'a company raised now'} will be hired men of no town, with no house to mourn them. ${keeps}`;
}
/** A founding army's men: grown, and young enough to march (eighteen to thirty-five), by lot. */
export const FOUNDING = { youngest: 18, oldest: 35 };
/**
 * The army a people begins the campaign with is its chief town's own men: as many for every company as a company takes (`MEN.company`), each of a house
 * of that town and on its record as away with the army (warhouse.ts), from the first turn. They are not taken off
 * the town's count: the count a town is founded with is of those at home, and these were already away. When the
 * army loses companies they are that town's dead, and when it stands down they come home to it. An army that
 * already has a roll, or stands on land that is not its people's town, is left as it is. Returns how many men
 * were put on its roll.
 */
export function foundingMuster(c: Campaign, a: Army): number {
  const all = rolls(c), t = c.territories[a.at];
  if (all[a.id] || !t || t.owner !== a.owner || t.horde || a.owner < 0) return 0;
  folkOf(c, t.id); // the town is on record before its men are away from it
  const n = sizeOf(a) * MEN.company, span = (FOUNDING.oldest - FOUNDING.youngest) * (GROWN_SEASON / GROWN_YEARS);
  const ages = Array.from({ length: n }, (_, i) => Math.round(FOUNDING.youngest * (GROWN_SEASON / GROWN_YEARS) + hash(c.seed * 23 + a.id * 7 + t.id, i + 900) * span)).sort((p, q) => p - q);
  all[a.id] = { size: sizeOf(a), men: { [t.id]: ages }, owner: a.owner };
  enlist(c, t.id, n, a.id);
  return n;
}
/**
 * Companies of men from one town join an army, a town of the army's people or another's (kin abroad sending men,
 * aftermath.ts; a story's men, storyturn.ts): as many companies as are asked, and room in the army, and as the town can
 * spare men for (`sparedMen`: never below what it keeps), `MEN.company` to a company. They are the town's youngest grown
 * men, taken off its count, on the army's roll, and on its houses' records as away with the army (warhouse.ts). Returns
 * how many companies came: none where the town can spare nobody.
 */
export function levyFrom(c: Campaign, a: Army, tid: number, companies: number, room = Infinity): number {
  const t = c.territories[tid];
  if (!t || t.horde || companies <= 0 || room <= 0) return 0;
  const f = folkOf(c, tid), young = agesOf(c, tid, f).m.filter((s) => s < OLD_SEASON).length;
  const n = Math.max(0, Math.min(companies, room, Math.floor(Math.min(sparedMen(c, tid), young) / MEN.company)));
  if (!n) return 0;
  a.units.infantry = (a.units.infantry ?? 0) + n;
  const m = (rolls(c)[a.id] ??= { size: 0, men: {} });
  m.owner = a.owner;
  take(c, m, tid, n * MEN.company, a.id);
  m.size = sizeOf(a);
  return n;
}

/**
 * A campaign saved before armies had rolls (it has no `musters` at all): every army is given one, its men drawn from
 * its people's towns (the town it stands in if it is theirs, else their chief town), each of a house there and on its
 * record as away with the army. The towns' counts are not changed: those men were off them already. Returns how many
 * men were put on rolls; nothing for a campaign that keeps rolls.
 */
export function rollOld(c: Campaign): number {
  if (c.musters !== undefined) return 0;
  c.musters = {};
  let n = 0;
  for (const a of c.armies) {
    if (a.owner < 0 || !c.factions[a.owner]) continue;
    const here = c.territories[a.at], mine = c.territories.filter((t) => t.owner === a.owner && !t.horde);
    const home = here && here.owner === a.owner && !here.horde ? here : mine.find((t) => t.capital === a.owner) ?? mine[0];
    if (!home) continue;
    folkOf(c, home.id);
    const k = sizeOf(a) * MEN.company, span = (FOUNDING.oldest - FOUNDING.youngest) * (GROWN_SEASON / GROWN_YEARS);
    const ages = Array.from({ length: k }, (_, i) => Math.round(FOUNDING.youngest * (GROWN_SEASON / GROWN_YEARS) + hash(c.seed * 29 + a.id * 11 + home.id, i + 1700) * span)).sort((p, q) => p - q);
    c.musters[a.id] = { size: sizeOf(a), men: { [home.id]: ages }, owner: a.owner };
    enlist(c, home.id, k, a.id);
    n += k;
  }
  return n;
}

/** Every army on the map that stands in a town of its own people and has no roll is given one out of that town: for a campaign as it begins. */
export function foundArmies(c: Campaign): number {
  let n = 0;
  for (const a of c.armies) n += foundingMuster(c, a);
  return n;
}
/** Two armies of one people have met and shared out their companies: their men are shared out the same way. */
export function armiesJoined(c: Campaign, a: Army, other: Army): void {
  const all = rolls(c), ma = all[a.id], mo = all[other.id];
  if (!ma && !mo) return;
  const sa = c.armies.includes(a) ? sizeOf(a) : 0, so = sizeOf(other);
  const pooled: Record<string, number[]> = {};
  for (const m of [mo, ma]) for (const [tid, l] of Object.entries(m?.men ?? {})) (pooled[tid] ??= []).push(...l);
  const to: Muster = { size: so, men: {}, owner: other.owner }, stay: Muster = { size: sa, men: {}, owner: a.owner };
  // The men go with the companies, in the share the companies went.
  for (const [tid, l] of Object.entries(pooled)) { const keep = sa + so ? Math.round((l.length * sa) / (sa + so)) : 0; if (keep) stay.men[tid] = l.slice(0, keep); if (l.length - keep) to.men[tid] = l.slice(keep); }
  all[other.id] = to;
  if (sa) all[a.id] = stay; else delete all[a.id];
  for (const tid of Object.keys(pooled)) levelArmies(c, Number(tid)); // each man's house knows which of the two he is with now (warhouse.ts)
}

/**
 * Count the armies against their rolls. Where an army has fewer companies than when it was last counted, men
 * are lost to it in that share, and an army that is gone has lost them all: they are struck from the roll. Some
 * of them are dead (`MEN.won`, `MEN.lost`); the rest come home to their towns, wounded or routed. Returns the dead by town, and says so in the log.
 */
export function reckonArmies(c: Campaign): Fallen[] {
  const out: Fallen[] = [], all = rolls(c);
  for (const [key, m] of Object.entries(all)) {
    const id = Number(key), a = c.armies.find((x) => x.id === id);
    const now = a ? sizeOf(a) : 0;
    if (now >= m.size) { m.size = now; continue; }
    const men = total(m), dead = a ? Math.min(men, Math.round((men * (m.size - now)) / m.size)) : men;
    // Who falls is drawn by lot from every man with the army, so each town bears its share.
    const pool = Object.entries(m.men).flatMap(([tid, l]) => { const down = downIn(c, id, Number(tid)); return l.map((_, i) => ({ tid, i, first: i < down ? 0 : 1, lot: hash(c.seed * 7 + id * 131 + Number(tid), c.turn * 31 + i) })); }).sort((p, q) => p.first - q.first || p.lot - q.lot).slice(0, dead); // the towns of those who went down on the field just fought first (soldiernames.ts)
    const byTown: Record<string, Set<number>> = {};
    for (const p of pool) (byTown[p.tid] ??= new Set()).add(p.i);
    const owner = a?.owner ?? m.owner;
    for (const [tid, gone] of Object.entries(byTown)) {
      const out0 = m.men[tid].filter((_, i) => gone.has(i));
      m.men[tid] = m.men[tid].filter((_, i) => !gone.has(i));
      if (!m.men[tid].length) delete m.men[tid];
      const t = c.territories[Number(tid)];
      // Not all who are lost to the army are dead: the rest are wounded or routed, and come home if home is still theirs.
      const share = a ? MEN.won : MEN.lost;
      const fate = out0.map((age, i) => ({ age, lot: hash(c.seed * 11 + id * 17 + Number(tid), c.turn * 13 + i + 500) })).sort((p, q) => p.lot - q.lot);
      const killed = Math.min(out0.length, Math.max(out0.length ? 1 : 0, Math.round(out0.length * share)));
      const home = t && owner !== undefined && t.owner === owner && !t.horde ? fate.slice(killed).map((x) => x.age) : [];
      if (home.length && t) { const f = folkOf(c, t.id), ages = agesOf(c, t.id, f); countFrom(f, { m: [...ages.m, ...home], f: ages.f, k: ages.k }); }
      const dead = out0.length - home.length;
      // The dead are their houses' dead, and those who came home are under their own roofs again (warhouse.ts).
      const names = t ? fell(c, t.id, dead, a ? 'fell with the army' : 'did not come back from the army', id).map((x) => `${x.name} ${x.family}`) : [];
      if (t) cameHome(c, t.id, home.length, id);
      out.push({ town: Number(tid), army: id, dead, lost: !a, ...(home.length ? { home: home.length } : {}), ...(names.length ? { names } : {}) });
      if (t) tally(c, t.id, 'fell', dead); // for the season's report (ledger.ts)
      if (t && dead) c.log.push(`${dead} ${dead === 1 ? 'man' : 'men'} of ${t.name} ${a ? 'fell with the army' : 'did not come back: the army they marched with is no more'}${home.length ? `; ${home.length} came home hurt or routed` : ''}.${names.length ? ` ${names.length === 1 ? 'He was' : 'They were'} ${names.join(', ')}.` : ''}`);
      else if (t && home.length) c.log.push(`${home.length} ${home.length === 1 ? 'man' : 'men'} of ${t.name} came home hurt from the army.`);
    }
    if (a) m.size = now; else delete all[key];
  }
  return out;
}
/** A season passes for the men with the armies, as it does for those at home; then the armies are counted. */
export function seasonOfArmies(c: Campaign): Fallen[] {
  for (const m of Object.values(c.musters ?? {})) for (const tid of Object.keys(m.men)) m.men[tid] = m.men[tid].map((s) => Math.min(LAST_SEASON, s + 1));
  const fallen = reckonArmies(c);
  settleHouses(c); // the houses' records are set level with the rolls (warhouse.ts)
  return fallen;
}

/**
 * Send some of an army's companies home and keep the army: the most numerous kind first, never its last company.
 * The men of those companies go back onto their towns' records (or settle where the army stands, if their town is
 * no longer their people's). For an army that cannot be sent home whole: the leader's, or a nation's last.
 * Returns how many men went home, or -1 if it cannot be done.
 */
export function sendCompaniesHome(c: Campaign, armyId: number, companies: number): number {
  const a = c.armies.find((x) => x.id === armyId);
  if (!a || c.pending || c.territories[a.at]?.owner !== a.owner) return -1;
  reckonArmies(c);
  const before = sizeOf(a), go = Math.max(0, Math.min(before - 1, Math.floor(companies)));
  if (!go) return 0;
  for (let i = 0; i < go; i++) { const type = Object.keys(a.units).sort((p, q) => a.units[q] - a.units[p] || p.localeCompare(q))[0]; if (--a.units[type] <= 0) delete a.units[type]; }
  const m = musterOf(c, armyId);
  let n = 0;
  if (m) {
    // The men go with their companies, in the share the companies went, town by town.
    for (const key of Object.keys(m.men)) {
      const l = m.men[key], back = Math.round((l.length * go) / before);
      if (!back) continue;
      const tid = c.territories[Number(key)]?.owner === a.owner ? Number(key) : a.at;
      const f = folkOf(c, tid), ages = agesOf(c, tid, f);
      countFrom(f, { m: [...ages.m, ...l.splice(0, back)], f: ages.f, k: ages.k });
      cameHome(c, Number(key), back, armyId); // under their own roofs again, or let go by a house that is no longer theirs (warhouse.ts)
      if (!l.length) delete m.men[key];
      n += back;
    }
    m.size = sizeOf(a);
  }
  return n;
}

/**
 * Send men of an army home and keep the army: so many of the men of towns on its roll, and a company with every
 * `MEN.company` of them (the most numerous kind first), never its last company. Where `sendCompaniesHome`
 * sends companies and the men in their share, this sends the men: an army whose companies are mostly men of no
 * town (it was on the map before any roll was kept, or was filled where no town could man it) gives its
 * townsmen back first. They are taken from the town with most men with the army first. Returns how many men
 * went home, or -1 if it cannot be done.
 */
export function sendMenHome(c: Campaign, armyId: number, men: number): number {
  const a = c.armies.find((x) => x.id === armyId);
  if (!a || c.pending || c.territories[a.at]?.owner !== a.owner) return -1;
  reckonArmies(c);
  const m = musterOf(c, armyId);
  if (!m) return 0;
  const go = Math.max(0, Math.min(sizeOf(a) - 1, Math.ceil(Math.min(Math.floor(men), total(m)) / MEN.company)));
  if (!go) return 0;
  for (let i = 0; i < go; i++) { const type = Object.keys(a.units).sort((p, q) => a.units[q] - a.units[p] || p.localeCompare(q))[0]; if (--a.units[type] <= 0) delete a.units[type]; }
  let left = Math.min(Math.floor(men), total(m), go * MEN.company), n = 0;
  for (const key of Object.keys(m.men).sort((p, q) => m.men[q].length - m.men[p].length || Number(p) - Number(q))) {
    if (left <= 0) break;
    const l = m.men[key], back = Math.min(l.length, left);
    const tid = c.territories[Number(key)]?.owner === a.owner ? Number(key) : a.at;
    const f = folkOf(c, tid), ages = agesOf(c, tid, f);
    countFrom(f, { m: [...ages.m, ...l.splice(0, back)], f: ages.f, k: ages.k });
    cameHome(c, Number(key), back, armyId);
    if (!l.length) delete m.men[key];
    n += back; left -= back;
  }
  m.size = sizeOf(a);
  return n;
}

/** Can this army be sent home? It must stand in a town of its own people, with nothing waiting to be fought. */
export const canSendHome = (c: Campaign, armyId: number): boolean => {
  const a = c.armies.find((x) => x.id === armyId);
  return !!a && !c.pending && c.territories[a.at]?.owner === a.owner && !a.hero;
};
/**
 * Send an army home: it is no more, and its men go back onto the records of the towns they came from (or, where
 * a town is no longer their people's, settle in the town they stand in). A soldier who made a name is from now on
 * one of the notable people of the town most of them came from. Returns how many men went home.
 */
export function sendHome(c: Campaign, armyId: number): number {
  if (!canSendHome(c, armyId)) return -1;
  reckonArmies(c);
  const a = c.armies.find((x) => x.id === armyId)!, m = musterOf(c, armyId), home = homeOf(c, a);
  let n = 0;
  // Its named soldier lives on in his own town, of his own house (veteranhome.ts): found on the roll before its men go home.
  if (a.champion) rememberOf(c, a.owner, armyId, a.champion, home !== undefined && c.territories[home]?.owner === a.owner ? home : a.at);
  for (const [key, l] of Object.entries(m?.men ?? {})) {
    const tid = c.territories[Number(key)]?.owner === a.owner ? Number(key) : a.at;
    const f = folkOf(c, tid), ages = agesOf(c, tid, f);
    countFrom(f, { m: [...ages.m, ...l], f: ages.f, k: ages.k });
    cameHome(c, Number(key), l.length, armyId); // under their own roofs again (warhouse.ts)
    n += l.length;
  }
  delete rolls(c)[armyId];
  (c.homecoming ??= []).push(armyId); // sent home, not lost (rivalrule.ts keeps its named soldier living)
  c.armies.splice(c.armies.indexOf(a), 1);
  c.log.push(`${a.owner === 0 ? 'Your army' : 'An army'} at ${c.territories[a.at].name} has been sent home${n ? `: ${n} ${n === 1 ? 'man goes' : 'men go'} back to ${n === 1 ? 'his own town' : 'their own towns'}` : ''}.`);
  return n;
}
