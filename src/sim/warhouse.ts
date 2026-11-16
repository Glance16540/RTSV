/**
 * A man at war is still of his house, on the map (docs/DESIGN.md, "A man at war is still of his house").
 * household.ts holds this inside a town; this holds it between seasons. armytown.ts counts the men a town has with
 * the armies; here each of them has a name and a house of that town. When a company is raised its men are taken as
 * household.ts takes them, an unmarried son before a husband, and each stays on his house's record as away. A man
 * who falls in a battle on the map is that house's loss: the house keeps his name among its fallen, the town
 * grieves (grief.ts), and where the house is one the nation knows he is listed with its lost notable people, so
 * his loss weighs as theirs does (notableweight.ts) and the roll and the season's report can name him. When the
 * army is sent home, or he comes home hurt, he is struck from the away list: he is under his own roof again.
 *
 * Plain data on the town's record (`Folk.houses`). armytown.ts stays the count of who is away; this follows it,
 * and `settleHouses` sets the two level once a season, so a campaign saved before this still loads: its men
 * away are given houses the first season it turns.
 *
 * Decided here, and open to the owner's word:
 * - Which man of a town falls is drawn by lot among those away from it, whichever army he marched with.
 * - A man whose town is no longer his people's when he comes home settles where the army stands; his old house's
 *   record lets him go.
 */
import type { Campaign } from './campaign';
import { FAMILY_NAMES, NAMES_M } from './data';
import { GRIEF_SEASONS } from './grief';
import { Folk, MAX_NOTABLES, Notable, folkOf } from './township';

export type Tie = 'husband' | 'son';
/** A man of the house away with the armies: his name, what he is to the house, the turn he left, and the army he marches with. */
export interface Serving { name: string; as: Tie; since: number; army?: number }
/** A man of the house who did not come back. */
export interface FallenMan { name: string; as: Tie; turn: number; how: string }
/** A house of a town, as far as its men at war go. */
export interface WarHouse { family: string; away: Serving[]; fallen?: FallenMan[]; /** Foes its men have felled in battles on the map: three make a rank of renown, as in a town (household.ts). */ war?: number }
declare module './township' {
  interface Folk { /** The houses whose men are, or were, away with the armies (warhouse.ts). */ houses?: WarHouse[] }
}

/**
 * Men of this town who are away with the armies: counted off the armies' rolls (`Campaign.musters`, which armytown.ts
 * keeps). It is here, and armytown.ts re-exports it, so that this module reads the rolls as plain data and imports
 * nothing of armytown's: the two called each other, and could only be had together.
 */
export const awayFrom = (c: Campaign, tid: number): number => Object.values(c.musters ?? {}).reduce((n, m) => n + (m.men[tid]?.length ?? 0), 0);

export const WARHOUSE = {
  /** Sons of one house who may be away at once before another house is asked. */
  sons: 2,
  /** Fallen a house keeps the names of, and seasons a house with nobody away is kept on record for their sake. */
  fallen: 4, remembered: 40,
  /** Houses a town keeps on this record. */
  most: 40,
  /** Seasons a town grieves for men fallen with its armies, over and above one for each man. */
  mourn: 1,
};
const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const text = (v: unknown, n = 40): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');
const TIES: Tie[] = ['husband', 'son'];

