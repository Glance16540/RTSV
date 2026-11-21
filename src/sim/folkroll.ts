// Everyone grown is somebody (docs/CLOSING.md, "A report of who was killed and who was taken": the report counted
// them and aged them but named only the notable, since a town kept counts and ages, not names).
//
// A town's record now keeps its grown by name (`Folk.roll`): one entry for each man, woman and old person at home,
// each of a house of the town. Children stay counts, by the content rules. The counts (`Folk.men`, `women`,
// `elders`, and the ages) are still what every system reads and changes; the roll follows them. Once a season, and
// whenever a battle is written back, it is set level: a town with more grown than names gives the newcomers names (of
// a house the town has: its houses at war, its known women, or the houses already on the roll), and one with more
// names than grown lets the names go from the front of the roll first, the longest there, since those who die
// between battles are mostly the old. A notable person of the town is never let go while the record keeps her.
//
// In a battle fought in person the roll goes to the field with the town's people (`PeopleIn.roll`): each villager
// set down there bears a name off it, and a soldier trained there keeps it (game.ts). As the battle ends the census
// hands back the names of those still living (`Census.roll`), beside those held captive by the other side
// (`Census.carried`, carriedout.ts). Those sent who are in neither died there, and the report names them (the carried off were named already, by
// battlecarried.ts). A town saved before
// this loads as it was: its grown are given names the first season, or the first battle, that reads it.
//
// What it costs a saved game, measured (tests/folkroll.test.ts): on a campaign of twenty years with three rivals, 1,140
// named in 22 towns, some 37 bytes each: 42.6 thousand bytes of a save of 371 thousand (11.5%).
import type { Campaign } from './campaign';
import type { Folk, PeopleIn, Census } from './township';
import { givenNames, houseNames, townPeople } from './peoplenames';

/** One grown person of a town: their given name, their house, and whether a man or a woman. */
export interface Grown { n: string; h: string; g: 'm' | 'f' }
declare module './township' {
  interface Folk {
    /** The town's grown by name (folkroll.ts). */ roll?: Grown[];
    /** Those of the roll sent to the field in a battle now being fought (folkroll.ts). */ rollSent?: Grown[];
  }
  interface PeopleIn { /** The grown sent to the field, by name, in the order of their sex (folkroll.ts). */ roll?: Grown[] }
  interface Census { /** The side's grown still living as the battle ended, by name (folkroll.ts). */ roll?: Grown[] }
}

export const ROLL = {
  /** Names a report of a battle gives before it says "and so many more". */
  told: 12,
};

/** The town's record as it stands (township.ts folkOf makes one where there is none: a town with none has no roll). */
const folkAt = (c: Campaign, tid: number): Folk | undefined => c.territories[tid]?.folk;
const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const text = (v: unknown, n = 40): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');
export const keyOf = (p: { n: string; h?: string }): string => (p.h ? `${p.n} ${p.h}` : p.n);
/** A person's name as a report gives it. */
export const nameOf = keyOf;

/** A list of grown people, made safe: whatever it held, a list of names. */
export function cleanGrown(v: unknown, most = 720): Grown[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p) => p && typeof p === 'object' && text(p.n)).slice(0, most).map((p) => ({ n: text(p.n), h: text(p.h), g: p.g === 'f' ? 'f' : 'm' }));
}

/** How many grown men and women the town has, the old among them: by the record of ages, or, without one, the old shared half and half. */
export function bySex(f: Folk): { m: number; f: number } {
  const grown = f.men + f.women + f.elders, a = f.ages;
  if (a && Array.isArray(a.m) && Array.isArray(a.f) && a.m.length + a.f.length === grown) return { m: a.m.length, f: a.f.length };
  return { m: f.men + Math.ceil(f.elders / 2), f: f.women + Math.floor(f.elders / 2) };
}

