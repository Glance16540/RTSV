// A farmer works in the field, not at its fence (seen in the browser sweep of 19 November 2026: the one working a farm
// stood at its corner on the path, hoeing the bare ground beside it).
//
// A farm is walkable. Once a farmer has reached it, they walk in among the rows to a place of their own in it, and
// from one place to the next as the work goes on (each load they carry, a row further along), at a walk. They work as
// they go: what the field yields, and how fast, is exactly what it was.

/** How far in from the field's middle the places of work lie, as a share of its width, and how fast a farmer walks there (tiles a second). */
export const FIELD = { spread: 0.28, pace: 1.1 };

interface Farmer { id: number; x: number; y: number; carryAmt: number; facing: number }
interface Field { x: number; y: number; size: number }

/** Where in this field the farmer works now: a row and a place along it, by who they are and how much they carry. */
export function fieldSpot(u: Farmer, f: Field): { x: number; y: number } {
  const w = f.size * FIELD.spread, along = ((u.carryAmt % 3) - 1) * w, row = (((u.id % 3) + 3) % 3 - 1) * w;
  return { x: f.x + along, y: f.y + row };
}

/** Walk the farmer toward their place in the field this tick, working as they go. True while they are still walking there. */
export function intoField(u: Farmer, f: Field, dt: number): boolean {
  const s = fieldSpot(u, f), dx = s.x - u.x, dy = s.y - u.y, d = Math.hypot(dx, dy);
  if (d < 0.15) return false;
  const step = Math.min(d, FIELD.pace * dt);
  u.x += (dx / d) * step; u.y += (dy / d) * step;
  u.facing = Math.atan2(dx, dy);
  return true;
}