/** The houses on a town's record, made safe: whatever a saved game held, this is a list of houses. */
export function housesOf(f: Folk): WarHouse[] {
  if (!Array.isArray(f.houses)) f.houses = [];
  for (const h of f.houses) {
    h.family = text(h?.family) || 'Nameless';
    h.away = (Array.isArray(h.away) ? h.away : []).filter((s) => s && text(s.name)).map((s) => ({ name: text(s.name), as: TIES.includes(s.as) ? s.as : 'son', since: Math.round(Number(s.since) || 0), ...(Number.isFinite(Number(s.army)) && s.army !== undefined && s.army !== null ? { army: Math.round(Number(s.army)) } : {}) }));
    if (h.war !== undefined) { h.war = Math.max(0, Math.round(Number(h.war) || 0)); if (!h.war) delete h.war; }
    if (h.fallen) h.fallen = (Array.isArray(h.fallen) ? h.fallen : []).filter((s) => s && text(s.name)).map((s) => ({ name: text(s.name), as: TIES.includes(s.as) ? s.as : 'son', turn: Math.round(Number(s.turn) || 0), how: text(s.how, 60) }));
  }
  return f.houses;
}
/** Men of a town on its houses' records as away. */
export const recordedAway = (f: Folk): number => (Array.isArray(f.houses) ? f.houses : []).reduce((n, h) => n + (h.away?.length ?? 0), 0);
/** The men of a town who are away, each with his house. */
export function awayMen(c: Campaign, tid: number): { name: string; family: string; as: Tie; since: number; army?: number }[] {
  const f = c.territories[tid]?.folk;
  return f ? (Array.isArray(f.houses) ? f.houses : []).flatMap((h) => (h.away ?? []).map((s) => ({ name: s.name, family: h.family, as: s.as, since: s.since, ...(s.army !== undefined ? { army: s.army } : {}) }))) : [];
}
/** The women the nation knows in this town who are with it still: the notable houses. */
const knownHomes = (f: Folk): Notable[] => f.notables.filter((n) => n.kind === 'mother' && !n.lost && !!n.family);
const houseNamed = (f: Folk, family: string): WarHouse => {
  const all = housesOf(f);
  let h = all.find((x) => x.family === family);
  if (!h) { h = { family, away: [] }; all.push(h); }
  return h;
};
const husbandAway = (h: WarHouse | undefined): boolean => !!h?.away.some((s) => s.as === 'husband');
const sonsAway = (h: WarHouse | undefined): number => h?.away.filter((s) => s.as === 'son').length ?? 0;
/** A family name of this town not yet on the record, drawn by the town and how many it has. */
function newFamily(c: Campaign, tid: number, f: Folk): string {
  const used = new Set([...housesOf(f).map((h) => h.family), ...f.notables.map((n) => n.family ?? '')]);
  const start = Math.floor(hash(c.seed * 13 + tid, used.size + 1) * FAMILY_NAMES.length);
  for (let i = 0; i < FAMILY_NAMES.length; i++) { const name = FAMILY_NAMES[(start + i) % FAMILY_NAMES.length]; if (!used.has(name)) return name; }
  return `${FAMILY_NAMES[start]} the ${used.size}th`;
}
/** A man's name, not one his house already has away. */
function newName(c: Campaign, tid: number, h: WarHouse, k: number): string {
  const used = new Set([...h.away.map((s) => s.name), ...(h.fallen ?? []).map((s) => s.name)]);
  const start = Math.floor(hash(c.seed * 17 + tid * 53 + k, c.turn * 7 + h.away.length) * NAMES_M.length);
  for (let i = 0; i < NAMES_M.length; i++) { const name = NAMES_M[(start + i) % NAMES_M.length]; if (!used.has(name)) return name; }
  return NAMES_M[start];
}

/**
 * Men of this town have just gone to an army (armytown.ts has already taken them off the town's count). Each is
 * put on the record of a house of the town as away. As in a town (household.ts, muster.ts) an unmarried man goes
 * before a husband: the men the town had beyond its women are sons of its houses; only when those are gone does a
 * husband leave his wife. A husband of a house the nation knows goes by his own name. `army`: the army they
 * have joined. Returns who went.
 */
export function enlist(c: Campaign, tid: number, n: number, army?: number): { name: string; family: string; as: Tie }[] {
  const t = c.territories[tid], out: { name: string; family: string; as: Tie }[] = [];
  if (!t || n <= 0) return out;
  const f = folkOf(c, tid), all = housesOf(f);
  // Unmarried men the town had before these left: those beyond its women, less the sons already away who were counted so.
  const unmarried = Math.max(0, f.men + n - f.women);
  const sons = Math.min(n, unmarried);
  for (let i = 0; i < n; i++) {
    const as: Tie = i < sons ? 'son' : 'husband';
    const known = knownHomes(f);
    let h: WarHouse | undefined, name = '';
    if (as === 'husband') {
      // A known woman's man goes by the name the record has for him.
      const wife = known.find((w) => !!w.husband && !husbandAway(all.find((x) => x.family === w.family)));
      if (wife) { h = houseNamed(f, wife.family!); name = text(wife.husband); }
      else h = all.find((x) => !husbandAway(x) && !known.some((w) => w.family === x.family && !w.husband)) ?? houseNamed(f, newFamily(c, tid, f));
    } else {
      // A son of a house the town already has on record, the known houses first; a house gives two sons at the most before another is asked.
      const families = [...new Set([...known.map((w) => w.family!), ...all.map((x) => x.family)])].filter((fam) => sonsAway(all.find((x) => x.family === fam)) < WARHOUSE.sons);
      h = houseNamed(f, families.length ? families[Math.floor(hash(c.seed * 19 + tid, c.turn * 11 + i + all.length) * families.length)] : newFamily(c, tid, f));
    }
    if (!name) name = newName(c, tid, h, i);
    h.away.push({ name, as, since: c.turn, ...(army !== undefined ? { army } : {}) });
    out.push({ name, family: h.family, as });
  }
  if (all.length > WARHOUSE.most) prune(c, f, true);
  return out;
}