/** The names a town's record must keep: its known women living (a known man may be away at war), who are on the roll by the names it has for them. */
const known = (f: Folk) => f.notables.filter((x) => !x.lost && x.kind === 'mother');
const kept = (f: Folk): Set<string> => new Set(known(f).map((x) => keyOf({ n: x.name, h: x.family })));

/** The houses a newcomer to the roll may be of: those the town knows, then those already on it, then its people's own. */
function housesFor(c: Campaign, tid: number, f: Folk, roll: readonly Grown[]): string[] {
  const known = [...(f.houses ?? []).map((h) => h.family), ...f.notables.map((x) => x.family ?? ''), ...roll.map((p) => p.h)].filter(Boolean);
  const all = [...new Set(known)];
  return all.length ? all : [...houseNames(townPeople(c, tid))];
}

/**
 * Set a town's roll level with its counts (see the head of this file). Returns how many names were given and let go.
 * Nothing changes for a town whose roll already holds as many of each sex as it has.
 */
export function levelRoll(c: Campaign, tid: number): { named: number; gone: number } {
  const f = folkAt(c, tid);
  if (!f) return { named: 0, gone: 0 };
  const want = bySex(f);
  const roll = Array.isArray(f.roll) ? f.roll : cleanGrown(f.roll);
  const out = { named: 0, gone: 0 };
  // The known are on the roll under the names the record has for them.
  const here = new Set(roll.map(keyOf));
  for (const x of known(f)) if (!here.has(keyOf({ n: x.name, h: x.family }))) { roll.push({ n: text(x.name), h: text(x.family), g: x.gender === 'f' ? 'f' : 'm' }); here.add(keyOf({ n: x.name, h: x.family })); }
  const keep = kept(f);
  for (const g of ['m', 'f'] as const) {
    let have = roll.filter((p) => p.g === g).length;
    // Too many: the longest on the roll go first, never one the record keeps by name while another may go.
    for (let i = 0; have > want[g] && i < roll.length;) {
      if (roll[i].g === g && !keep.has(keyOf(roll[i]))) { roll.splice(i, 1); have--; out.gone++; } else i++;
    }
    for (let i = roll.length - 1; have > want[g] && i >= 0; i--) if (roll[i].g === g) { roll.splice(i, 1); have--; out.gone++; }
    // Too few: a name for each, of a house of the town, not one the town has already.
    if (have < want[g]) {
      const given = givenNames(townPeople(c, tid), g), houses = housesFor(c, tid, f, roll);
      for (let k = 0; have < want[g]; k++) {
        const salt = c.seed * 31 + tid * 7919 + c.turn * 104729;
        const h = houses[Math.floor(hash(salt, k * 2 + (g === 'f' ? 1 : 0)) * houses.length)];
        const start = Math.floor(hash(salt + 1, k * 2 + (g === 'f' ? 1 : 0)) * given.length);
        // A given name nobody of their sex in the town has, while there is one; else one their house does not have.
        const taken = new Set([...roll.filter((p) => p.g === g).map((p) => p.n), ...(g === 'm' ? (f.houses ?? []).flatMap((x) => (x.away ?? []).map((s) => s.name)) : [])]); // and not a man's of the town away at war
        let n = given[start];
        for (let j = 0; j < given.length && taken.has(n); j++) n = given[(start + j) % given.length];
        for (let j = 0; j < given.length && here.has(keyOf({ n, h })); j++) n = given[(start + j) % given.length];
        const p: Grown = { n, h, g };
        roll.push(p); here.add(keyOf(p)); have++; out.named++;
      }
    }
  }
  f.roll = roll;
  if (!roll.length) delete f.roll;
  return out;
}

/** Once a season: every town's roll is set level with its counts. */
export function rollSeason(c: Campaign): { named: number; gone: number } {
  const sum = { named: 0, gone: 0 };
  for (const t of c.territories) { if (!t.folk) continue; const r = levelRoll(c, t.id); sum.named += r.named; sum.gone += r.gone; }
  return sum;
}

