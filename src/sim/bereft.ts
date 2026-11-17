// Widows, widowers and orphans in a town (docs/DESIGN.md, "People persist": the Widows row's "inside a town nothing
// happens to them"). As on the map (widowhood.ts):
//   - When the man or the woman of a house dies and the other lives, the house remembers whom it lost: she is its widow,
//     he its widower, and keeps the house, with its children. Nobody is moved in by it; should a man or a woman come to
//     live there again (a new marriage), the widowhood is over.
//   - When the last of a house's couple dies and the house has children on its record, they are taken in by a named
//     house of the town: the nearest house with someone living in it, a known family's first. The children are moved on
//     the record only; nothing harms them.
// Plain data on the house (`Building.bereft`) and the child (`Child.takenFrom`); the house panel reads it.
import type { Building, Game, Unit } from './game';

declare module './game' {
  interface Building {
    /** Whom the house has lost, and when (bereft.ts): its widow or widower lives on in it. */
    bereft?: { name: string; as: 'husband' | 'wife'; at: number };
  }
}
declare module './nursery' {
  interface Child {
    /** The family of the house this child was taken in from, its own being gone (bereft.ts). */
    takenFrom?: string;
  }
}

/** The house's widow or widower, if it has one now: someone lost, and the other still living there, unmarried again. */
export function bereftOf(g: Game, b: Building): { who: Unit; lost: string; as: 'husband' | 'wife' } | null {
  if (!b.bereft) return null;
  const r = b.residents, left = b.bereft.as === 'husband' ? r.f : r.m, empty = b.bereft.as === 'husband' ? r.m : r.f;
  const who = left ? g.entities.get(left) : undefined;
  if (empty || !who || who.kind !== 'unit' || who.dead) return null; // married again, or gone
  return { who, lost: b.bereft.name, as: b.bereft.as };
}

/** The house of the town that takes in a fallen house's children: the nearest with someone living in it, a known family's first. */
export function takerFor(g: Game, from: Building): Building | null {
  const d = (b: Building): number => Math.hypot(b.x - from.x, b.y - from.y);
  return g.buildings.filter((b) => b !== from && b.owner === from.owner && b.type === 'house' && b.complete && !b.dead && (b.residents.m || b.residents.f))
    .sort((a, b) => Number(!!b.family) - Number(!!a.family) || d(a) - d(b) || a.id - b.id)[0] ?? null;
}

/** Someone of a house has died (game.ts calls this, after striking them from it): its widow, widower or orphans. */
export function bereaved(g: Game, home: Building, dead: Unit): void {
  if (home.type !== 'house') return;
  const r = home.residents, as: 'husband' | 'wife' = dead.gender === 'f' ? 'wife' : 'husband';
  if (r.m || r.f) { home.bereft = { name: dead.name, as, at: g.time }; return; }
  delete home.bereft;
  if (!home.young?.length) return;
  const to = takerFor(g, home);
  if (!to) return; // nobody left to take them: they stay on the record of their roof, as before
  const family = home.family ?? dead.family ?? '';
  for (const c of home.young) c.takenFrom = family;
  (to.young ??= []).push(...home.young);
  g.msg(home.owner, `The ${home.young.length === 1 ? 'child' : `${home.young.length} children`} of the ${family ? `${family} house` : 'house'} ${home.young.length === 1 ? 'has' : 'have'} lost both parents, and ${home.young.length === 1 ? 'is' : 'are'} taken in by the ${to.family ? `${to.family} house` : 'house next door'}.`);
  home.young = [];
}

/** The house panel's lines for widowhood and orphans taken in, as words. */
export function bereftLines(g: Game, b: Building): string[] {
  const out: string[] = [];
  const w = bereftOf(g, b);
  if (w) out.push(`${w.who.name} is ${w.as === 'husband' ? 'widowed' : 'a widower'}: ${w.as === 'husband' ? 'her husband' : 'his wife'} ${w.lost} is dead. ${w.as === 'husband' ? 'She keeps' : 'He keeps'} the house.`);
  const taken = (b.young ?? []).filter((c) => c.takenFrom !== undefined);
  if (taken.length) out.push(`Taken in: ${taken.map((c) => `${c.name}${c.takenFrom ? `, of the ${c.takenFrom} house` : ''}`).join('; ')}. ${taken.length === 1 ? 'An orphan' : 'Orphans'}, raised here.`);
  return out;
}