/** Men of this town are away no longer: they are home, or have settled elsewhere. Those of the army named go first, and of them the longest away. Returns their names. */
export function cameHome(c: Campaign, tid: number, n: number, army?: number): string[] {
  const f = c.territories[tid]?.folk, out: string[] = [];
  if (!f || n <= 0) return out;
  const all = housesOf(f);
  const order = all.flatMap((h) => h.away.map((s) => ({ h, s }))).sort((p, q) => rank(p.s, army) - rank(q.s, army) || p.s.since - q.s.since || p.h.family.localeCompare(q.h.family) || p.s.name.localeCompare(q.s.name)).slice(0, n);
  for (const { h, s } of order) { h.away.splice(h.away.indexOf(s), 1); out.push(`${s.name} ${h.family}`); }
  return out;
}

/** How near a man away is to the army asked about: of it, of none on record, of another. */
const rank = (s: Serving, army: number | undefined): number => (army === undefined || s.army === army ? 0 : s.army === undefined ? 1 : 2);
export interface HouseLoss { name: string; family: string; as: Tie; /** His house is one the nation knows: he is listed with its lost. */ known: boolean }
/**
 * Men of this town have died with an army. Who they were is drawn by lot among the town's men who marched with
 * that army (`army`; failing a record of it, among all its men away). Each is his
 * house's loss: it keeps his name among its fallen, and the town grieves. Where his house is one the nation knows
 * he is put with the town's lost notable people, so the loss weighs and can be told (notableweight.ts, roll.ts,
 * seasonreport.ts read that record). Returns who fell.
 */
export function fell(c: Campaign, tid: number, n: number, how = 'fell with the army', army?: number): HouseLoss[] {
  const t = c.territories[tid], out: HouseLoss[] = [];
  if (!t || n <= 0) return out;
  const f = folkOf(c, tid), all = housesOf(f);
  const short = n - recordedAway(f);
  if (short > 0) enlist(c, tid, short, army); // men who went before houses were kept: they are given theirs now
  const lots = all.flatMap((h) => h.away.map((s, i) => ({ h, s, lot: hash(c.seed * 23 + tid * 97 + i, c.turn * 29 + h.family.length * 7 + s.since) }))).sort((p, q) => rank(p.s, army) - rank(q.s, army) || p.lot - q.lot).slice(0, n);
  for (const { h, s } of lots) {
    h.away.splice(h.away.indexOf(s), 1);
    (h.fallen ??= []).push({ name: s.name, as: s.as, turn: c.turn, how });
    if (h.fallen.length > WARHOUSE.fallen) h.fallen.shift();
    const wife = knownHomes(f).find((w) => w.family === h.family);
    if (wife) {
      if (s.as === 'husband' && wife.husband === s.name) delete wife.husband; // she is a widow
      const lost: Notable = { name: s.name, family: h.family, gender: 'm', kind: 'veteran', deed: s.as === 'husband' ? `the man of the house of ${wife.name} ${h.family}, away with the army` : `a son of the house of ${wife.name} ${h.family}, away with the army`, turn: s.since, kills: 0, lost: { turn: c.turn, how } };
      f.notables.push(lost);
      if (f.notables.length > MAX_NOTABLES) { const old = f.notables.findIndex((x) => x.lost && x !== lost); f.notables.splice(old >= 0 ? old : 0, 1); }
    }
    out.push({ name: s.name, family: h.family, as: s.as, known: !!wife });
  }
  // A house has lost its man or its son, and the town grieves (grief.ts): a season for each man lost and one more, as long at the most as any loss is felt.
  if (out.length) f.grief = Math.max(f.grief ?? 0, Math.min(GRIEF_SEASONS, out.length + WARHOUSE.mourn));
  return out;
}

/**
 * Set which army each man away is on record as marching with level with the armies' rolls (armytown.ts): armies
 * meet and share out their men, and a campaign saved before this named no army at all. A man whose army no longer
 * has him on its roll is put with one that has a man of this town unaccounted for.
 */
export function levelArmies(c: Campaign, tid: number): void {
  const f = c.territories[tid]?.folk;
  if (!f || !Array.isArray(f.houses)) return;
  const want: Record<string, number> = {};
  for (const [id, m] of Object.entries(c.musters ?? {})) { const n = m.men[tid]?.length ?? 0; if (n) want[id] = n; }
  const loose: Serving[] = [];
  const men = housesOf(f).flatMap((h) => h.away).sort((p, q) => p.since - q.since || p.name.localeCompare(q.name));
  for (const s of men) {
    if (s.army !== undefined && (want[s.army] ?? 0) > 0) want[s.army]--;
    else loose.push(s);
  }
  for (const s of loose) {
    const id = Object.keys(want).map(Number).sort((a, b) => a - b).find((k) => want[k] > 0);
    if (id === undefined) delete s.army; else { s.army = id; want[id]--; }
  }
}
/**
 * An army has felled so many in a battle on the map. They are counted to the houses of its men, shared out by
 * lot as kills fall to whoever strikes in a town (household.ts): each is one more to a man's house, and where the
 * house is one the nation knows, to her record as well, so its standing rises as it would for kills in a town.
 * Returns how many were counted to a house (an army with no men of any town counts none).
 */
