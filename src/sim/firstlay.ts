// A town met in person for the first time (docs/DESIGN.md: towns persist; docs/PLAYTEST.md, the frame-cost finding).
//
// A town nobody has fought over or visited is kept on the map as a coarse record (rivalrule.ts layTown): a hall, the
// works the map knows it has, and roofs for the people it holds, laid for counting and not at places on a field. Its
// first siege or visit used to lay only the hall and the works, so a capital of 130 people with 29 buildings on record
// stood on the field as a hall and a barracks, its people over the room of its roofs (122 for 10).
//
// So when a side's town comes to the field with only a coarse record, its buildings are laid on the town's plan as the
// record counts them: what the battle has not already raised (the hall, the works of the land) is placed around the hall
// on free ground (Game.siteNear: clear of the muster ground, a cell between buildings), works first, then the houses.
// The search starts as near as a battle's own works are laid (16 cells) and widens a ring at a time (FIRSTLAY.reach)
// only when that ground is full: a grown town at four times the size has forty or fifty roofs, which do not fit in 16.
// Nothing is laid near another side's start, where it would stand in that side's camp.
// After the battle the field is written back as the town's real record, as any battle's is, and the coarse one is gone.
// Whatever finds no room at the widest is not laid, and is kept for the record without a place (unlaid.ts, the armies
// session): written back with what stands, and tried again at the next sitting (layKept).
import { BUILDINGS } from './data';
import type { Game, Standing } from './game';
import { isUnlaid, keepUnlaid } from './unlaid';

export const FIRSTLAY = {
  /** How far from the start to look, ring after ring, each only when the nearer is full. */
  reach: [16, 24, 32, 40],
  /** No building of this town nearer than this to another side's start. */
  clear: 14,
};

/** Room for a building of this side's town around its start, the nearest ring first; null when even the widest is full. */
export function roomFor(g: Game, owner: number, st: { x: number; y: number }, dir: number, type: string): { cx: number; cy: number } | null {
  const size = BUILDINGS[type].size;
  const clear = (p: { cx: number; cy: number } | null): boolean => !!p && g.spec.starts.every((o, k) => k === owner || Math.hypot(o.x - p.cx - size / 2, o.y - p.cy - size / 2) >= FIRSTLAY.clear);
  for (const reach of FIRSTLAY.reach) { const p = g.siteNear(type, st, dir, reach); if (clear(p)) return p; }
  return null;
}

/**
 * A real record's buildings that had no place at the last sitting (unlaid.ts): each is laid if there is room now, as
 * whole and as far built as it was, and kept again if there is not. Returns how many were laid.
 */
export function layKept(g: Game, owner: number, st: { x: number; y: number }, dir: number, town: readonly Standing[]): number {
  let laid = 0;
  for (const x of town) {
    if (!BUILDINGS[x[0]] || !isUnlaid(x)) continue;
    const at = roomFor(g, owner, st, dir, x[0]);
    if (!at) { keepUnlaid(g, owner, x); continue; }
    const half = typeof x[4] === 'number' && x[4] >= 0 && x[4] < 1;
    const b = g.spawnBuilding(x[0], owner, at.cx, at.cy, !half);
    if (half) b.progress = x[4]!;
    if (typeof x[3] === 'number' && x[3] > 0 && x[3] < 1) b.hp = Math.max(1, Math.round(b.maxHp * x[3]));
    laid++;
  }
  return laid;
}

/** Lay a coarse record's buildings on the field for this side, around its start; returns how many were laid. */
export function layCoarse(g: Game, owner: number, st: { x: number; y: number }, dir: number, coarse: readonly Standing[]): number {
  const have: Record<string, number> = {};
  for (const b of g.buildings) if (b.owner === owner) have[b.type] = (have[b.type] ?? 0) + 1;
  // Works before houses, so the room near the hall goes to what the town is known for.
  const order = [...coarse].filter((x) => BUILDINGS[x[0]]).sort((a, b) => Number(a[0] === 'house') - Number(b[0] === 'house'));
  let laid = 0;
  for (const x of order) {
    const type = x[0];
    if (have[type]) { have[type]--; continue; } // already raised by the battle (the hall, the land's works)
    const at = roomFor(g, owner, st, dir, type);
    if (!at) { keepUnlaid(g, owner, x); continue; } // no room at the widest: kept for the record (unlaid.ts)
    g.spawnBuilding(type, owner, at.cx, at.cy, true);
    laid++;
  }
  return laid;
}
