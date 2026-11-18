// The old people of a town taken are people, marked one by one (docs/DESIGN.md, "A town taken"; the owner's word,
// 18 November 2026: "make them people, not a count").
//
// A town taken by force keeps those within it who are still of the people it was taken from (oldfolk.ts,
// `Territory.oldFolk`). Where the town knows its people by name, they are marked as such by name (`oldFolk.names`): its
// notables, its widowed, the man and woman of each household on its record (roofsmap.ts), its men away with the armies
// (warhouse.ts). Those it does not know by name (the grown not yet met, and children, who are never shown) are the rest,
// `n` less the names. The count (`n`) is the names and the rest together, and follows them: each season so many become
// the holder's (oldfolk.ts, at the rates as they were), and which of them is drawn among the named and the rest in the
// share each is of the old people.
//
// In a battle or a visit (township.ts musterFolk, game.ts, township.ts settleFolk):
//   - the named are marked on the field by name (`Unit.oldOf`), and the rest's share of the town on the field is marked
//     among its unmarked grown villagers by lot; those the field cap holds back keep their share at home (`oldFolk.home`);
//   - as it ends, the marked who live are handed back by name, and are the town's named old people from then on.
// A marked villager's own panel says so (`oldLine`); the land's panel gives the count (oldfolk.ts `oldText`).
// Plain data: it reads the town's record as it stands and imports nothing of township.ts, oldfolk.ts or the battle.
import type { Campaign, Territory } from './campaign';
import type { Game, Unit } from './game';
import { peopleName } from './naming';

declare module './campaign' {
  interface Territory {
    /** Those within a taken town still of the people it was taken from (oldfolk.ts): `n` in all, `names` of them known by name
     *  (oldmarks.ts), `home` of the rest held back from the field of the sitting now fought (oldmarks.ts). */
    oldFolk?: { from: number; n: number; wed?: number; names?: string[]; home?: number };
  }
}
declare module './game' {
  interface Unit { /** Still of the people its town was taken from (oldmarks.ts): that people, and its name. */ oldOf?: number; oldWho?: string }
}
declare module './township' {
  interface PeopleIn { /** The town's old people on the field: who by name, how many more unnamed, and their people's name (oldmarks.ts). */ old?: { from: number; names: string[]; rest: number; who?: string } }
  interface Census { /** The old people of the town who live as the sitting ends, by name (oldmarks.ts). */ old?: { from: number; names: string[] } }
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40) : '');
const lot = (seed: number, a: number, b: string): number => {
  let h = (Math.imul(seed ^ 0x2f1e8b3d, 0x9e3779b1) ^ Math.imul(a + 0x632be5ab, 0x85ebca6b)) >>> 0;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** Everyone the town knows by name, living: its notables, its widowed, its households' men and women, its men away. */
export function namedOf(t: Territory): string[] {
  const f = t.folk as (Record<string, unknown> & { notables?: { name: string; lost?: unknown }[] }) | undefined;
  if (!f) return [];
  const out = new Set<string>();
  for (const n of f.notables ?? []) if (!n.lost && text(n.name)) out.add(text(n.name));
  for (const w of (f.widowed as { name?: string }[] | undefined) ?? []) if (text(w?.name)) out.add(text(w.name));
  for (const r of ((f.households as { list?: { m?: { name?: string }; f?: { name?: string } }[] } | undefined)?.list) ?? []) { if (text(r?.m?.name)) out.add(text(r.m!.name)); if (text(r?.f?.name)) out.add(text(r.f!.name)); }
  for (const h of (f.houses as { away?: { name?: string }[] }[] | undefined) ?? []) for (const s of h?.away ?? []) if (text(s?.name)) out.add(text(s.name));
  return [...out];
}

/** A town has just been taken: those of it known by name are its old people by name, at most as many as there are. */
export function markTaken(t: Territory): void {
  const o = t.oldFolk;
  if (!o) return;
  o.names = namedOf(t).slice(0, Math.max(0, o.n));
}

/** Make safe the names on a town's old people, whatever a saved game held: a campaign saved before has none. */
const namesOf = (o: NonNullable<Territory['oldFolk']>): string[] => (o.names = (Array.isArray(o.names) ? o.names : []).map(text).filter(Boolean).slice(0, Math.max(0, o.n)));

/**
 * So many of the old people become the holder's (oldfolk.ts says how many). Which is drawn among the named and the rest
 * in the share each is of them: the named who go are struck from the names. Returns the names that went.
 */
export function passOver(c: Campaign, t: Territory, k: number): string[] {
  const o = t.oldFolk;
  if (!o || k <= 0) return [];
  const names = namesOf(o), take = Math.min(names.length, Math.round((Math.min(k, o.n) * names.length) / Math.max(1, o.n)));
  const gone = names.map((n) => ({ n, k: lot(c.seed, t.id * 131 + c.turn, n) })).sort((p, q) => p.k - q.k).slice(0, take).map((x) => x.n);
  o.names = names.filter((n) => !gone.includes(n));
  return gone;
}
/** The old people are fewer than they were (the town's people are no more than so many): the rest go first, then names. */
export function trimOld(t: Territory, n: number): void {
  const o = t.oldFolk;
  if (!o) return;
  o.n = Math.max(0, Math.min(o.n, n));
  if (namesOf(o).length > o.n) o.names = o.names!.slice(0, o.n);
}

/**
 * As a battle or visit begins: the town's old people on the field, the named and the rest's share of the grown who go
 * (`field`), against all the town's people, children too (`all`): children and those held back are the share at home.
 */
export function oldIn(c: Campaign, tid: number, field: number, all: number): { old?: { from: number; names: string[]; rest: number; who?: string } } {
  const t = c.territories[tid], o = t?.oldFolk;
  if (!t || !o || o.n <= 0) { if (o) delete o.home; return {}; }
  const names = namesOf(o), rest = Math.max(0, o.n - names.length);
  const out = all > 0 ? Math.round((rest * Math.min(field, all)) / all) : rest;
  o.home = rest - out; // the rest's share held back from the field (fieldcap.ts): kept as it is
  return { old: { from: o.from, names: [...names], rest: out, who: peopleName(c, o.from) } };
}

/** The town's grown villagers of a side, not soldiers, not children. */
const grownOf = (g: Game, owner: number): Unit[] => g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead && u.growT <= 0);
/** As the battle or visit begins, once the households are seated: the old people marked, by name and then the rest by lot. */
export function seatOld(g: Game, owner: number, old: { from: number; names: string[]; rest: number; who?: string }): number {
  const names = new Set(old.names.map(text)), folk = grownOf(g, owner), who = text(old.who) || undefined;
  const mark = (u: Unit): void => { u.oldOf = old.from; if (who) u.oldWho = who; };
  let marked = 0;
  for (const u of folk) if (u.name && names.has(u.name)) { mark(u); marked++; names.delete(u.name); }
  // Those named but not on the field (the field cap, or not found) are of the rest: their share is marked by lot too.
  let rest = Math.max(0, Math.round(old.rest));
  const free = folk.filter((u) => u.oldOf === undefined).sort((a, b) => lot(owner + 7, a.id, u2(a)) - lot(owner + 7, b.id, u2(b)));
  for (const u of free) { if (rest <= 0) break; mark(u); rest--; marked++; }
  return marked;
}
const u2 = (u: Unit): string => `${u.name ?? ''}${u.family ?? ''}`;

