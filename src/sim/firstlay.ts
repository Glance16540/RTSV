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
// After the battle the field is written back as the town's real record, as any battle's is, and the coarse one is gone.
// Whatever finds no room is not laid; nothing else changes.
import { BUILDINGS } from './data';
import type { Game, Standing } from './game';

/** Lay a coarse record's buildings on the field for this side, around its start; returns how many were laid. */
export function layCoarse(g: Game, owner: number, st: { x: number; y: number }, dir: number, coarse: readonly Standing[]): number {
  const have: Record<string, number> = {};
  for (const b of g.buildings) if (b.owner === owner) have[b.type] = (have[b.type] ?? 0) + 1;
  // Works before houses, so the room near the hall goes to what the town is known for.
  const order = [...coarse].filter((x) => BUILDINGS[x[0]]).sort((a, b) => Number(a[0] === 'house') - Number(b[0] === 'house'));
  let laid = 0;
  for (const [type] of order) {
    if (have[type]) { have[type]--; continue; } // already raised by the battle (the hall, the land's works)
    const at = g.siteNear(type, st, dir);
    if (!at) continue;
    g.spawnBuilding(type, owner, at.cx, at.cy, true);
    laid++;
  }
  return laid;
}