/**
 * The town's people go to the field: the names of as many of each sex as are sent (`m`, `f`), the known first, so
 * that a known woman on the field is one of those sent. The rest stay at home on the roll. They are kept on the
 * record as sent until the battle is written back.
 */
export function rollOut(c: Campaign, tid: number, sent: { m: number; f: number }): Grown[] {
  levelRoll(c, tid);
  const f = folkAt(c, tid);
  if (!f) return [];
  const roll = f.roll ?? [], keep = kept(f);
  const out: Grown[] = [];
  for (const g of ['m', 'f'] as const) {
    const of = roll.filter((p) => p.g === g), first = [...of.filter((p) => keep.has(keyOf(p))), ...of.filter((p) => !keep.has(keyOf(p)))];
    out.push(...first.slice(0, Math.max(0, sent[g])));
  }
  if (out.length) f.rollSent = out.map((p) => ({ ...p })); else delete f.rollSent;
  return out;
}
/** What `PeopleIn` carries for the roll: those sent, by sex, as `rollOut` chose them. */
export const rollIn = (c: Campaign, tid: number, people: PeopleIn): PeopleIn => {
  const a = people.ages, sent = a ? { m: a.m.length, f: a.f.length } : { m: people.men + Math.ceil(people.elders / 2), f: people.women + Math.floor(people.elders / 2) };
  const roll = rollOut(c, tid, sent);
  return roll.length ? { ...people, roll } : people;
};

export interface RollReckoning { dead: Grown[]; carried: Grown[] }
/**
 * A battle fought in person over the town is written back (township.ts settleFolk, after the counts): the roll is those
 * who stayed at home and those of the field still living; the sent who are neither living nor held captive died.
 */
export function rollBack(c: Campaign, tid: number, census: Census): RollReckoning {
  const f = folkAt(c, tid), out: RollReckoning = { dead: [], carried: [] };
  if (!f) return out;
  const sent = cleanGrown(f.rollSent);
  delete f.rollSent;
  if (!sent.length && !census.roll) { levelRoll(c, tid); return out; }
  const alive = cleanGrown(census.roll), carried = (census.carried ?? []).map((x) => ({ n: x.name, h: x.family ?? "" }));
  const sentKeys = new Set(sent.map(keyOf)), living = new Set(alive.map(keyOf)), held = new Set(carried.map(keyOf));
  const home = (Array.isArray(f.roll) ? f.roll : []).filter((p) => !sentKeys.has(keyOf(p)));
  const seen = new Set<string>(), roll: Grown[] = [];
  for (const p of [...home, ...alive]) { const k = keyOf(p); if (!seen.has(k)) { seen.add(k); roll.push(p); } }
  f.roll = roll;
  for (const p of sent) {
    const k = keyOf(p);
    if (living.has(k)) continue;
    if (held.has(k)) out.carried.push(p); else out.dead.push(p);
  }
  levelRoll(c, tid);
  return out;
}

/** Of the town's men, these fell where nobody watched (township.ts tollFolk): drawn by lot from the roll's men. Their names. */
export function fallFromRoll(c: Campaign, tid: number, men: number): Grown[] {
  const f = folkAt(c, tid);
  if (!f || !Array.isArray(f.roll) || men <= 0) return [];
  const keep = kept(f), out: Grown[] = [];
  for (let k = 0; k < men; k++) {
    const may = f.roll.filter((p) => p.g === 'm' && !keep.has(keyOf(p)));
    if (!may.length) break;
    const p = may[Math.floor(hash(c.seed * 37 + tid, c.turn * 131 + k) * may.length)];
    f.roll.splice(f.roll.indexOf(p), 1);
    out.push(p);
  }
  return out;
}

/** Names in a line of a report: all of them up to `ROLL.told`, then how many more. */
export function namesLine(list: readonly Grown[]): string {
  const names = list.slice(0, ROLL.told).map(nameOf);
  return names.join(', ') + (list.length > names.length ? `, and ${list.length - names.length} more` : '');
}