export function creditArmy(c: Campaign, armyId: number, felled: number): number {
  const owner = c.armies.find((a) => a.id === armyId)?.owner ?? c.musters?.[armyId]?.owner;
  if (owner === undefined || felled <= 0) return 0;
  const men: { f: Folk; h: WarHouse; tid: number; k: number }[] = [];
  for (const tid of Object.keys(c.musters?.[armyId]?.men ?? {}).map(Number)) {
    const f = c.territories[tid]?.folk;
    if (!f || !Array.isArray(f.houses)) continue;
    levelArmies(c, tid);
    for (const h of f.houses) h.away.forEach((s, k) => { if (s.army === armyId) men.push({ f, h, tid, k }); });
  }
  if (!men.length) return 0;
  const n = Math.min(Math.round(felled), 200);
  for (let i = 0; i < n; i++) {
    const m = men[Math.floor(hash(c.seed * 37 + armyId * 101 + i, c.turn * 41 + men.length) * men.length)];
    m.h.war = (m.h.war ?? 0) + 1;
    const wife = knownHomes(m.f).find((w) => w.family === m.h.family);
    if (wife) wife.war = (wife.war ?? 0) + 1;
  }
  return n;
}
/** Drop the houses with nobody away and nobody lately fallen. `hard`: the town's record is over-full, so the oldest go whatever they hold. */
function prune(c: Campaign, f: Folk, hard = false): void {
  const all = housesOf(f);
  f.houses = all.filter((h) => h.away.length || (h.fallen ?? []).some((x) => c.turn - x.turn <= WARHOUSE.remembered) || (h.war ?? 0) > 0); // a house with deeds to its name is kept
  if (hard && f.houses.length > WARHOUSE.most) f.houses = [...f.houses.filter((h) => h.away.length), ...f.houses.filter((h) => !h.away.length)].slice(0, WARHOUSE.most);
  if (!f.houses.length) delete f.houses;
}
/**
 * Once a season the houses' records are set level with the armies' rolls (armytown.ts is the count of who is
 * away). A town with more men away than its houses know of gives the others houses: a campaign saved before
 * this. One whose houses hold more than are away lets them go: they came home by a road nobody told us of.
 */
export function settleHouses(c: Campaign): { enlisted: number; released: number } {
  let enlisted = 0, released = 0;
  for (const t of c.territories) {
    const f = t.folk;
    if (!f) continue;
    const away = awayFrom(c, t.id), known = recordedAway(f);
    if (!away && !known && !f.houses) continue;
    if (away > known) enlisted += enlist(c, t.id, away - known).length;
    else if (known > away) released += cameHome(c, t.id, known - away).length;
    levelArmies(c, t.id);
    prune(c, f);
  }
  return { enlisted, released };
}

/** The men of a people who fell with its armies since a turn, by name, with their town: for whoever tells of them. */
export function fallenSince(c: Campaign, owner: number, since: number): { name: string; family: string; as: Tie; town: number; turn: number; how: string }[] {
  const out: { name: string; family: string; as: Tie; town: number; turn: number; how: string }[] = [];
  for (const t of c.territories) {
    if (t.owner !== owner || !t.folk || !Array.isArray(t.folk.houses)) continue;
    for (const h of t.folk.houses) for (const x of h.fallen ?? []) if (x.turn >= since) out.push({ name: x.name, family: h.family, as: x.as, town: t.id, turn: x.turn, how: x.how });
  }
  return out.sort((a, b) => b.turn - a.turn || a.town - b.town || a.name.localeCompare(b.name));
}
/** Who of a town is away, in words; nothing if nobody is. */
export function awayText(c: Campaign, tid: number, most = 6): string {
  const men = awayMen(c, tid);
  if (!men.length) return '';
  const won = (family: string): number => c.territories[tid]?.folk?.houses?.find((h) => h.family === family)?.war ?? 0;
  const said = men.slice(0, most).map((m) => `${m.name} ${m.family} (${m.as === 'husband' ? 'the man of his house' : 'a son of the house'}${won(m.family) ? `; the house has felled ${won(m.family)} in the field` : ''})`).join(', ');
  return `${said}${men.length > most ? ` and ${men.length - most} more` : ''}.`;
}