/** As the battle or visit ends: the town's old people who live, by name. Nothing where none were marked. */
export function oldOut(g: Game, owner: number): { old?: { from: number; names: string[] } } {
  const marked = g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead && u.oldOf !== undefined);
  if (!marked.length) return {};
  return { old: { from: marked[0].oldOf!, names: marked.map((u) => text(u.name)).filter(Boolean) } };
}

/** Make safe the old people handed back from a battle. */
export function cleanOld(x: unknown): { from: number; names: string[] } | undefined {
  const o = x as { from?: unknown; names?: unknown } | undefined;
  if (!o || typeof o !== 'object' || !Number.isInteger(o.from) || !Array.isArray(o.names)) return undefined;
  return { from: o.from as number, names: (o.names as unknown[]).map(text).filter(Boolean).slice(0, 400) };
}

/** As the town is written back: its old people are those marked on the field who live, and the rest held back at home. */
export function oldBack(c: Campaign, tid: number, out: { from: number; names: string[] } | undefined): void {
  const o = c.territories[tid]?.oldFolk;
  if (!o) return;
  if (o.home === undefined) return; // none of them were sent to this field
  const home = Math.max(0, o.home);
  delete o.home;
  // Those marked who live are the named old people from now on; those held back at home are as they were.
  o.names = out && out.from === o.from ? [...new Set(out.names)] : [];
  o.n = o.names.length + home;
}

/** A villager's own panel's line, where they are still of the people their town was taken from. Empty otherwise. */
export function oldLine(u: Unit): string {
  return u.oldOf === undefined ? '' : `Of the ${u.oldWho ?? 'people the town was taken from'}: taken with the town, not yet of yours.`;
}
