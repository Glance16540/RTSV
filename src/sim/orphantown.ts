// The map's orphans are the town's taken-in children (docs/DESIGN.md, "People persist": the Widows row).
//
// The map keeps, for a town, children whose house is gone and the house that took them in (widowhood.ts,
// `Folk.orphans`: their family, the family that keeps them, how many). A town in a battle or a visit keeps on each
// child the family it was taken in from (bereft.ts, `Child.takenFrom`). Between them, as for the widowed (widowtown.ts):
//   - In: when the town is mustered (township.ts `musterFolk`) its orphans go with its people. Once its children are set
//     on its roofs (battlefolk.ts `cradled`), as many of them as each record counts are moved onto the record of the
//     house that keeps them (the house of that family, else a lived-in house, its family then that one), and are marked
//     as taken in from their own family. They are the town's children all the same: the count does not change.
//   - Out: the town's census (battlefolk.ts `censusOf`) carries the children taken in, by their family and the house that
//     keeps them; as it is written back (township.ts `settleFolk`), the map's orphans are those the town had, each known
//     record keeping its season. A child who came of age in the town is no orphan on the record any more.
// Children are records only, as ever: never shown on the map, never harmed, never moved but on paper.
import type { Building, Game } from './game';
import type { Orphans } from './widowhood';

declare module './township' {
  interface PeopleIn {
    /** The town's orphans, as the map knows them (orphantown.ts). */
    orphans?: Orphans[];
  }
  interface Census {
    /** The children taken in, by their family and the house that keeps them, as the battle or visit ended (orphantown.ts). */
    orphans?: Orphans[];
  }
}

const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 40) : '');

/** Make safe a list of orphans handed in or back. */
export function cleanOrphans(x: unknown): Orphans[] {
  if (!Array.isArray(x)) return [];
  return x.filter((o) => o && typeof o === 'object' && Number(o.count) > 0).slice(0, 40).map((o): Orphans => ({
    family: text(o.family), into: text(o.into), since: Number.isFinite(o.since) ? Math.round(o.since) : -1, count: Math.max(1, Math.min(20, Math.round(Number(o.count)))),
  }));
}

/** The sides of each battle whose orphans were set from the map. */
const seated = new WeakMap<Game, Set<number>>();

/** As a battle or visit begins, once its children are on its roofs: each record's children moved onto the house that keeps them. */
export function seatOrphans(g: Game, owner: number, list: Orphans[]): number {
  if (list.length) { const s = seated.get(g) ?? new Set<number>(); s.add(owner); seated.set(g, s); }
  const roofs = (): Building[] => g.buildings.filter((b) => b.owner === owner && !b.dead && b.complete && (b.type === 'house' || b.type === 'towncenter'));
  let moved = 0;
  for (const o of list) {
    const lived = roofs().filter((b) => b.type === 'house' && (b.residents.m || b.residents.f));
    const keeper = roofs().find((b) => b.type === 'house' && o.into && b.family === o.into) ?? lived.find((b) => !b.family) ?? lived[0] ?? roofs()[0];
    if (!keeper) continue;
    if (o.into && !keeper.family && keeper.type === 'house') keeper.family = o.into;
    let left = o.count;
    // The children of the town's other roofs, those not already taken in, the youngest last.
    for (const b of roofs()) {
      if (left <= 0) break;
      if (b === keeper || !b.young?.length) continue;
      const free = b.young.filter((c) => c.takenFrom === undefined).slice(0, left);
      for (const c of free) { c.takenFrom = o.family; (keeper.young ??= []).push(c); }
      b.young = b.young.filter((c) => !free.includes(c));
      left -= free.length; moved += free.length;
    }
    // Or the keeper's own, where the town's other roofs have none.
    for (const c of keeper.young ?? []) { if (left <= 0) break; if (c.takenFrom === undefined) { c.takenFrom = o.family; left--; moved++; } }
  }
  return moved;
}

/** As a battle or visit ends: the children taken in, by family and keeper. Nothing where none were set and none taken in. */
export function orphansOut(g: Game, owner: number): Orphans[] | undefined {
  const out = new Map<string, Orphans>();
  for (const b of g.buildings) {
    if (b.owner !== owner || b.dead) continue;
    for (const c of b.young ?? []) {
      if (c.takenFrom === undefined) continue;
      const into = b.family ?? '', key = `${c.takenFrom}|${into}`;
      const o = out.get(key) ?? { family: c.takenFrom, into, since: -1, count: 0 };
      o.count++; out.set(key, o);
    }
  }
  const list = [...out.values()];
  return list.length || seated.get(g)?.has(owner) ? list : undefined;
}

/** The map's orphans after a battle or visit: those the town had, each known one keeping its season. */
export function orphansBack(was: Orphans[] | undefined, town: Orphans[], turn: number): Orphans[] {
  const before = new Map((was ?? []).map((o) => [`${o.family}|${o.into}`, o]));
  return town.map((o) => ({ ...o, since: before.get(`${o.family}|${o.into}`)?.since ?? turn }));
}
